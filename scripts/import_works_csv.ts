import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

type CsvRow = { title: string; author: string; image_url: string };

function parseCsv(content: string): CsvRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= 1) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idxTitle = header.indexOf("title");
  const idxAuthor = header.indexOf("author");
  const idxImageUrl = header.indexOf("image_url");
  if (idxTitle < 0 || idxAuthor < 0 || idxImageUrl < 0) {
    throw new Error("CSV must include header: title,author,image_url");
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const title = cols[idxTitle] ?? "";
    const author = cols[idxAuthor] ?? "";
    const image_url = cols[idxImageUrl] ?? "";
    if (!title || !image_url) continue;
    rows.push({ title, author, image_url });
  }
  return rows;
}

async function run() {
  const csvPathArg = process.argv[2];
  if (!csvPathArg) {
    throw new Error("Usage: npx --yes tsx scripts/import_works_csv.ts <csv_path>");
  }

  loadEnv(resolve(process.cwd(), ".env.local"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const csvPath = resolve(process.cwd(), csvPathArg);
  const content = readFileSync(csvPath, "utf8");
  const rows = parseCsv(content);
  if (rows.length === 0) {
    console.log("No valid rows found.");
    return;
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const payload = rows.map((r) => ({
    title: r.title,
    author: r.author,
    image_url: r.image_url,
    votes_count: 0,
  }));

  const { error } = await supabase.from("works").insert(payload);
  if (error) throw new Error(`Insert failed: ${error.message}`);

  console.log(`Imported works rows: ${payload.length}`);
}

run().catch((e) => {
  console.error(String(e));
  process.exitCode = 1;
});
