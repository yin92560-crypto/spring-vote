"use client";

import { useEffect, useState } from "react";

function cx(...parts: (string | false | undefined | null)[]) {
  return parts.filter(Boolean).join(" ");
}

type Props = {
  src: string | null | undefined;
  alt: string;
  /** 外层容器，默认铺满父级（父级需为 `relative` 且给出高度） */
  className?: string;
  /** 追加到 `<img>` 的类名，例如 `object-cover`、hover 动效等 */
  imgClassName?: string;
  loading?: "lazy" | "eager";
  /**
   * `fill`：缩略图铺满父容器（默认，`img` 绝对定位）。
   * `intrinsic`：按图片比例占位（弹窗大图等），外层请带上 `min-h-*` / `max-h-*` 以免高度塌陷。
   */
  layout?: "fill" | "intrinsic";
};

/**
 * 远程作品图：直接使用接口下发的绝对 URL；加载占位；失败时仅显示占位（不加载备用 SVG，便于排查 R2）。
 */
export function WorkRemoteImage({
  src,
  alt,
  className,
  imgClassName,
  loading = "lazy",
  layout = "fill",
}: Props) {
  const primaryUrl = (src ?? "").trim();
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setBroken(false);
    setLoaded(false);
  }, [primaryUrl]);

  const showPlaceholder = Boolean(primaryUrl) && !loaded && !broken;
  const fill = layout === "fill";

  return (
    <div
      className={cx(
        "relative overflow-hidden",
        fill ? "h-full w-full" : "w-full",
        className,
      )}
      data-work-remote-image
      data-img-src={primaryUrl || undefined}
    >
      {showPlaceholder && (
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-stone-100 via-stone-50/90 to-teal-50/35"
          aria-hidden
        >
          <div className="absolute inset-0 animate-pulse bg-stone-200/20" />
          <div
            className="work-remote-image-shimmer absolute inset-y-0 -left-1/3 w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/45 to-transparent opacity-70"
            aria-hidden
          />
        </div>
      )}
      {!primaryUrl ? (
        <div
          className={cx(
            "z-[1] bg-gradient-to-br from-stone-100 via-stone-50/90 to-teal-50/35",
            fill
              ? "absolute inset-0 h-full w-full"
              : "relative mx-auto block min-h-[4rem] w-full max-w-full",
            imgClassName,
          )}
          aria-hidden
        />
      ) : broken ? (
        <div
          className={cx(
            "z-[1] flex items-center justify-center bg-stone-200/35 text-center text-xs text-stone-600/90",
            fill
              ? "absolute inset-0 h-full w-full"
              : "relative mx-auto flex min-h-[4rem] w-full max-w-full flex-col gap-1 px-2 py-4",
            imgClassName,
          )}
          role="img"
          aria-label={alt}
        >
          <span className="font-medium text-stone-700">图片加载失败</span>
          <span className="break-all text-[10px] leading-tight text-stone-500/90">
            {primaryUrl}
          </span>
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={primaryUrl}
          alt={alt}
          loading={loading}
          decoding="async"
          className={cx(
            "z-[1] opacity-100",
            fill
              ? "absolute inset-0 h-full w-full"
              : "relative mx-auto block h-auto w-full max-w-full",
            imgClassName,
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(true)}
        />
      )}
    </div>
  );
}
