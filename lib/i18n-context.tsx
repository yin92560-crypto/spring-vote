"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Locale = "zh" | "en" | "ja";

const STORAGE_KEY = "spring-vote-locale";

/** 与三语词库保持一致的键；缺失时回退为 key */
export type MessageKey =
  | "title"
  | "subtitle"
  | "heroDesc"
  | "voteRules"
  | "remainingVotes"
  | "rank"
  | "admin"
  | "upload"
  | "search"
  | "prev"
  | "next"
  | "searchPlaceholder"
  | "searchAria"
  | "vote"
  | "voteCard"
  | "votesLabel"
  | "authorLabel"
  | "votesUnit"
  | "viewDetailHint"
  | "displayNoLabel"
  | "worksTotal"
  | "worksFiltered"
  | "noWorks"
  | "noWorksHint"
  | "goAdmin"
  | "noMatch"
  | "noMatchHint"
  | "toastRequestFail"
  | "toastVoteOk"
  | "toastVoteFail"
  | "toastVoteDailyLimit"
  | "toastVoteAlreadyToday"
  | "toastVoteNoQuota"
  | "shareCopied"
  | "shareFailed"
  | "footerTagline"
  | "footerCopyright"
  | "loadingSpring"
  | "loadingWorks"
  | "champion"
  | "runnerUp"
  | "thirdPlace"
  | "placeRank"
  | "topThree"
  | "otherRanks"
  | "rankPageTitle"
  | "rankPageDesc"
  | "rankSyncHint"
  | "backHome"
  | "rankLoadError"
  | "rankEmpty"
  | "rankEmptyDesc"
  | "language"
  | "langZh"
  | "langEn"
  | "langJa"
  | "detailCloseBackdrop"
  | "detailPrevAria"
  | "detailNextAria"
  | "detailViewHdAria"
  | "detailViewHdHint"
  | "detailVotesLine"
  | "detailRemainingToday"
  | "share"
  | "close"
  | "voteSubmitting"
  | "voteForTa"
  | "closePreview"
  | "hdOriginal"
  | "loadingHd";

const MESSAGES: Record<Locale, Record<MessageKey, string>> = {
  zh: {
    title: "捕捉春日计划",
    subtitle: "2026华勤全球员工春日摄影大赛",
    heroDesc: "用镜头定格春日，谁藏了最美的春天？",
    voteRules: "投票规则：每人每日可投{n}票，快来为心仪作品助力吧！",
    remainingVotes: "今日剩余票数",
    rank: "排行榜",
    admin: "管理后台",
    upload: "上传作品",
    search: "搜索编号",
    prev: "上一张",
    next: "下一张",
    searchPlaceholder: "搜索作品名称，或输入编号如 001",
    searchAria: "搜索作品",
    vote: "投票",
    voteCard: "投一票",
    votesLabel: "得票",
    authorLabel: "作者",
    votesUnit: "票",
    viewDetailHint: "点击查看大图与详情",
    displayNoLabel: "编号",
    worksTotal: "共 {count} 件作品",
    worksFiltered: " · 当前展示 {count} 件",
    noWorks: "暂无参赛作品",
    noWorksHint: "请前往后台添加作品",
    goAdmin: "前往后台",
    noMatch: "未找到匹配的作品",
    noMatchHint: "请尝试其他关键词，或按三位编号（如 002）精确查找",
    toastRequestFail: "请求失败",
    toastVoteOk: "投票成功，感谢支持",
    toastVoteFail: "无法投票",
    toastVoteDailyLimit: "您今日的 {n} 票已用完",
    toastVoteAlreadyToday: "今日已为该作品投过票",
    toastVoteNoQuota: "今日票数已用完",
    shareCopied: "链接已复制，快去发给同事拉票吧！",
    shareFailed: "复制失败，请手动复制浏览器地址栏中的链接",
    footerTagline: "扎根生长 · 春华秋实",
    footerCopyright: "© 2026 华勤技术 · 捕捉春日计划",
    loadingSpring: "春意加载中…",
    loadingWorks: "作品列表加载中…",
    champion: "冠军",
    runnerUp: "亚军",
    thirdPlace: "季军",
    placeRank: "第 {n} 名",
    topThree: "前三名",
    otherRanks: "其他名次",
    rankPageTitle: "春日人气排行榜",
    rankPageDesc: "所有作品每五分钟刷新一次票数，快冲票帮你爱的作品冲刺首页🥳",
    rankSyncHint: "投票或管理变更后会自动刷新；切换回此标签时也会更新",
    backHome: "返回首页",
    rankLoadError: "榜单暂时无法加载",
    rankEmpty: "暂无参赛作品",
    rankEmptyDesc: "榜单将在作品上传并获票后显示",
    language: "语言",
    langZh: "中文",
    langEn: "English",
    langJa: "日本語",
    detailCloseBackdrop: "关闭详情背景",
    detailPrevAria: "上一张作品",
    detailNextAria: "下一张作品",
    detailViewHdAria: "查看原图全屏预览",
    detailViewHdHint: "🔍 点击看原图",
    detailVotesLine: "当前票数：",
    detailRemainingToday: "（今日您还可投 {n} 票）",
    share: "分享拉票",
    close: "关闭",
    voteSubmitting: "提交中…",
    voteForTa: "为 TA 投一票",
    closePreview: "关闭预览",
    hdOriginal: "原图",
    loadingHd: "原图加载中…",
  },
  en: {
    title: "2026 Huaqin Global Spring Photography Contest",
    subtitle:
      "Capture the spring with your lens. Who found the most beautiful spring?",
    heroDesc:
      "Capture the spring with your lens. Who found the most beautiful spring?",
    voteRules:
      "Voting rules: {n} votes per person per day. Come support your favorite works!",
    remainingVotes: "Votes remaining today",
    rank: "Leaderboard",
    admin: "Admin",
    upload: "Upload",
    search: "Search ID",
    prev: "Prev",
    next: "Next",
    searchPlaceholder: "Search by title or ID (e.g. 001)",
    searchAria: "Search works",
    vote: "Vote",
    voteCard: "Vote",
    votesLabel: "Votes",
    authorLabel: "Author",
    votesUnit: "votes",
    viewDetailHint: "Click for details",
    displayNoLabel: "No.",
    worksTotal: "{count} works total",
    worksFiltered: " · showing {count}",
    noWorks: "No entries yet",
    noWorksHint: "Add works in Admin.",
    goAdmin: "Go to admin",
    noMatch: "No matching works",
    noMatchHint: "Try other keywords or a 3-digit ID (e.g. 002).",
    toastRequestFail: "Request failed",
    toastVoteOk: "Vote recorded. Thank you!",
    toastVoteFail: "Cannot vote",
    toastVoteDailyLimit: "You have used all {n} votes for today.",
    toastVoteAlreadyToday: "You have already voted for this work today.",
    toastVoteNoQuota: "No votes left for today.",
    shareCopied: "Link copied. Share it with your team!",
    shareFailed: "Copy failed. Copy the URL from the address bar.",
    footerTagline: "Rooted in growth · Spring to harvest",
    footerCopyright: "© 2026 Huaqin · Spring Capture Project",
    loadingSpring: "Loading spring…",
    loadingWorks: "Loading works…",
    champion: "Champion",
    runnerUp: "Runner-up",
    thirdPlace: "Third",
    placeRank: "No. {n}",
    topThree: "Top 3",
    otherRanks: "Other ranks",
    rankPageTitle: "Spring Popularity Leaderboard",
    rankPageDesc:
      "Rankings refresh every 5 minutes. Vote now to help your favorite entries reach the top! 🥳",
    rankSyncHint: "Refreshes after votes or admin changes; updates when you return to this tab.",
    backHome: "Back to home",
    rankLoadError: "Leaderboard could not load",
    rankEmpty: "No entries yet",
    rankEmptyDesc: "The board appears once works exist and receive votes.",
    language: "Language",
    langZh: "中文",
    langEn: "English",
    langJa: "日本語",
    detailCloseBackdrop: "Close detail backdrop",
    detailPrevAria: "Previous work",
    detailNextAria: "Next work",
    detailViewHdAria: "View full-resolution image",
    detailViewHdHint: "🔍 View original",
    detailVotesLine: "Votes: ",
    detailRemainingToday: "({n} votes left today)",
    share: "Share link",
    close: "Close",
    voteSubmitting: "Submitting…",
    voteForTa: "Vote for this entry",
    closePreview: "Close preview",
    hdOriginal: "Original",
    loadingHd: "Loading original…",
  },
  ja: {
    title: "2026 華勤グローバル社員・春の写真コンテスト",
    subtitle: "2026 華勤グローバル社員・春の写真コンテスト",
    heroDesc: "レンズで春を切り取ろう。一番美しい春を見つけたのは誰？",
    voteRules:
      "投票ルール：お一人様1日{n}票まで投票できます。お気に入りの作品を応援しましょう！",
    remainingVotes: "本日の残り票数",
    rank: "ランキング",
    admin: "管理",
    upload: "投稿する",
    search: "番号検索",
    prev: "前へ",
    next: "次へ",
    searchPlaceholder: "作品名または番号（例 001）で検索",
    searchAria: "作品を検索",
    vote: "投票する",
    voteCard: "投票する",
    votesLabel: "得票",
    authorLabel: "作者",
    votesUnit: "票",
    viewDetailHint: "タップで詳細",
    displayNoLabel: "番号",
    worksTotal: "全 {count} 点",
    worksFiltered: " · 表示 {count} 点",
    noWorks: "まだ作品がありません",
    noWorksHint: "管理画面から作品を追加してください",
    goAdmin: "管理へ",
    noMatch: "該当する作品がありません",
    noMatchHint: "別のキーワードか 3 桁番号（例 002）で試してください。",
    toastRequestFail: "リクエストに失敗しました",
    toastVoteOk: "投票しました。ありがとうございます",
    toastVoteFail: "投票できません",
    toastVoteDailyLimit: "本日の{n}票は使い切りました",
    toastVoteAlreadyToday: "本日はこの作品に投票済みです",
    toastVoteNoQuota: "本日の投票枠を使い切りました",
    shareCopied: "リンクをコピーしました。共有してください",
    shareFailed: "コピーに失敗しました。アドレスバーからコピーしてください",
    footerTagline: "根を張り、春実る",
    footerCopyright: "© 2026 華勤技術 · 春の瞬間を捉える",
    loadingSpring: "春を読み込み中…",
    loadingWorks: "作品を読み込み中…",
    champion: "優勝",
    runnerUp: "準優勝",
    thirdPlace: "三位",
    placeRank: "{n}位",
    topThree: "トップ3",
    otherRanks: "その他の順位",
    rankPageTitle: "春の人気ランキング",
    rankPageDesc:
      "ランキングは5分ごとに更新されます。お気に入りの作品が上位に入れるよう、今すぐ投票しましょう！🥳",
    rankSyncHint: "投票や管理操作後に自動更新。このタブに戻ると最新表示になります。",
    backHome: "トップへ戻る",
    rankLoadError: "ランキングを読み込めませんでした",
    rankEmpty: "まだ作品がありません",
    rankEmptyDesc: "作品の投稿と投票が始まると表示されます。",
    language: "言語",
    langZh: "中文",
    langEn: "English",
    langJa: "日本語",
    detailCloseBackdrop: "詳細を閉じる",
    detailPrevAria: "前の作品",
    detailNextAria: "次の作品",
    detailViewHdAria: "原寸プレビュー",
    detailViewHdHint: "🔍 原画を見る",
    detailVotesLine: "現在の票数：",
    detailRemainingToday: "（本日あと {n} 票）",
    share: "リンクを共有",
    close: "閉じる",
    voteSubmitting: "送信中…",
    voteForTa: "この作品に投票",
    closePreview: "プレビューを閉じる",
    hdOriginal: "原画",
    loadingHd: "原画を読み込み中…",
  },
};

function interpolate(
  template: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`
  );
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh");

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === "zh" || raw === "en" || raw === "ja") {
          setLocaleState(raw);
        }
      } catch {
        /* ignore */
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const lang =
      locale === "zh" ? "zh-CN" : locale === "ja" ? "ja" : "en";
    document.documentElement.lang = lang;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => {
      const table = MESSAGES[locale];
      const raw = table[key] ?? MESSAGES.zh[key] ?? key;
      return interpolate(raw, vars);
    },
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
