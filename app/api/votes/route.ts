import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/get-client-ip";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CastVoteResult = { ok?: boolean; reason?: string };

type VoteBody = {
  p_work_id?: string;
  workId?: string;
  voterId?: string;
  voter_id?: string;
  /** 历史：部分客户端把浏览器 UUID 放在 voter_ip 字段 */
  voter_ip?: string;
  p_voter_ip?: string;
};

function normalizeRpcResult(data: unknown): CastVoteResult | null {
  if (data === null || data === undefined) return null;
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as CastVoteResult;
      }
    } catch {
      return null;
    }
    return null;
  }
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    return data as CastVoteResult;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    let body: VoteBody;
    try {
      body = (await request.json()) as VoteBody;
    } catch {
      return NextResponse.json({ error: "无效请求" }, { status: 400 });
    }

    /** p_work_id：标准 UUID（作品 id） */
    const rawWorkId = String(body.p_work_id ?? body.workId ?? "").trim();
    const p_work_id = rawWorkId.toLowerCase();
    if (!p_work_id || !UUID_RE.test(p_work_id)) {
      return NextResponse.json({ error: "缺少或无效的作品 id" }, { status: 400 });
    }

    /** p_voter_id：浏览器 localStorage 的 UUID（勿与真实 IP 混淆） */
    const uuidPrimary = String(body.voterId ?? body.voter_id ?? "").trim();
    const uuidLegacy = String(body.voter_ip ?? "").trim();
    const p_voter_id = UUID_RE.test(uuidPrimary)
      ? uuidPrimary
      : UUID_RE.test(uuidLegacy)
        ? uuidLegacy
        : "";

    /** p_voter_ip：用户真实 IP（写入 votes.voter_ip 列） */
    const headerIp = getClientIp(request.headers);
    const p_voter_ip =
      (typeof headerIp === "string" && headerIp.trim() !== ""
        ? headerIp.trim()
        : null) ?? "unknown";

    try {
      const supabase = createAdminClient();
      /**
       * 与数据库函数参数名一致；对象键顺序固定，避免部分环境绑定错位。
       * cast_vote(…, p_voter_id, p_voter_ip, p_work_id) — 以名称匹配为准。
       */
      const { data, error } = await supabase.rpc("cast_vote", {
        p_voter_id,
        p_voter_ip,
        p_work_id,
      });

      if (error) {
        console.error("cast_vote RPC failed:", error);
        const msg = String((error as { message?: string }).message ?? "");
        const code = String((error as { code?: string }).code ?? "");
        if (/limit_reached/i.test(msg) || /limit_reached/i.test(code)) {
          return NextResponse.json(
            { ok: false, reason: "limit_reached" },
            { status: 200 }
          );
        }
        if (/今日投票次数已达上限|已为该作品投过票|次数已达上限/.test(msg)) {
          return NextResponse.json({ ok: false, reason: msg }, { status: 200 });
        }
        return NextResponse.json(
          {
            ok: false,
            reason: "rpc_error",
            error: msg || "投票失败，请稍后重试",
          },
          { status: 200 }
        );
      }

      const rpcData = normalizeRpcResult(data);
      if (!rpcData?.ok) {
        const rawReason =
          typeof rpcData?.reason === "string" ? rpcData.reason : "投票失败";
        const reason =
          /limit_reached/i.test(rawReason) ? "limit_reached" : rawReason;
        return NextResponse.json({ ok: false, reason }, { status: 200 });
      }

      return NextResponse.json({ ok: true });
    } catch (rpcErr) {
      console.error("cast_vote RPC exception:", rpcErr);
      return NextResponse.json(
        { ok: false, reason: "exception", error: "投票失败，请稍后重试" },
        { status: 200 }
      );
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
