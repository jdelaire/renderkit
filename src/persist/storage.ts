import type { AppSettings } from "../state/store";
import type { JobRecord } from "../domain";

export type PersistedState = {
  settings: AppSettings;
  jobs: JobRecord[];
  promptDraft: string;
};

const DB_NAME = "renderkit";
const STORE_NAME = "kv";
const FALLBACK_KEY = "renderkit.state.v1";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function localGet(): PersistedState | null {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

function localSet(state: PersistedState) {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(state));
  } catch {
    // ignore persistence errors
  }
}

export async function loadState(): Promise<Partial<PersistedState>> {
  try {
    const state = await idbGet<PersistedState>(FALLBACK_KEY);
    if (state) return state;
  } catch {
    // fallback below
  }
  return localGet() ?? {};
}

export async function saveState(state: PersistedState): Promise<void> {
  try {
    await idbSet(FALLBACK_KEY, state);
  } catch {
    localSet(state);
  }
}
