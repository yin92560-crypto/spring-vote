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

-- 投票表：每条记录为一票；device_fingerprint 可选归档，日限额由前端 localStorage 控制
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works (id) on delete cascade,
  voter_ip text not null,
  device_fingerprint text,
  vote_date date not null,
  created_at timestamptz not null default now()
);

alter table public.votes add column if not exists device_fingerprint text;
alter table public.votes add column if not exists voter_client_id text;
create index if not exists idx_votes_ip_date on public.votes (voter_ip, vote_date);
create index if not exists idx_votes_device_fingerprint_date on public.votes (device_fingerprint, vote_date);
create index if not exists idx_votes_work_id on public.votes (work_id);
create index if not exists idx_votes_voter_ip_created_at on public.votes (voter_ip, created_at desc);

-- 作品累计票数列：标准名为 votes_count。若历史库误用 works.votes（与表 public.votes 不同），重命名为 votes_count。
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'works' and column_name = 'votes_count'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'works' and column_name = 'votes'
    ) then
      alter table public.works rename column votes to votes_count;
    else
      alter table public.works add column votes_count integer not null default 0;
    end if;
  end if;
end $$;

-- 若后续引入登录用户字段 user_id，则自动补齐 user_id + created_at 索引（避免 count/范围查询慢）
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'votes'
      and column_name = 'user_id'
  ) then
    execute 'create index if not exists idx_votes_user_id_created_at on public.votes (user_id, created_at desc)';
  end if;
end $$;

-- 原子投票：仅校验作品存在并落库；每日 3 票由浏览器 localStorage 控制；p_voter_ip 日志；p_voter_id 为浏览器 UUID
drop function if exists public.cast_vote(uuid, text, text);
drop function if exists public.cast_vote(uuid, text);
create or replace function public.cast_vote (
  p_work_id uuid,
  p_voter_ip text,
  p_voter_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('Asia/Shanghai', now()))::date;
  v_total int;
  v_col text;
  v_ip text := coalesce(nullif(trim(p_voter_ip), ''), 'unknown');
  v_client text := nullif(trim(p_voter_id), '');
begin
  if not exists (select 1 from public.works where id = p_work_id) then
    return jsonb_build_object('ok', false, 'reason', '作品不存在');
  end if;

  insert into public.votes (work_id, voter_ip, device_fingerprint, vote_date, voter_client_id)
  values (p_work_id, v_ip, null, v_today, v_client);

  select count(*)::int into v_total
  from public.votes v where v.work_id = p_work_id;

  select c.column_name into v_col
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'works'
    and c.column_name in ('votes_count', 'votes')
  order by case c.column_name when 'votes_count' then 0 else 1 end
  limit 1;

  if v_col is null then
    return jsonb_build_object('ok', false, 'reason', '作品表缺少汇总列 votes_count 或 votes');
  end if;

  execute format(
    'update public.works w set %I = $1 where w.id = $2',
    v_col
  ) using v_total, p_work_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- 仅允许 service_role 调用（与 Next.js 服务端 API 使用的密钥一致）
revoke all on function public.cast_vote (uuid, text, text) from public;
grant execute on function public.cast_vote (uuid, text, text) to service_role;

-- 将 Redis 桶内票数一次性写入 votes，并在同一事务内累加 works.votes_count（避免只写子表导致不同步）
create or replace function public.apply_redis_vote_flush (
  p_work_id uuid,
  p_vote_date date,
  p_count int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i int;
  v_total int;
  v_col text;
begin
  if p_count is null or p_count <= 0 then
    return jsonb_build_object('ok', true, 'inserted', 0);
  end if;

  if not exists (select 1 from public.works where id = p_work_id) then
    return jsonb_build_object('ok', false, 'reason', '作品不存在');
  end if;

  for i in 1..p_count loop
    insert into public.votes (work_id, voter_ip, vote_date)
    values (p_work_id, 'redis-sync', p_vote_date);
  end loop;

  select count(*)::int into v_total
  from public.votes v where v.work_id = p_work_id;

  select c.column_name into v_col
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'works'
    and c.column_name in ('votes_count', 'votes')
  order by case c.column_name when 'votes_count' then 0 else 1 end
  limit 1;

  if v_col is null then
    return jsonb_build_object('ok', false, 'reason', '作品表缺少汇总列 votes_count 或 votes');
  end if;

  execute format(
    'update public.works w set %I = $1 where w.id = $2',
    v_col
  ) using v_total, p_work_id;

  return jsonb_build_object('ok', true, 'inserted', p_count, 'tally_column', v_col);
end;
$$;

revoke all on function public.apply_redis_vote_flush (uuid, date, int) from public;
grant execute on function public.apply_redis_vote_flush (uuid, date, int) to service_role;

-- 与已有 votes 行对齐（可重复执行；列名 votes_count 或 votes）
do $$
declare
  v_col text;
begin
  select c.column_name into v_col
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'works'
    and c.column_name in ('votes_count', 'votes')
  order by case c.column_name when 'votes_count' then 0 else 1 end
  limit 1;
  if v_col is not null then
    execute format(
      'update public.works w set %I = coalesce((select count(*)::int from public.votes v where v.work_id = w.id), 0)',
      v_col
    );
  else
    raise notice 'works: skip tally backfill (no votes_count/votes column)';
  end if;
end $$;

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
