import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl || !serviceKey) {
    throw new Error(
      "缺少环境变量：NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  // 兼容部分环境下 URL 末尾带 :443 导致的 SDK 解析异常。
  const url = rawUrl.replace(/:443(?=\/?$)/, "");

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    // 国内网络偶发握手超时场景：显式指定 fetch 实现（测试/应急用）。
    global: { fetch: (...args) => fetch(...args) },
  });
}
