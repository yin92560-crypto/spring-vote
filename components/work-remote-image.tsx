"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

function cx(...parts: (string | false | undefined | null)[]) {
  return parts.filter(Boolean).join(" ");
}

const ASSETS_PUBLIC_ORIGIN = "https://assets.huaqintp.top";
const LEGACY_IMAGE_ORIGINS = [
  "https://pub-c32b84ede21d4770b966e9e4718d0a0d.r2.dev",
  ASSETS_PUBLIC_ORIGIN,
];

function toAssetsPublicUrl(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  try {
    if (/^https?:\/\//i.test(t)) {
      // 远程 URL 直接使用原地址，避免错误域名改写导致图片加载失败。
      const u = new URL(t);
      return u.toString();
    }
    if (t.startsWith("//")) {
      return `https:${t}`;
    }
    const path = t.replace(/^\/+/, "");
    return `${ASSETS_PUBLIC_ORIGIN}/${path}`;
  } catch {
    return t;
  }
}

function buildFallbackCandidates(primaryUrl: string): string[] {
  if (!primaryUrl) return [];
  try {
    const u = new URL(primaryUrl);
    const candidates = [u.toString()];
    const pathAndQuery = `${u.pathname}${u.search}`;
    for (const origin of LEGACY_IMAGE_ORIGINS) {
      const normalized = `${origin.replace(/\/+$/, "")}${pathAndQuery}`;
      if (!candidates.includes(normalized)) {
        candidates.push(normalized);
      }
    }
    return candidates;
  } catch {
    return [primaryUrl];
  }
}

type Props = {
  src: string | null | undefined;
  alt: string;
  /** 兼容保留：不再用于首屏预加载策略 */
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
  const primaryUrl = toAssetsPublicUrl(src);
  const candidateUrls = buildFallbackCandidates(primaryUrl);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [showSlowHint, setShowSlowHint] = useState(false);

  useEffect(() => {
    setCurrentIndex(0);
    setLoaded(false);
    setShowSlowHint(false);
  }, [primaryUrl]);

  const displaySrc = candidateUrls[currentIndex] ?? "";
  void index;
  const effectiveLoading: "lazy" | "eager" = "lazy";

  useEffect(() => {
    if (!displaySrc || loaded) return;
    const id = window.setTimeout(() => {
      setShowSlowHint(true);
    }, 10000);
    return () => window.clearTimeout(id);
  }, [displaySrc, loaded]);

  const onImgError = useCallback(() => {
    setLoaded(false);
    setCurrentIndex((prev) => {
      if (prev + 1 < candidateUrls.length) return prev + 1;
      return prev;
    });
  }, [candidateUrls.length]);

  const showPlaceholder = Boolean(primaryUrl) && !loaded;
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
      ) : fill ? (
        <Image
          key={displaySrc}
          src={displaySrc}
          alt={alt}
          fill
          unoptimized
          priority={false}
          loading={effectiveLoading}
          sizes={sizes}
          className={cx(
            "z-[1] object-cover transition-opacity duration-500 ease-out",
            loaded ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
          onLoadingComplete={() => {
            setLoaded(true);
            setShowSlowHint(false);
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
          priority={false}
          loading={effectiveLoading}
          sizes="(max-width: 768px) 100vw, min(1400px, 100vw)"
          className={cx(
            "relative z-[1] h-auto w-full max-w-full object-contain transition-opacity duration-500 ease-out",
            loaded ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
          onLoadingComplete={() => {
            setLoaded(true);
            setShowSlowHint(false);
          }}
          onError={onImgError}
        />
      )}
      {showPlaceholder && showSlowHint && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] px-3 pb-3">
          <div className="rounded-lg border border-sky-200/50 bg-white/45 px-2.5 py-1.5 text-center text-[11px] text-sky-900/85 backdrop-blur-sm">
            加载稍慢，请稍后
          </div>
        </div>
      )}
    </div>
  );
}
