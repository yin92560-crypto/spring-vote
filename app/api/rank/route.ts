import { NextResponse } from "next/server";
import { fetchWorksRankedByVotes } from "@/lib/rank-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const works = await fetchWorksRankedByVotes();
    return NextResponse.json({ works });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "读取排行榜失败" }, { status: 500 });
  }
}
