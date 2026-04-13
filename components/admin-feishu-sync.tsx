"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { notifyVoteDataChanged } from "@/lib/vote-sync";

type Props = {
  adminSecret: string;
  titlePrefix: string;
  authorName: string;
  workTitle: string;
};

export function AdminFeishuSync({
  adminSecret,
  titlePrefix,
  authorName,
  workTitle,
}: Props) {
  const router = useRouter();
  const [tableUrl, setTableUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const buildHeaders = (): HeadersInit => {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (adminSecret.trim()) h["x-admin-secret"] = adminSecret.trim();
    return h;
  };

  const runSync = async () => {
    if (!tableUrl.trim()) {
      setMessage("请粘贴多维表格链接");
      setTimeout(() => setMessage(null), 3200);
      return;
    }
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sync-feishu", {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          tableUrl: tableUrl.trim(),
          titlePrefix,
          authorName,
          workTitle,
        }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        imported?: number;
        skipped?: number;
        totalImages?: number;
        errors?: string[];
      };
      if (!res.ok) {
        setMessage(j.error ?? "同步失败");
        setTimeout(() => setMessage(null), 8000);
        return;
      }
      if ((j.imported ?? 0) > 0) {
        notifyVoteDataChanged();
        router.refresh();
      }
      const errTail =
        j.errors && j.errors.length > 0
          ? ` ${j.errors.slice(0, 5).join("；")}${j.errors.length > 5 ? "…" : ""}`
          : "";
      setMessage(
        `完成：识别 ${j.totalImages ?? 0} 张图片，成功导入 ${j.imported ?? 0} 张，跳过 ${j.skipped ?? 0} 张。${errTail}`
      );
      setTimeout(() => setMessage(null), 12000);
    } catch {
      setMessage("网络错误，请稍后重试");
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section className="glass-panel mb-10 rounded-3xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/45 via-white/50 to-cyan-50/35 p-6 shadow-sm backdrop-blur-md sm:p-8">
      <h2 className="font-display text-xl font-semibold text-[#4a2f22]">
        飞书一键导入
      </h2>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-[#4a2f22]/80">
        从飞书多维表格读取「附件」列中的图片，写入作品库。请确保应用已开通多维表格与云文档相关权限。
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="feishu-table-url"
            className="mb-2 block text-sm font-semibold text-[#4a2f22]"
          >
            多维表格链接
          </label>
          <input
            id="feishu-table-url"
            type="url"
            value={tableUrl}
            onChange={(e) => setTableUrl(e.target.value)}
            disabled={syncing}
            placeholder="https://xxx.feishu.cn/base/xxxxxxxxxx?table=tblxxxx"
            className="w-full rounded-xl border border-green-200 bg-white/50 px-4 py-3 text-sm font-semibold text-[#4a2f22] placeholder:text-stone-500/70 outline-none ring-green-200/50 backdrop-blur-sm transition focus:border-green-300 focus:ring-2 disabled:opacity-60"
            autoComplete="off"
          />
        </div>

        {syncing && (
          <div
            className="rounded-2xl border border-emerald-200/40 bg-white/40 px-4 py-4 backdrop-blur-sm"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <p className="mb-3 text-sm font-medium text-teal-950">
              正在从飞书同步作品…
            </p>
            <div className="admin-sync-progress-track">
              <div className="admin-sync-progress-bar" />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => void runSync()}
          disabled={syncing || !tableUrl.trim()}
          className="w-full rounded-xl border border-emerald-200/60 bg-gradient-to-r from-emerald-300/85 via-emerald-200/80 to-teal-300/80 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
        >
          {syncing ? "同步中…" : "开始同步"}
        </button>

        {message && !syncing && (
          <p
            role="status"
            className="rounded-xl border border-emerald-200/50 bg-white/45 px-4 py-3 text-sm leading-relaxed text-teal-950"
          >
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
