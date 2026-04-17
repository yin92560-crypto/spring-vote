"use client";

const VOTER_ID_STORAGE_KEY = "spring-vote-voter-id";
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

/** 浏览器端投票身份标识：首次访问生成并持久化，后续复用。 */
export function getOrCreateClientVoterId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(VOTER_ID_STORAGE_KEY)?.trim() ?? "";
    if (UUID_RE.test(existing)) return existing;

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

