const LS_KEY = "spring-vote-admin-session";
const COOKIE_NAME = "spring_vote_admin";
/** 14 天 */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 14;

const AUTH_CHANGED_EVENT = "spring-vote-admin-auth-changed";

function emitAuthChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function subscribeAdminAuth(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = () => cb();
  const onAuth = () => cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener(AUTH_CHANGED_EVENT, onAuth);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(AUTH_CHANGED_EVENT, onAuth);
  };
}

export function getAdminPasswordFromEnv(): string {
  return process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "";
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]*)`)
  );
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

/** 从 Cookie 同步到 localStorage，便于两端一致 */
export function syncAdminSession(): void {
  if (typeof window === "undefined") return;
  try {
    const fromLs = localStorage.getItem(LS_KEY);
    const fromCk = readCookie(COOKIE_NAME);
    if (fromCk === "1" && fromLs !== "1") {
      localStorage.setItem(LS_KEY, "1");
    }
    if (fromLs === "1" && fromCk !== "1") {
      document.cookie = `${COOKIE_NAME}=1; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    }
  } catch {
    /* ignore */
  }
}

export function isAdminSessionValid(): boolean {
  if (typeof window === "undefined") return false;
  try {
    syncAdminSession();
    if (localStorage.getItem(LS_KEY) === "1") return true;
    return readCookie(COOKIE_NAME) === "1";
  } catch {
    return false;
  }
}

export function persistAdminSession(): void {
  localStorage.setItem(LS_KEY, "1");
  document.cookie = `${COOKIE_NAME}=1; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  emitAuthChanged();
}

export function clearAdminSession(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  emitAuthChanged();
}

export function verifyAdminPassword(input: string): boolean {
  const expected = getAdminPasswordFromEnv();
  if (!expected) return false;
  return input === expected;
}
