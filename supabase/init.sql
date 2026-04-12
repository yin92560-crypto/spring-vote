-- ============================================================
-- 捕捉春日计划 · Supabase 初始化脚本
-- 在 Supabase Dashboard → SQL Editor 中整段执行
-- ============================================================

-- 作品表
create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  image_path text not null,
  image_url text not null,
  created_at timestamptz not null default now()
);

-- 投票表：每条记录为一票；按 voter_ip + vote_date（东八区日）限制每日 3 票
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works (id) on delete cascade,
  voter_ip text not null,
  vote_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_votes_ip_date on public.votes (voter_ip, vote_date);
create index if not exists idx_votes_work_id on public.votes (work_id);

-- 原子投票：校验当日票数与作品存在性后插入（与 API 使用的时区一致：Asia/Shanghai）
create or replace function public.cast_vote (p_work_id uuid, p_voter_ip text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('Asia/Shanghai', now()))::date;
  v_count int;
begin
  select count(*)::int into v_count
  from public.votes
  where voter_ip = p_voter_ip
    and vote_date = v_today;

  if v_count >= 3 then
    return jsonb_build_object('ok', false, 'reason', '今日票数已用完');
  end if;

  if not exists (select 1 from public.works where id = p_work_id) then
    return jsonb_build_object('ok', false, 'reason', '作品不存在');
  end if;

  insert into public.votes (work_id, voter_ip, vote_date)
  values (p_work_id, p_voter_ip, v_today);

  return jsonb_build_object('ok', true);
end;
$$;

-- 仅允许 service_role 调用（与 Next.js 服务端 API 使用的密钥一致）
revoke all on function public.cast_vote (uuid, text) from public;
grant execute on function public.cast_vote (uuid, text) to service_role;

-- 行级安全：禁止匿名直连表读写；Next.js 使用 service_role 密钥可绕过 RLS
alter table public.works enable row level security;
alter table public.votes enable row level security;

-- 可选：若希望匿名用户用 anon key 只读作品列表，可取消下面注释并调整策略
-- create policy "works_select_public" on public.works for select to anon using (true);

-- ========== Storage：公开桶 photos（图片由服务端上传） ==========
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = excluded.public;

-- 允许所有人读取该桶内对象（公开展示图片）
drop policy if exists "photos public read" on storage.objects;
create policy "photos public read"
on storage.objects for select
to public
using (bucket_id = 'photos');
