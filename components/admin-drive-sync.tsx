"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { notifyVoteDataChanged } from "@/lib/vote-sync";

type Props = {
  adminSecret: string;
  /** 与手动上传表单一致，作为作品标题前缀 */
  titlePrefix: string;
};

export function AdminDriveSync({ adminSecret, titlePrefix }: Props) {
  const router = useRouter();
  const [folderUrl, setFolderUrl] = useState("");
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
    if (!folderUrl.trim()) {
      setMessage("请先粘贴 Google Drive 文件夹链接");
      setTimeout(() => setMessage(null), 3200);
      return;
    }
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/sync-google-drive", {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          folderUrl: folderUrl.trim(),
          titlePrefix,
        }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        imported?: number;
        skipped?: number;
        totalListed?: number;
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
          ? ` ${j.errors.slice(0, 4).join("；")}${j.errors.length > 4 ? "…" : ""}`
          : "";
      setMessage(
        `完成：列出 ${j.totalListed ?? 0} 张图片，成功导入 ${j.imported ?? 0} 张，跳过 ${j.skipped ?? 0} 张。${errTail}`
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
    <section className="glass-panel mb-10 rounded-3xl border border-sky-200/50 bg-gradient-to-br from-sky-50/45 via-white/50 to-cyan-50/35 p-6 shadow-sm backdrop-blur-md sm:p-8">
      <h2 className="font-display text-xl font-medium text-sky-950">
        云文档同步
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-sky-900/80">
        支持{" "}
        <strong className="font-semibold text-sky-950">Google Drive</strong>
        。请将文件夹共享给服务账号邮箱（查看者即可），再粘贴链接同步。
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="drive-folder-url"
            className="mb-2 block text-sm font-medium text-sky-950"
          >
            文件夹链接或 ID
          </label>
          <input
            id="drive-folder-url"
            type="url"
            value={folderUrl}
            onChange={(e) => setFolderUrl(e.target.value)}
            disabled={syncing}
            placeholder="https://drive.google.com/drive/folders/xxxxxxxxxxxxx"
            className="w-full rounded-xl border border-sky-200/60 bg-white/55 px-4 py-3 text-sm text-sky-950 placeholder:text-sky-400/90 outline-none ring-sky-300/40 backdrop-blur-sm transition focus:border-sky-400/80 focus:ring-2 disabled:opacity-60"
            autoComplete="off"
          />
        </div>

        {syncing && (
          <div
            className="rounded-2xl border border-sky-200/40 bg-white/40 px-4 py-4 backdrop-blur-sm"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <p className="mb-3 text-sm font-medium text-sky-950">
              正在从云端搬运照片…
            </p>
            <div className="admin-sync-progress-track">
              <div className="admin-sync-progress-bar" />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => void runSync()}
          disabled={syncing || !folderUrl.trim()}
          className="w-full rounded-xl border border-sky-300/60 bg-gradient-to-r from-sky-400/90 via-cyan-400/85 to-sky-500/90 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
        >
          {syncing ? "同步中…" : "开始从云端同步"}
        </button>

        {message && !syncing && (
          <p
            role="status"
            className="rounded-xl border border-sky-200/50 bg-white/45 px-4 py-3 text-sm leading-relaxed text-sky-950"
          >
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
