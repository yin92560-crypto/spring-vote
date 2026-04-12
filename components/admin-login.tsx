"use client";

import { useState } from "react";
import {
  getAdminPasswordFromEnv,
  persistAdminSession,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!getAdminPasswordFromEnv()) {
      setError("未配置 NEXT_PUBLIC_ADMIN_PASSWORD，请在 .env.local 中设置");
      return;
    }

    setSubmitting(true);
    try {
      if (!verifyAdminPassword(password)) {
        setError("密码错误");
        return;
      }
      persistAdminSession();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[min(520px,70vh)] w-full flex-col items-center justify-center px-4 py-16">
      <div className="glass-panel w-full max-w-md rounded-3xl px-8 py-10 shadow-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400/90 to-sky-300/90 text-2xl shadow-inner">
            🌸
          </div>
          <h1 className="font-display text-2xl text-rose-950">后台登录</h1>
          <p className="mt-2 text-sm text-rose-800/70">
            捕捉春日计划 · 作品管理
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label
              htmlFor="admin-login-password"
              className="mb-2 block text-sm font-medium text-rose-900"
            >
              管理密码
            </label>
            <input
              id="admin-login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入环境变量中配置的密码"
              className="w-full rounded-xl border border-white/60 bg-white/50 px-4 py-3 text-rose-950 placeholder:text-rose-400/80 outline-none ring-rose-300/50 backdrop-blur-sm focus:ring-2"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-rose-100/80 px-3 py-2 text-sm text-rose-900"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-sakura w-full rounded-xl py-3 text-sm font-medium text-white shadow-md disabled:opacity-60"
          >
            {submitting ? "验证中…" : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
}
