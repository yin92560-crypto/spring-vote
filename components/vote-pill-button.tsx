"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  onVote: () => void | Promise<void>;
  className?: string;
  children: React.ReactNode;
};

/**
 * 胶囊投票按钮：点击时触发心形粒子炸裂动画，再执行投票逻辑。
 */
export function VotePillButton({
  disabled,
  onVote,
  className = "",
  children,
}: Props) {
  const [burstId, setBurstId] = useState(0);
  const busy = useRef(false);

  const handleClick = useCallback(async () => {
    if (disabled || busy.current) return;
    busy.current = true;
    setBurstId((n) => n + 1);
    try {
      await onVote();
    } finally {
      busy.current = false;
    }
  }, [disabled, onVote]);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void handleClick()}
      className={`vote-pill-btn group relative overflow-visible ${className}`}
    >
      {burstId > 0 && (
        <span
          key={burstId}
          className="pointer-events-none absolute left-1/2 top-1/2 z-0 flex h-0 w-0 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          aria-hidden
        >
          {Array.from({ length: 10 }, (_, i) => (
            <span
              key={`${burstId}-${i}`}
              className="vote-heart-particle"
              style={
                {
                  "--vh-angle": `${i * 36}deg`,
                  animationDelay: `${i * 0.015}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </span>
      )}
      <span className="relative z-[1] inline-flex items-center justify-center gap-1.5">
        <span
          className="text-[1.05em] transition-transform duration-300 ease-out group-active:scale-125"
          aria-hidden
        >
          ❤
        </span>
        {children}
      </span>
    </button>
  );
}
