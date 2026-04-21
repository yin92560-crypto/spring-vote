import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  void request;
  return NextResponse.json({
    ok: true,
    pageViews: 1,
    static: true,
  });
}
