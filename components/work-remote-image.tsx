"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

function cx(...parts: (string | false | undefined | null)[]) {
  return parts.filter(Boolean).join(" ");
}

type Props = {
  src: string | null | undefined;
  alt: string;
  /** 列表索引：前 4 张使用 priority 优先加载 */
  index?: number;
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
 * 作品远程图：`next/image` + `unoptimized` 直链 R2；失败时仅标记为失败，不切换回退域名。
 */
export function WorkRemoteImage({
  src,
  alt,
  index,
  className,
  imgClassName,
  loading = "lazy",
  layout = "fill",
  sizes = DEFAULT_FILL_SIZES,
}: Props) {
  const primaryUrl = (src ?? "").trim();
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setBroken(false);
    setLoaded(false);
  }, [primaryUrl]);

  const displaySrc = primaryUrl.length > 0 ? primaryUrl : "";
  const prioritized = typeof index === "number" && index < 4;
  const effectiveLoading: "lazy" | "eager" = prioritized ? "eager" : loading;

  const onImgError = useCallback(() => {
    setBroken(true);
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
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit] bg-gradient-to-br from-sky-100/85 via-slate-50/88 to-blue-100/82 backdrop-blur-[2px]"
          aria-hidden
        >
          <div className="absolute inset-0 animate-pulse bg-sky-200/20" />
          <div
            className="work-remote-image-shimmer absolute inset-y-0 -left-1/3 w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/55 to-transparent opacity-80"
            aria-hidden
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.38),transparent_42%),radial-gradient(circle_at_82%_72%,rgba(186,230,253,0.32),transparent_44%)]" />
        </div>
      )}
      {!primaryUrl ? (
        <div
          className={cx(
            "z-[1] bg-gradient-to-br from-sky-100/85 via-slate-50/88 to-blue-100/82",
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
          key={displaySrc}
          src={displaySrc}
          alt={alt}
          fill
          unoptimized
          priority={prioritized}
          loading={effectiveLoading}
          sizes={sizes}
          className={cx(
            "z-[1] object-cover transition-opacity duration-500 ease-out",
            loaded ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
          onLoad={() => {
            setLoaded(true);
          }}
          onError={onImgError}
        />
      ) : (
        <Image
          key={displaySrc}
          src={displaySrc}
          alt={alt}
          width={2400}
          height={1800}
          unoptimized
          priority={prioritized}
          loading={effectiveLoading}
          sizes="(max-width: 768px) 100vw, min(1400px, 100vw)"
          className={cx(
            "relative z-[1] h-auto w-full max-w-full object-contain transition-opacity duration-500 ease-out",
            loaded ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
          onLoad={() => {
            setLoaded(true);
          }}
          onError={onImgError}
        />
      )}
    </div>
  );
}
