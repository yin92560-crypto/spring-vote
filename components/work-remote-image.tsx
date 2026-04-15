"use client";

import { useCallback, useEffect, useState } from "react";

export const WORK_IMAGE_FALLBACK_SRC = "/work-image-fallback.svg";

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
 * 远程作品图：懒加载、加载占位、失败时回退到本地 SVG。
 * 说明：普通 `<img>` 跨域展示一般不触发 CORS 控制台报错；若地址 404/403 或 URL 错误，Network 里可见失败请求。
 */
export function WorkRemoteImage({
  src,
  alt,
  className,
  imgClassName,
  loading = "lazy",
  layout = "fill",
}: Props) {
  const initial = src?.trim() || WORK_IMAGE_FALLBACK_SRC;
  const [resolvedSrc, setResolvedSrc] = useState(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const next = src?.trim() || WORK_IMAGE_FALLBACK_SRC;
    setResolvedSrc(next);
    setLoaded(false);
  }, [src]);

  const handleError = useCallback(() => {
    setResolvedSrc((cur) =>
      cur === WORK_IMAGE_FALLBACK_SRC ? cur : WORK_IMAGE_FALLBACK_SRC,
    );
  }, []);

  const showPlaceholder = !loaded;
  const fill = layout === "fill";

  return (
    <div
      className={cx(
        "relative overflow-hidden",
        fill ? "h-full w-full" : "w-full",
        className,
      )}
      data-work-remote-image
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolvedSrc}
        alt={alt}
        loading={loading}
        decoding="async"
        className={cx(
          "z-[1]",
          fill
            ? "absolute inset-0 h-full w-full"
            : "relative mx-auto block h-auto w-full max-w-full",
          imgClassName,
          loaded ? "opacity-100" : "opacity-0",
          "transition-opacity duration-300 ease-out",
        )}
        onLoad={() => setLoaded(true)}
        onError={handleError}
      />
    </div>
  );
}
