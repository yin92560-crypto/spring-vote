import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const HISTORICAL_PV = 14047;

export async function POST(request: Request) {
  void request;
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("votes")
    .select("*", { count: "exact", head: true });
  if (error) {
    console.error("pv votes count failed:", error);
  }
  const votes = Number(count ?? 0);
  return NextResponse.json({
    ok: true,
    pageViews: HISTORICAL_PV + votes,
    static: false,
  });
}
