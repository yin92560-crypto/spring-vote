"use client";

import Link from "next/link";
import Image from "next/image";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
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

type AdminStats = {
  pv: number;
  works: number;
  votes: number;
};

const MAX_UPLOAD_BYTES = 500 * 1024;

async function compressImageToWebP(file: File): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("读取图片失败"));
      el.src = url;
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    let bestBlob: Blob | null = null;
    let scale = 1;
    const qualities = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5];

    for (let round = 0; round < 5; round++) {
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      for (const q of qualities) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/webp", q)
        );
        if (!blob) continue;
        bestBlob = blob;
        if (blob.size <= MAX_UPLOAD_BYTES) {
          return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, {
            type: "image/webp",
          });
        }
      }

      scale *= 0.85;
    }

    if (bestBlob) {
      return new File([bestBlob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, {
        type: "image/webp",
      });
    }
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

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
  const [authorName, setAuthorName] = useState("");
  const [workTitle, setWorkTitle] = useState("");
  const [exporting, setExporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWorkTitle, setEditWorkTitle] = useState("");
  const [editAuthorName, setEditAuthorName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [stats, setStats] = useState<AdminStats>({ pv: 0, works: 0, votes: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

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

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/admin/stats", {
        headers: adminHeaders(),
        cache: "no-store",
      });
      if (!res.ok) return;
      const j = (await res.json()) as Partial<AdminStats>;
      setStats({
        pv: Number(j.pv ?? 0),
        works: Number(j.works ?? 0),
        votes: Number(j.votes ?? 0),
      });
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    void fetchStats();
  }, [adminSecret]);

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
        const uploadFile = await compressImageToWebP(file);
        const uploadFd = new FormData();
        uploadFd.append("file", uploadFile);
        uploadFd.append("folder", "works");

        try {
          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: uploadFd,
          });
          const uploadJson = (await uploadRes.json()) as {
            ok?: boolean;
            error?: string;
            url?: string;
            key?: string;
          };
          if (!uploadRes.ok || !uploadJson.url || !uploadJson.key) {
            failures.push(`${file.name}: ${uploadJson.error ?? "R2 上传失败"}`);
            setUploadDone(i + 1);
            continue;
          }

          const res = await fetch("/api/works", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              workTitle: workTitle.trim() || title,
              authorName: authorName.trim(),
              imageUrl: uploadJson.url,
              imagePath: uploadJson.key,
            }),
          });
          const j = (await res.json()) as { ok?: boolean; error?: string };
          if (!res.ok) {
            failures.push(`${file.name}: ${j.error ?? "保存失败"}`);
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
        void fetchStats();
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
      setWorkTitle("");
      setAuthorName("");
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
    void fetchStats();
    setMessage("已删除");
    setTimeout(() => setMessage(null), 2000);
  };

  const openEdit = (w: (typeof works)[number]) => {
    setEditingId(w.id);
    setEditWorkTitle((w.workTitle || w.title || "").trim());
    setEditAuthorName((w.authorName || "").trim());
  };

  const closeEdit = () => {
    setEditingId(null);
    setEditWorkTitle("");
    setEditAuthorName("");
    setSavingEdit(false);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const safeTitle = editWorkTitle.trim();
    if (!safeTitle) {
      setMessage("作品名称不能为空");
      setTimeout(() => setMessage(null), 2200);
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/works/${editingId}`, {
        method: "PATCH",
        headers: {
          ...adminHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workTitle: safeTitle,
          authorName: editAuthorName.trim(),
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(j.error ?? "修改失败");
        setTimeout(() => setMessage(null), 3000);
        return;
      }

      notifyVoteDataChanged();
      router.refresh();
      void fetchStats();
      closeEdit();
      setMessage("修改成功");
      setTimeout(() => setMessage(null), 2000);
    } finally {
      setSavingEdit(false);
    }
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
    void fetchStats();
    setMessage("已清空全部投票记录");
    setTimeout(() => setMessage(null), 2000);
  };

  const formatDateTime = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const exportVotesExcel = () => {
    if (works.length === 0) {
      setMessage("暂无可导出的作品数据");
      setTimeout(() => setMessage(null), 2200);
      return;
    }
    setExporting(true);
    try {
      const sorted = [...works].sort((a, b) => b.votes - a.votes);
      const rows = sorted.map((w) => ({
        作品编号: w.displayNo,
        参赛人: w.authorName || "",
        作品名称: w.workTitle || w.title || "",
        当前票数: w.votes,
        上传时间: formatDateTime(w.createdAt),
      }));
      const ws = XLSX.utils.json_to_sheet(rows, {
        header: ["作品编号", "参赛人", "作品名称", "当前票数", "上传时间"],
      });

      const headerKeys = ["A1", "B1", "C1", "D1", "E1"] as const;
      for (const key of headerKeys) {
        if (!ws[key]) continue;
        ws[key].s = {
          font: { bold: true },
          alignment: { horizontal: "center", vertical: "center" },
        };
      }
      ws["!cols"] = [
        { wch: 10 },
        { wch: 14 },
        { wch: 28 },
        { wch: 10 },
        { wch: 22 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "投票明细");
      const stamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replaceAll("-", "")
        .replaceAll(":", "")
        .replace("T", "-");
      XLSX.writeFileXLSX(wb, `vote-details-${stamp}.xlsx`);
      setMessage("导出成功，已下载 Excel");
      setTimeout(() => setMessage(null), 2500);
    } catch (e) {
      console.error(e);
      setMessage("导出失败，请稍后重试");
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setExporting(false);
    }
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
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3 sm:mb-8 sm:gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Image
              src="/huaqin-logo-new.png"
              alt="华勤 Logo"
              width={92}
              height={30}
              className="h-7 w-auto rounded-md"
              priority
            />
          </div>
          <h1 className="font-display text-2xl font-semibold text-[#4a2f22] sm:text-3xl">作品管理</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="rounded-xl border border-stone-200/90 bg-white/35 px-4 py-2 text-sm font-medium text-stone-900 backdrop-blur-md transition hover:bg-stone-50/80"
            >
              退出登录
            </button>
          )}
          <Link
            href="/"
            className="rounded-xl border border-white/60 bg-white/30 px-3.5 py-2 text-sm font-medium text-stone-900 backdrop-blur-md transition hover:bg-white/50 sm:px-4"
          >
            返回首页
          </Link>
        </div>
      </div>

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-emerald-200/70 bg-white/60 px-4 py-4 shadow-[0_0_18px_rgba(134,196,149,0.25)] backdrop-blur-sm">
          <p className="text-xs font-semibold tracking-wide text-[#4a2f22]/70">
            总浏览量 (PV)
          </p>
          <p className="mt-2 text-3xl font-black tabular-nums text-[#4a2f22]">
            {statsLoading ? "…" : stats.pv}
          </p>
        </article>
        <article className="rounded-2xl border border-emerald-200/70 bg-white/60 px-4 py-4 shadow-[0_0_18px_rgba(155,209,165,0.22)] backdrop-blur-sm">
          <p className="text-xs font-semibold tracking-wide text-[#4a2f22]/70">
            参赛作品总数
          </p>
          <p className="mt-2 text-3xl font-black tabular-nums text-[#4a2f22]">
            {statsLoading ? "…" : stats.works}
          </p>
        </article>
        <article className="rounded-2xl border border-amber-200/70 bg-white/60 px-4 py-4 shadow-[0_0_18px_rgba(251,191,36,0.2)] backdrop-blur-sm">
          <p className="text-xs font-semibold tracking-wide text-[#4a2f22]/70">
            累计投票数
          </p>
          <p className="mt-2 text-3xl font-black tabular-nums text-[#4a2f22]">
            {statsLoading ? "…" : stats.votes}
          </p>
        </article>
      </section>

      <div className="glass-panel mb-6 rounded-xl px-4 py-3 text-sm text-stone-900/85">
        <label htmlFor="admin-secret" className="mb-1 block font-semibold text-[#4a2f22]">
          管理密钥（可选）
        </label>
        <input
          id="admin-secret"
          type="password"
          autoComplete="off"
          value={adminSecret}
          onChange={(e) => setAdminSecret(e.target.value)}
          placeholder="请输入管理员口令"
          className="w-full rounded-lg border border-green-200 bg-white/50 px-3 py-2 text-sm text-[#4a2f22] placeholder:text-stone-500/70 outline-none ring-green-200/50 focus:ring-2"
        />
      </div>

      {message && (
        <p
          role="status"
          className="glass-panel mb-6 rounded-xl px-4 py-3 text-sm text-stone-900"
        >
          {message}
        </p>
      )}

      <form
        onSubmit={(e) => void submit(e)}
        className="glass-panel mb-10 space-y-6 rounded-[1.6rem] p-6 sm:p-8"
      >
        <div>
          <label
            htmlFor="title-prefix"
            className="mb-2 block text-sm font-semibold text-[#4a2f22]"
          >
            作品名称前缀（可选）
          </label>
          <input
            id="title-prefix"
            value={titlePrefix}
            onChange={(e) => setTitlePrefix(e.target.value)}
            placeholder="选填"
            className="w-full rounded-xl border border-green-200 bg-white/50 px-4 py-3 text-[#4a2f22] placeholder:text-stone-500/75 outline-none ring-green-200/50 backdrop-blur-sm focus:ring-2"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="author-name"
              className="mb-2 block text-sm font-semibold text-[#4a2f22]"
            >
              参赛人姓名
            </label>
            <input
              id="author-name"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="请输入参赛人姓名"
              className="w-full rounded-xl border border-green-200 bg-white/50 px-4 py-3 text-sm font-semibold text-[#4a2f22] placeholder:text-stone-500/75 outline-none ring-green-200/50 backdrop-blur-sm focus:border-green-300 focus:ring-2"
            />
          </div>
          <div>
            <label
              htmlFor="work-title"
              className="mb-2 block text-sm font-semibold text-[#4a2f22]"
            >
              作品名称
            </label>
            <input
              id="work-title"
              value={workTitle}
              onChange={(e) => setWorkTitle(e.target.value)}
              placeholder="请输入作品名称（可选）"
              className="w-full rounded-xl border border-green-200 bg-white/50 px-4 py-3 text-sm font-semibold text-[#4a2f22] placeholder:text-stone-500/75 outline-none ring-green-200/50 backdrop-blur-sm focus:border-green-300 focus:ring-2"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="admin-files"
            className="mb-2 block text-sm font-semibold text-[#4a2f22]"
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
            className="block w-full text-sm text-stone-800 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-200/80 file:px-4 file:py-2 file:text-sm file:font-medium file:text-stone-900 hover:file:bg-amber-200 disabled:opacity-50"
          />
          {files.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-stone-800/85">
                <span>
                  已选 <strong className="text-stone-950">{files.length}</strong>{" "}
                  张
                </span>
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={uploading}
                  className="text-stone-700/90 underline decoration-stone-300 underline-offset-2 hover:text-stone-950 disabled:opacity-50"
                >
                  清空选择
                </button>
              </div>
              <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-white/40 bg-white/25 px-3 py-2 text-xs text-stone-900/90">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex justify-between gap-2">
                    <span className="truncate font-medium">{f.name}</span>
                    <span className="shrink-0 text-stone-700/75">
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
                      className="h-16 w-16 overflow-hidden rounded-lg border border-white/50 bg-stone-50/50"
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
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-stone-300/60 bg-white/30 text-xs text-stone-800/80">
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
            className="rounded-[1.15rem] border border-white/55 bg-gradient-to-r from-stone-50/50 via-white/40 to-teal-50/40 px-4 py-4"
            role="status"
            aria-live="polite"
          >
            <div className="mb-2 flex justify-between text-sm text-stone-900">
              <span>正在上传…</span>
              <span className="tabular-nums font-medium">
                {uploadDone} / {uploadTotal}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-stone-100/80 shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-stone-200 to-teal-200 transition-[width] duration-300 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-stone-800/70">请勿关闭页面</p>
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || files.length === 0}
          className="btn-sakura w-full rounded-xl py-3 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-10"
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
          <h2 className="text-lg font-semibold text-[#4a2f22]">已发布作品</h2>
          <div className="flex flex-wrap items-center gap-3">
            {works.length > 0 && (
              <button
                type="button"
                onClick={() => exportVotesExcel()}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200/70 bg-white/45 px-3.5 py-2 text-sm font-medium text-[#5b1f3f] shadow-sm backdrop-blur-md transition hover:bg-white/65 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="size-4" aria-hidden />
                {exporting ? "导出中…" : "导出 Excel"}
              </button>
            )}
            {works.length > 0 && (
              <button
                type="button"
                onClick={() => void resetVotes()}
                className="text-sm text-stone-800/80 underline decoration-stone-300 underline-offset-2 hover:text-stone-950"
              >
                清零全部票数
              </button>
            )}
          </div>
        </div>
        {works.length === 0 ? (
          <p className="text-sm text-stone-800/65">暂无作品</p>
        ) : (
          <ul className="space-y-4">
            {works.map((w) => (
              <li
                key={w.id}
                className="glass-panel flex flex-col gap-4 rounded-[1.15rem] p-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={w.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="shrink-0 rounded-md bg-gradient-to-r from-emerald-200/90 to-stone-100/90 px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-stone-950">
                        {w.displayNo}
                      </span>
                      <p className="truncate font-semibold text-[#4a2f22]">
                        {w.workTitle || w.title}
                      </p>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[#4a2f22]/80">
                      参赛人：{w.authorName || "-"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#4a2f22]/85">
                      得票 {w.votes}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(w)}
                    className="rounded-lg border border-emerald-200/80 bg-white/55 px-3 py-1.5 text-sm font-medium text-[#4a2f22] transition hover:bg-emerald-50/70"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => void del(w.id)}
                    className="rounded-lg border border-stone-200/80 bg-white/40 px-3 py-1.5 text-sm text-stone-900 transition hover:bg-stone-50"
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {editingId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="关闭编辑弹窗"
            className="absolute inset-0 bg-black/28 backdrop-blur-[2px]"
            onClick={closeEdit}
          />
          <div className="glass-panel relative z-[1] w-full max-w-md rounded-2xl p-5 shadow-2xl sm:p-6">
            <h3 className="text-lg font-semibold text-[#4a2f22]">编辑作品信息</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#4a2f22]">
                  作品名称
                </label>
                <input
                  value={editWorkTitle}
                  onChange={(e) => setEditWorkTitle(e.target.value)}
                  className="w-full rounded-xl border border-green-200 bg-white/50 px-4 py-2.5 text-sm font-semibold text-[#4a2f22] placeholder:text-stone-500/70 outline-none ring-green-200/50 focus:ring-2"
                  placeholder="请输入作品名称"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#4a2f22]">
                  参赛人姓名
                </label>
                <input
                  value={editAuthorName}
                  onChange={(e) => setEditAuthorName(e.target.value)}
                  className="w-full rounded-xl border border-green-200 bg-white/50 px-4 py-2.5 text-sm font-semibold text-[#4a2f22] placeholder:text-stone-500/70 outline-none ring-green-200/50 focus:ring-2"
                  placeholder="请输入参赛人姓名"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-lg border border-stone-200/80 bg-white/55 px-4 py-2 text-sm font-medium text-stone-700"
              >
                取消
              </button>
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => void saveEdit()}
                className="rounded-lg border border-emerald-200/75 bg-amber-100/80 px-4 py-2 text-sm font-semibold text-[#4a2f22] disabled:opacity-50"
              >
                {savingEdit ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
