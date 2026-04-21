import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFromFile(envPath: string): void {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx <= 0) continue;
    const key = t.slice(0, idx).trim();
    let value = t.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const SQL = `
create extension if not exists pgcrypto;

create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  author text not null default '',
  image_url text not null,
  votes_count integer not null default 0
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  voter_ip text not null,
  vote_date date not null,
  created_at timestamptz not null default now(),
  voter_client_id text
);

create index if not exists idx_votes_work_id on public.votes(work_id);
create index if not exists idx_votes_voter_ip_vote_date on public.votes(voter_ip, vote_date);
create index if not exists idx_votes_voter_client_id_vote_date on public.votes(voter_client_id, vote_date)
  where voter_client_id is not null;

drop function if exists public.cast_vote(text, text, uuid);
drop function if exists public.cast_vote(uuid, text, text);
create or replace function public.cast_vote (
  p_voter_id text,
  p_voter_ip text,
  p_work_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('Asia/Shanghai', now()))::date;
  v_total int;
  v_ip text := coalesce(nullif(trim(p_voter_ip), ''), 'unknown');
  v_client text := nullif(trim(p_voter_id), '');
  v_day_distinct int;
begin
  if not exists (select 1 from public.works where id = p_work_id) then
    return jsonb_build_object('ok', false, 'reason', '作品不存在');
  end if;

  if v_client is not null then
    if exists (
      select 1 from public.votes
      where work_id = p_work_id and voter_client_id = v_client and vote_date = v_today
    ) then
      return jsonb_build_object('ok', false, 'reason', '今日已为该作品投过票');
    end if;

    select count(distinct work_id)::int into v_day_distinct
    from public.votes
    where voter_client_id = v_client and vote_date = v_today;

    if coalesce(v_day_distinct, 0) >= 3 then
      return jsonb_build_object('ok', false, 'reason', 'limit_reached');
    end if;
  end if;

  insert into public.votes (work_id, voter_ip, vote_date, voter_client_id)
  values (p_work_id, v_ip, v_today, v_client);

  select count(*)::int into v_total from public.votes where work_id = p_work_id;
  update public.works set votes_count = v_total where id = p_work_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.cast_vote (text, text, uuid) from public;
grant execute on function public.cast_vote (text, text, uuid) to service_role;
`;

async function run() {
  loadEnvFromFile(resolve(process.cwd(), ".env.local"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const attempts: Array<{ fn: string; args: Record<string, string> }> = [
    { fn: "exec_sql", args: { sql: SQL } },
    { fn: "exec_sql", args: { query: SQL } },
    { fn: "run_sql", args: { sql: SQL } },
    { fn: "run_sql", args: { query: SQL } },
    { fn: "sql", args: { sql: SQL } },
    { fn: "sql", args: { query: SQL } },
  ];

  let lastError = "";
  for (const attempt of attempts) {
    const { data, error } = await supabase.rpc(attempt.fn, attempt.args);
    if (!error) {
      console.log(`Database initialized via rpc("${attempt.fn}")`);
      if (data !== null && data !== undefined) {
        console.log("rpc result:", JSON.stringify(data));
      }
      return;
    }
    lastError = `${attempt.fn}: ${error.message}`;
  }

  throw new Error(
    `No SQL-exec RPC available in current project. Last error: ${lastError}`
  );
}

run().catch((err) => {
  console.error(String(err));
  process.exitCode = 1;
});
