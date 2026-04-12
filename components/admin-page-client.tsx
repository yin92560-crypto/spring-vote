"use client";

import Link from "next/link";
import { AdminDriveSync } from "@/components/admin-drive-sync";
import { AdminFeishuSync } from "@/components/admin-feishu-sync";
import { SpringLoadingIndicator } from "@/components/spring-loading";
import { useI18n } from "@/lib/i18n-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buildWorkTitleFromFile } from "@/lib/upload-naming";
import { notifyVoteDataChanged } from "@/lib/vote-sync";
import { useWorksList } from "@/lib/use-vote-store";

type AdminPageClientProps = {
  onLogout?: () => void;
};

export function AdminPageClient({ onLogout }: AdminPageClientProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { works, loading } = useWorksList();
  const [titlePrefix, setTitlePrefix] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  /** 已完成张数（上传过程中递增） */
  const [uploadDone, setUploadDone] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [adminSecret, setAdminSecret] = useState("");

  useEffect(() => {
    if (files.length === 0) {
      setPreviews([]);
      return;
    }
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = Array.from(e.target.files ?? []);
    const images = raw.filter((f) => f.type.startsWith("image/"));
    setFiles(images);
    if (images.length < raw.length) {
      setMessage("已跳过非图片文件");
      setTimeout(() => setMessage(null), 2500);
    }
  };

  const clearSelection = () => {
    setFiles([]);
    const input = document.getElementById(
      "admin-files"
    ) as HTMLInputElement | null;
    if (input) input.value = "";
  };

  const adminHeaders = (): HeadersInit => {
    const h: Record<string, string> = {};
    if (adminSecret.trim()) h["x-admin-secret"] = adminSecret.trim();
    return h;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setMessage("请先选择至少一张图片");
      setTimeout(() => setMessage(null), 2000);
      return;
    }

    setUploading(true);
    setUploadTotal(files.length);
    setUploadDone(0);
    setMessage(null);

    let ok = 0;
    const failures: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const title = buildWorkTitleFromFile(file, titlePrefix);
        const fd = new FormData();
        fd.append("title", title);
        fd.append("file", file);

        try {
          const res = await fetch("/api/works", { method: "POST", body: fd });
          const j = (await res.json()) as { ok?: boolean; error?: string };
          if (!res.ok) {
            failures.push(`${file.name}: ${j.error ?? "失败"}`);
          } else {
            ok += 1;
          }
        } catch {
          failures.push(`${file.name}: 网络错误`);
        }
        setUploadDone(i + 1);
      }

      if (ok > 0) {
        notifyVoteDataChanged();
        router.refresh();
      }

      if (failures.length === 0) {
        setMessage(`已成功上传 ${ok} 张`);
      } else {
        setMessage(
          `完成：成功 ${ok} 张，失败 ${failures.length} 张。${failures.slice(0, 3).join("；")}${failures.length > 3 ? "…" : ""}`
        );
      }
      setTimeout(() => setMessage(null), failures.length ? 8000 : 3000);

      clearSelection();
      setTitlePrefix("");
    } finally {
      setUploading(false);
      setUploadTotal(0);
      setUploadDone(0);
    }
  };

  const del = async (id: string) => {
    const res = await fetch(`/api/works/${id}`, {
      method: "DELETE",
      headers: adminHeaders(),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMessage(j.error ?? "删除失败");
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    notifyVoteDataChanged();
    router.refresh();
    setMessage("已删除");
    setTimeout(() => setMessage(null), 2000);
  };

  const resetVotes = async () => {
    const res = await fetch("/api/votes/reset", {
      method: "POST",
      headers: adminHeaders(),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMessage(j.error ?? "操作失败");
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    notifyVoteDataChanged();
    router.refresh();
    setMessage("已清空全部投票记录");
    setTimeout(() => setMessage(null), 2000);
  };

  const progressPct =
    uploadTotal > 0 ? Math.round((uploadDone / uploadTotal) * 100) : 0;

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <div className="glass-panel rounded-3xl px-6 py-12">
          <SpringLoadingIndicator label={t("loadingWorks")} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-rose-950">作品管理</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="rounded-xl border border-rose-200/90 bg-white/35 px-4 py-2 text-sm font-medium text-rose-900 backdrop-blur-md transition hover:bg-rose-50/80"
            >
              退出登录
            </button>
          )}
          <Link
            href="/"
            className="rounded-xl border border-white/60 bg-white/30 px-4 py-2 text-sm font-medium text-rose-900 backdrop-blur-md transition hover:bg-white/50"
          >
            返回首页
          </Link>
        </div>
      </div>

      <div className="glass-panel mb-6 rounded-xl px-4 py-3 text-sm text-rose-900/85">
        <label htmlFor="admin-secret" className="mb-1 block font-medium">
          管理密钥（可选）
        </label>
        <input
          id="admin-secret"
          type="password"
          autoComplete="off"
          value={adminSecret}
          onChange={(e) => setAdminSecret(e.target.value)}
          placeholder="请输入管理员口令"
          className="w-full rounded-lg border border-white/50 bg-white/40 px-3 py-2 text-sm outline-none ring-rose-300/40 focus:ring-2"
        />
      </div>

      {message && (
        <p
          role="status"
          className="glass-panel mb-6 rounded-xl px-4 py-3 text-sm text-rose-900"
        >
          {message}
        </p>
      )}

      <form
        onSubmit={(e) => void submit(e)}
        className="glass-panel mb-10 space-y-6 rounded-3xl p-6 sm:p-8"
      >
        <div>
          <label
            htmlFor="title-prefix"
            className="mb-2 block text-sm font-medium text-rose-900"
          >
            作品名称前缀（可选）
          </label>
          <input
            id="title-prefix"
            value={titlePrefix}
            onChange={(e) => setTitlePrefix(e.target.value)}
            placeholder="选填"
            className="w-full rounded-xl border border-white/60 bg-white/50 px-4 py-3 text-rose-950 placeholder:text-rose-400/80 outline-none ring-rose-300/50 backdrop-blur-sm focus:ring-2"
          />
        </div>

        <AdminDriveSync adminSecret={adminSecret} titlePrefix={titlePrefix} />

        <AdminFeishuSync adminSecret={adminSecret} titlePrefix={titlePrefix} />

        <div>
          <label
            htmlFor="admin-files"
            className="mb-2 block text-sm font-medium text-rose-900"
          >
            上传图片（支持多选）
          </label>
          <input
            id="admin-files"
            type="file"
            accept="image/*"
            multiple
            onChange={onFiles}
            disabled={uploading}
            className="block w-full text-sm text-rose-800 file:mr-4 file:rounded-lg file:border-0 file:bg-pink-200/80 file:px-4 file:py-2 file:text-sm file:font-medium file:text-rose-900 hover:file:bg-pink-200 disabled:opacity-50"
          />
          {files.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-rose-800/85">
                <span>
                  已选 <strong className="text-rose-950">{files.length}</strong>{" "}
                  张
                </span>
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={uploading}
                  className="text-rose-700/90 underline decoration-rose-300 underline-offset-2 hover:text-rose-950 disabled:opacity-50"
                >
                  清空选择
                </button>
              </div>
              <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-white/40 bg-white/25 px-3 py-2 text-xs text-rose-900/90">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex justify-between gap-2">
                    <span className="truncate font-medium">{f.name}</span>
                    <span className="shrink-0 text-rose-700/75">
                      → {buildWorkTitleFromFile(f, titlePrefix)}
                    </span>
                  </li>
                ))}
              </ul>
              {previews.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {previews.slice(0, 12).map((src, i) => (
                    <div
                      key={`thumb-${i}`}
                      className="h-16 w-16 overflow-hidden rounded-lg border border-white/50 bg-rose-50/50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                  {previews.length > 12 && (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-rose-300/60 bg-white/30 text-xs text-rose-800/80">
                      +{previews.length - 12}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {uploading && uploadTotal > 0 && (
          <div
            className="rounded-2xl border border-white/55 bg-gradient-to-r from-rose-50/50 via-white/40 to-sky-50/40 px-4 py-4"
            role="status"
            aria-live="polite"
          >
            <div className="mb-2 flex justify-between text-sm text-rose-900">
              <span>正在上传…</span>
              <span className="tabular-nums font-medium">
                {uploadDone} / {uploadTotal}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-rose-100/80 shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pink-400 via-rose-300 to-sky-300 transition-[width] duration-300 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-rose-800/70">请勿关闭页面</p>
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || files.length === 0}
          className="btn-sakura w-full rounded-xl py-3 text-sm font-medium text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-10"
        >
          {uploading
            ? `上传中 ${uploadDone}/${uploadTotal}…`
            : files.length > 1
              ? `上传 ${files.length} 张作品`
              : files.length === 1
                ? "上传 1 张作品"
                : "选择图片后开始上传"}
        </button>
      </form>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-rose-950">已发布作品</h2>
          {works.length > 0 && (
            <button
              type="button"
              onClick={() => void resetVotes()}
              className="text-sm text-rose-800/80 underline decoration-rose-300 underline-offset-2 hover:text-rose-950"
            >
              清零全部票数
            </button>
          )}
        </div>
        {works.length === 0 ? (
          <p className="text-sm text-rose-800/65">暂无作品</p>
        ) : (
          <ul className="space-y-4">
            {works.map((w) => (
              <li
                key={w.id}
                className="glass-panel flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-rose-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={w.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="shrink-0 rounded-md bg-gradient-to-r from-pink-200/90 to-rose-100/90 px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-rose-950">
                        {w.displayNo}
                      </span>
                      <p className="truncate font-medium text-rose-950">
                        {w.title}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-rose-800/70">
                      得票 {w.votes}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void del(w.id)}
                  className="shrink-0 rounded-lg border border-rose-200/80 bg-white/40 px-3 py-1.5 text-sm text-rose-900 transition hover:bg-rose-50"
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
