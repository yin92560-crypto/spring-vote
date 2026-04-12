"use client";

import { useEffect, useState } from "react";

function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

type Petal = {
  id: number;
  leftPct: number;
  sizePx: number;
  duration: number;
  delay: number;
  sway: number;
  spin: number;
};

function buildPetals(count: number): Petal[] {
  return Array.from({ length: count }, (_, i) => {
    const h = (s: number) => hash(i * 31 + s);
    return {
      id: i,
      leftPct: 2 + h(1) * 96,
      sizePx: 6 + h(2) * 12,
      duration: 14 + h(3) * 18,
      delay: -h(4) * 24,
      sway: (h(5) - 0.5) * 90,
      spin: 360 + h(6) * 720,
    };
  });
}

export function SakuraFalling() {
  const [petals, setPetals] = useState<Petal[]>([]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setPetals(buildPetals(40));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[2] overflow-hidden"
      aria-hidden
      suppressHydrationWarning
    >
      {petals.map((p) => (
        <span
          key={p.id}
          className="sakura-petal absolute top-0"
          style={
            {
              left: `${p.leftPct}%`,
              width: `${p.sizePx}px`,
              height: `${p.sizePx * 1.15}px`,
              ["--sakura-sway"]: `${p.sway}px`,
              ["--sakura-spin"]: `${p.spin}deg`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
