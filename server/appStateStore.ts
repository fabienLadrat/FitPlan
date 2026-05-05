import type { Collection, Db, WithId } from "mongodb";

export const APP_STATE_ID = "default";

export type FitPlanAppState = {
  sessions: Record<string, unknown>;
  equipment: string[];
  customEquipment: string[];
  cycleStart: number | null;
};

export type AppStateDocument = FitPlanAppState & {
  _id: string;
  updatedAt: Date;
};

export type AppStateCollection = {
  findOne(filter: { _id: string }): Promise<WithId<Partial<AppStateDocument>> | null>;
  replaceOne(
    filter: { _id: string },
    document: AppStateDocument,
    options: { upsert: boolean },
  ): Promise<unknown>;
};

export const DEFAULT_APP_STATE: FitPlanAppState = {
  sessions: {},
  equipment: [],
  customEquipment: [],
  cycleStart: null,
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

export function normalizeAppState(document: WithId<Partial<AppStateDocument>> | null): FitPlanAppState {
  if (!document) return DEFAULT_APP_STATE;

  return {
    sessions: isRecord(document.sessions) ? document.sessions : {},
    equipment: asStringArray(document.equipment),
    customEquipment: asStringArray(document.customEquipment),
    cycleStart: asCycleStart(document.cycleStart),
  };
}

export function createAppStateStore(collection: AppStateCollection) {
  return {
    async load(): Promise<FitPlanAppState> {
      const document = await collection.findOne({ _id: APP_STATE_ID });
      return normalizeAppState(document);
    },

    async save(state: FitPlanAppState): Promise<FitPlanAppState> {
      const normalized = normalizeAppState({ _id: APP_STATE_ID, ...state });
      await collection.replaceOne(
        { _id: APP_STATE_ID },
        { _id: APP_STATE_ID, ...normalized, updatedAt: new Date() },
        { upsert: true },
      );
      return normalized;
    },
  };
}

export function createUnavailableAppStateStore() {
  function createUnavailableError() {
    const error = new Error("MongoDB unavailable");
    return Object.assign(error, { statusCode: 503 });
  }

  return {
    async load(): Promise<FitPlanAppState> {
      throw createUnavailableError();
    },

    async save(state: FitPlanAppState): Promise<FitPlanAppState> {
      void state;
      throw createUnavailableError();
    },
  };
}

export function getAppStateCollection(db: Db): Collection<AppStateDocument> {
  return db.collection<AppStateDocument>("app_state");
}
