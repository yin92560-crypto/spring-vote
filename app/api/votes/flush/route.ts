import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
// Redis 同步已禁用：该路由保留为 no-op，避免任何 Upstash 请求。

/** 汇总票数写在 public.works 上（标准列 votes_count；历史库可能为 votes），与 lib/supabase-works-columns 探测顺序一致 */

type FlushResult = {
  ok: boolean;
  flushed?: number;
  skipped?: boolean;
  error?: string;
  details?: unknown;
};

async function runFlush(request: Request): Promise<NextResponse<FlushResult>> {
  try {
    const token = process.env.VOTE_SYNC_TOKEN?.trim();
    const authHeader = request.headers.get("x-vote-sync-token");
    const queryToken = new URL(request.url).searchParams.get("token");
    const sent = authHeader ?? queryToken;
    if (token) {
      if (sent !== token) {
        return NextResponse.json(
          {
            ok: false,
            error: "未授权",
            details: "请在 header x-vote-sync-token 或 ?token= 中提供 VOTE_SYNC_TOKEN",
          },
          { status: 401 }
        );
      }
    }

    void createAdminClient();
    return NextResponse.json({
      ok: true,
      skipped: true,
      details: "redis disabled; flush route is no-op",
    });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "服务器错误";
    return NextResponse.json({ ok: false, error: "服务器错误", details: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return runFlush(request);
}

export async function GET(request: Request) {
  try {
    return await runFlush(request);
  } catch (e) {
    const message = e instanceof Error ? e.message : "服务器错误";
    return NextResponse.json({ ok: false, error: "服务器错误", details: message }, { status: 500 });
  }
}
