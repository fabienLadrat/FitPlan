export type FitPlanAppState<SessionValue = unknown> = {
  sessions: Record<string, SessionValue>;
  equipment: string[];
  customEquipment: string[];
  cycleStart: number | null;
};

type StorageValue = {
  value: string;
};

export type AppStorage = {
  get(key: string): Promise<StorageValue | null>;
  set(key: string, value: string): Promise<void>;
};

type FetchJson = <T>(path: string, init?: RequestInit) => Promise<T>;

type PersistenceDependencies = {
  storage: AppStorage;
  fetchJson: FetchJson;
};

declare global {
  interface Window {
    storage?: AppStorage;
  }
}

const STORAGE_KEYS = {
  sessions: "fitplan:sessions",
  equipment: "fitplan:equipment",
  customEquipment: "fitplan:customEquipment",
  cycleStart: "fitplan:cycleStart",
} as const;

export const defaultFitPlanAppState: FitPlanAppState = {
  sessions: {},
  equipment: [],
  customEquipment: [],
  cycleStart: null,
};

export const browserStorage: AppStorage = {
  async get(key) {
    if (window.storage) return window.storage.get(key);
    const value = window.localStorage.getItem(key);
    return value === null ? null : { value };
  },
  async set(key, value) {
    if (window.storage) return window.storage.set(key, value);
    window.localStorage.setItem(key, value);
  },
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  return response.json() as Promise<T>;
}

const defaultDependencies: PersistenceDependencies = {
  storage: browserStorage,
  fetchJson,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asCycleStart(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeFitPlanAppState(value: unknown): FitPlanAppState {
  if (!isRecord(value)) return defaultFitPlanAppState;

  return {
    sessions: isRecord(value.sessions) ? value.sessions : {},
    equipment: asStringArray(value.equipment),
    customEquipment: asStringArray(value.customEquipment),
    cycleStart: asCycleStart(value.cycleStart),
  };
}

async function readJson<T>(storage: AppStorage, key: string, fallback: T): Promise<T> {
  try {
    const item = await storage.get(key);
    return item ? (JSON.parse(item.value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function loadLocalFitPlanState(storage: AppStorage): Promise<FitPlanAppState> {
  const sessions = await readJson<Record<string, unknown>>(storage, STORAGE_KEYS.sessions, {});
  const equipment = await readJson<string[]>(storage, STORAGE_KEYS.equipment, []);
  const customEquipment = await readJson<string[]>(storage, STORAGE_KEYS.customEquipment, []);
  const cycleStart = await readJson<number | null>(storage, STORAGE_KEYS.cycleStart, null);

  return normalizeFitPlanAppState({ sessions, equipment, customEquipment, cycleStart });
}

export async function writeLocalFitPlanState(
  state: FitPlanAppState,
  storage: AppStorage,
): Promise<void> {
  await Promise.all([
    storage.set(STORAGE_KEYS.sessions, JSON.stringify(state.sessions)),
    storage.set(STORAGE_KEYS.equipment, JSON.stringify(state.equipment)),
    storage.set(STORAGE_KEYS.customEquipment, JSON.stringify(state.customEquipment)),
    storage.set(STORAGE_KEYS.cycleStart, JSON.stringify(state.cycleStart)),
  ]);
}

export async function loadPersistedFitPlanState(
  dependencies = defaultDependencies,
): Promise<FitPlanAppState> {
  try {
    const apiState = await dependencies.fetchJson<FitPlanAppState>("/api/fitplan");
    return normalizeFitPlanAppState(apiState);
  } catch {
    return loadLocalFitPlanState(dependencies.storage);
  }
}

export async function savePersistedFitPlanState(
  state: FitPlanAppState,
  dependencies = defaultDependencies,
): Promise<void> {
  const normalized = normalizeFitPlanAppState(state);

  try {
    await dependencies.fetchJson<FitPlanAppState>("/api/fitplan", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalized),
    });
  } catch {
    // The local fallback is still updated below so the app remains usable offline.
  }

  await writeLocalFitPlanState(normalized, dependencies.storage);
}
