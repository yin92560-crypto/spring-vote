import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type LegacyWork = {
  id: string;
  title?: string | null;
  work_title?: string | null;
  author?: string | null;
  author_name?: string | null;
  image_url?: string | null;
  votes_count?: number | null;
  votes?: number | null;
};

function loadEnv(filePath: string) {
  const raw = readFileSync(filePath, "utf8");
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

async function fetchAllLegacyWorks(oldClient: any) {
  const pageSize = 500;
  let from = 0;
  const all: LegacyWork[] = [];
  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await oldClient
      .from("works")
      .select("*")
      .order("created_at", { ascending: true })
      .range(from, to);
    if (error) throw new Error(`Read old works failed: ${error.message}`);
    const chunk = (data ?? []) as LegacyWork[];
    all.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function run() {
  loadEnv(resolve(process.cwd(), ".env.local"));

  const oldUrl = process.env.OLD_SUPABASE_URL ?? "";
  const oldKey = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY ?? "";
  const newUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const newKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const keepOldVotes = (process.env.MIGRATE_KEEP_OLD_VOTES ?? "0") === "1";

  if (!oldUrl || !oldKey) {
    throw new Error(
      "Missing OLD_SUPABASE_URL or OLD_SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }
  if (!newUrl || !newKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }

  const oldClient = createClient(oldUrl, oldKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const newClient = createClient(newUrl, newKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const allWorks = await fetchAllLegacyWorks(oldClient);
  if (allWorks.length === 0) {
    console.log("No legacy works found.");
    return;
  }
  console.log("First legacy image_url:", allWorks[0]?.image_url ?? "");

  let migrated = 0;
  const batchSize = 200;
  for (let i = 0; i < allWorks.length; i += batchSize) {
    const batch = allWorks.slice(i, i + batchSize).map((w) => ({
      id: w.id,
      title: (w.work_title ?? w.title ?? "").trim() || "未命名作品",
      author: (w.author_name ?? w.author ?? "").trim(),
      // 保留 Cloudflare 原始图片链接，不做域名替换。
      image_url: (w.image_url ?? "").trim(),
      votes_count: keepOldVotes ? Number(w.votes_count ?? w.votes ?? 0) : 0,
    }));

    const { error } = await newClient
      .from("works")
      .upsert(batch, { onConflict: "id" });
    if (error) {
      throw new Error(`Upsert batch failed at ${i}: ${error.message}`);
    }
    migrated += batch.length;
    console.log(`Migrated ${migrated}/${allWorks.length}`);
  }

  console.log(`Migration done. Total migrated rows: ${migrated}`);
}

run().catch((e) => {
  console.error(String(e));
  process.exitCode = 1;
});
