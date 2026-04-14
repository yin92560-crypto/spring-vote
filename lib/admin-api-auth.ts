import { NextResponse } from "next/server";

/**
 * 与 /api/votes/reset、删除作品 一致：若配置了 ADMIN_SECRET，则必须在请求头携带 x-admin-secret。
 */
export function assertAdminAuthorized(request: Request): NextResponse | null {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return null;
  if (request.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  return null;
}

