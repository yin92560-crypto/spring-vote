"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-sky-200/70 bg-white/85 px-6 py-8 text-center shadow-2xl">
            <p className="text-xl font-semibold text-sky-950">系统提示</p>
            <p className="mt-4 text-base leading-relaxed text-slate-700">
              春日气息太火热，系统正在排队中，请 十分钟后重试
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-6 rounded-xl border border-sky-200 bg-sky-50 px-5 py-2 text-sm font-medium text-sky-900 transition hover:bg-sky-100"
            >
              重新尝试
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
