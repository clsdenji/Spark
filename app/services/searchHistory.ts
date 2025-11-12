import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "recent_searches_v1";

export type SearchEntry = {
  id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  timestamp: number;
};

let HISTORY: SearchEntry[] = [];
let SUBSCRIBERS: ((h: SearchEntry[]) => void)[] = [];
let loaded = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

const notify = () => {
  const snap = HISTORY.slice();
  SUBSCRIBERS.forEach((s) => {
    try {
      s(snap);
    } catch (err) {
      console.warn("subscriber error", err);
    }
  });
};

const load = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) HISTORY = JSON.parse(raw) as SearchEntry[];
  } catch (e) {
    HISTORY = [];
    console.warn("searchHistory load failed", e);
  } finally {
    loaded = true;
  }
};

const persistNow = async () => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(HISTORY));
  } catch (e) {
    console.warn("searchHistory persist failed", e);
  }
};

const schedulePersist = () => {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistNow();
    persistTimer = null;
  }, 300); // debounce writes
};

// load once and notify subscribers after load completes
(async () => {
  await load();
  notify();
})();

export function addSearch(entry: Omit<SearchEntry, "id" | "timestamp">) {
  const e: SearchEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
    ...entry,
  };
  HISTORY = [e, ...HISTORY.filter((i) => i.id !== e.id && i.name !== e.name)].slice(0, 100);
  schedulePersist();
  notify();
}

export function removeSearch(id: string) {
  HISTORY = HISTORY.filter((i) => i.id !== id);
  schedulePersist();
  notify();
}

export function getSearchHistory(): SearchEntry[] {
  return HISTORY.slice();
}

export function subscribeSearchHistory(cb: (h: SearchEntry[]) => void) {
  SUBSCRIBERS.push(cb);
  // only call immediately if we've finished loading to avoid double notification
  if (loaded) {
    try {
      cb(HISTORY.slice());
    } catch (err) {
      console.warn("subscriber immediate call failed", err);
    }
  }
  return () => {
    SUBSCRIBERS = SUBSCRIBERS.filter((s) => s !== cb);
  };
}

export async function clearSearchHistory() {
  HISTORY = [];
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (e) {
    console.warn("clearSearchHistory async remove failed", e);
  }
  notify();
}