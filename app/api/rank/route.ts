import { NextResponse } from "next/server";
import { fetchWorksRankedByVotes } from "@/lib/rank-data";

export const revalidate = 300;

export async function GET() {
  try {
    const works = await fetchWorksRankedByVotes();
    return NextResponse.json({ works });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "读取排行榜失败" }, { status: 500 });
  }
}
