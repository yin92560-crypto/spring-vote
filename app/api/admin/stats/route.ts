import { NextResponse } from "next/server";

export const revalidate = 60;

/** 管理后台顶部展示的汇总数据（与静态 data.json 等活动口径对齐时可在此维护） */
const ADMIN_DISPLAY_PV = 54324;
const ADMIN_DISPLAY_WORKS = 765;
const ADMIN_DISPLAY_VOTES = 30304;

export async function GET(request: Request) {
  try {
    const secret = process.env.ADMIN_SECRET;
    if (secret) {
      const sent = request.headers.get("x-admin-secret");
      if (sent !== secret) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
      }
    }

    return NextResponse.json({
      pv: ADMIN_DISPLAY_PV,
      works: ADMIN_DISPLAY_WORKS,
      votes: ADMIN_DISPLAY_VOTES,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
