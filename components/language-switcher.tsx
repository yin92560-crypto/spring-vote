"use client";

import { useId } from "react";
import type { Locale } from "@/lib/i18n-context";
import { useI18n } from "@/lib/i18n-context";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const id = useId();

  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        {t("language")}
      </label>
      <select
        id={id}
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="appearance-none rounded-full border border-emerald-200/55 bg-white/50 py-2 pl-3 pr-8 text-sm font-medium text-rose-900 shadow-sm backdrop-blur-md transition-all duration-300 ease-out outline-none hover:bg-white/75 focus:border-emerald-400/70 focus:ring-2 focus:ring-lime-300/50"
        aria-label={t("language")}
      >
        <option value="zh">{t("langZh")}</option>
        <option value="en">{t("langEn")}</option>
        <option value="ja">{t("langJa")}</option>
      </select>
      <span
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-rose-700/60"
        aria-hidden
      >
        ▼
      </span>
    </div>
  );
}
