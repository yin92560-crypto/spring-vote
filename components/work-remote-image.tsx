"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { withImageLoadRetryQuery } from "@/lib/work-image-client";

function cx(...parts: (string | false | undefined | null)[]) {
  return parts.filter(Boolean).join(" ");
}

type Props = {
  src: string | null | undefined;
  alt: string;
  /** 外层容器，默认铺满父级（父级需为 `relative` 且给出高度） */
  className?: string;
  /** 追加到 `<Image>` 的类名，例如 `object-cover`、hover 动效等 */
  imgClassName?: string;
  loading?: "lazy" | "eager";
  /**
   * `fill`：缩略图铺满父容器（默认）。
   * `intrinsic`：弹窗大图等，使用固定 intrinsic 尺寸 + max 约束。
   */
  layout?: "fill" | "intrinsic";
  /** 仅 `layout="fill"` 时传给 next/image 的 sizes */
  sizes?: string;
};

const DEFAULT_FILL_SIZES =
  "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";

/**
 * 作品远程图：`next/image` + `unoptimized` 直链 R2；https + 失败时同 URL 带参重试一次。
 */
export function WorkRemoteImage({
  src,
  alt,
  className,
  imgClassName,
  loading = "lazy",
  layout = "fill",
  sizes = DEFAULT_FILL_SIZES,
}: Props) {
  const primaryUrl = (src ?? "").trim();
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  /** 0 首次；1 带参重试；≥2 两次失败后标记 broken */
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    setBroken(false);
    setLoaded(false);
    setErrorCount(0);
  }, [primaryUrl]);

  useEffect(() => {
    if (errorCount >= 2) setBroken(true);
  }, [errorCount]);

  const displaySrc =
    primaryUrl.length > 0
      ? withImageLoadRetryQuery(
          primaryUrl,
          errorCount >= 1 && !broken ? 1 : 0,
        )
      : "";

  const onImgError = useCallback(() => {
    setErrorCount((n) => n + 1);
  }, []);

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
            {displaySrc}
          </span>
        </div>
      ) : fill ? (
        <Image
          key={`${displaySrc}-${errorCount}`}
          src={displaySrc}
          alt={alt}
          fill
          unoptimized
          loading={loading}
          sizes={sizes}
          className={cx("z-[1] object-cover opacity-100", imgClassName)}
          onLoad={() => {
            setLoaded(true);
            setErrorCount(0);
          }}
          onError={onImgError}
        />
      ) : (
        <Image
          key={`${displaySrc}-${errorCount}`}
          src={displaySrc}
          alt={alt}
          width={2400}
          height={1800}
          unoptimized
          loading={loading}
          sizes="(max-width: 768px) 100vw, min(1400px, 100vw)"
          className={cx(
            "relative z-[1] h-auto w-full max-w-full object-contain opacity-100",
            imgClassName,
          )}
          onLoad={() => {
            setLoaded(true);
            setErrorCount(0);
          }}
          onError={onImgError}
        />
      )}
    </div>
  );
}
