"use client";

/** 与需求一致：localStorage 键名为 voter_id */
const VOTER_ID_STORAGE_KEY = "voter_id";
const LEGACY_VOTER_ID_STORAGE_KEY = "spring-vote-voter-id";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fallbackRandomId(): string {
  const rand = Math.random().toString(16).slice(2, 10);
  const time = Date.now().toString(16).slice(-8);
  return `${time}${rand}-${rand.slice(0, 4)}-4${rand.slice(
    0,
    3,
  )}-a${rand.slice(0, 3)}-${time}${rand}`;
}

/** 浏览器端投票身份：优先读 voter_id；兼容旧键 spring-vote-voter-id 并迁移。 */
export function getOrCreateClientVoterId(): string {
  if (typeof window === "undefined") return "";
  try {
    const fromNew = window.localStorage.getItem(VOTER_ID_STORAGE_KEY)?.trim() ?? "";
    if (UUID_RE.test(fromNew)) return fromNew;

    const legacy = window.localStorage.getItem(LEGACY_VOTER_ID_STORAGE_KEY)?.trim() ?? "";
    if (UUID_RE.test(legacy)) {
      window.localStorage.setItem(VOTER_ID_STORAGE_KEY, legacy);
      return legacy;
    }

    const generated =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : fallbackRandomId();
    window.localStorage.setItem(VOTER_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return "";
  }
}
