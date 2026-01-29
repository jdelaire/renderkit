const ENV_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
const PROXY_BASE = import.meta.env.VITE_PROXY_BASE_URL as string | undefined;
const LOCAL_KEY = "renderkit.openaiKey.local";
const SESSION_KEY = "renderkit.openaiKey.session";

function normalize(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getOpenAIKey(): string | null {
  if (typeof window !== "undefined") {
    const session = normalize(sessionStorage.getItem(SESSION_KEY));
    if (session) return session;
    const local = normalize(localStorage.getItem(LOCAL_KEY));
    if (local) return local;
  }
  if (import.meta.env.PROD) return null;
  return normalize(ENV_KEY);
}

export function getOpenAIKeySource(): "session" | "local" | "env" | "none" {
  if (typeof window !== "undefined") {
    const session = normalize(sessionStorage.getItem(SESSION_KEY));
    if (session) return "session";
    const local = normalize(localStorage.getItem(LOCAL_KEY));
    if (local) return "local";
  }
  if (import.meta.env.PROD) return "none";
  const env = normalize(ENV_KEY);
  return env ? "env" : "none";
}

export function setOpenAIKey(value: string | null, persist = false) {
  if (typeof window === "undefined") return;
  const normalized = normalize(value);
  if (!normalized) {
    localStorage.removeItem(LOCAL_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    return;
  }
  if (persist) {
    localStorage.setItem(LOCAL_KEY, normalized);
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    sessionStorage.setItem(SESSION_KEY, normalized);
    localStorage.removeItem(LOCAL_KEY);
  }
}

export function getProxyBaseUrl(): string | null {
  return normalize(PROXY_BASE);
}
