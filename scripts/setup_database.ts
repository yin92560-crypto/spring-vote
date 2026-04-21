import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv(envPath: string): void {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let value = t.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const SETUP_SQL = `
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
  voter_id text not null,
  vote_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_votes_work_id on public.votes(work_id);
create index if not exists idx_votes_voter_id_vote_date on public.votes(voter_id, vote_date);

alter table public.works disable row level security;
alter table public.votes disable row level security;
`;

type RpcAttempt = { fn: string; args: Record<string, string> };

async function run() {
  loadEnv(resolve(process.cwd(), ".env.local"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  const key = serviceKey || anonKey;
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const attempts: RpcAttempt[] = [
    { fn: "admin_execute_sql", args: { sql: SETUP_SQL } },
    { fn: "admin_execute_sql", args: { query: SETUP_SQL } },
    { fn: "exec_sql", args: { sql: SETUP_SQL } },
    { fn: "exec_sql", args: { query: SETUP_SQL } },
    { fn: "run_sql", args: { sql: SETUP_SQL } },
    { fn: "run_sql", args: { query: SETUP_SQL } },
    { fn: "sql", args: { sql: SETUP_SQL } },
    { fn: "sql", args: { query: SETUP_SQL } },
  ];

  let lastErr = "";
  let used: string | null = null;
  for (const a of attempts) {
    const { error } = await supabase.rpc(a.fn, a.args);
    if (!error) {
      used = a.fn;
      break;
    }
    lastErr = `${a.fn}: ${error.message}`;
  }

  if (!used) {
    throw new Error(`Failed to execute SQL via RPC. Last error: ${lastErr}`);
  }

  // Validate both tables are accessible.
  const [worksCheck, votesCheck] = await Promise.all([
    supabase.from("works").select("id", { count: "exact", head: true }),
    supabase.from("votes").select("id", { count: "exact", head: true }),
  ]);
  if (worksCheck.error) {
    throw new Error(`works table check failed: ${worksCheck.error.message}`);
  }
  if (votesCheck.error) {
    throw new Error(`votes table check failed: ${votesCheck.error.message}`);
  }

  console.log(`Database setup succeeded via RPC: ${used}`);
  console.log("works and votes are readable with current key.");
}

run().catch((err) => {
  console.error(String(err));
  process.exitCode = 1;
});
