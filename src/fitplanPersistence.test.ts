import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultFitPlanAppState,
  loadPersistedFitPlanState,
  savePersistedFitPlanState,
} from "./fitplanPersistence.ts";

type StorageValue = {
  value: string;
};

function createMemoryStorage(initialValues: Record<string, unknown> = {}) {
  const values = new Map<string, string>(
    Object.entries(initialValues).map(([key, value]) => [key, JSON.stringify(value)]),
  );

  return {
    async get(key: string): Promise<StorageValue | null> {
      const value = values.get(key);
      return value === undefined ? null : { value };
    },
    async set(key: string, value: string): Promise<void> {
      values.set(key, value);
    },
    read(key: string) {
      const value = values.get(key);
      return value === undefined ? undefined : JSON.parse(value);
    },
  };
}

describe("loadPersistedFitPlanState", () => {
  it("hydrates state from the API when it is available", async () => {
    const apiState = {
      sessions: { "05/05/2026": { date: "05/05/2026" } },
      equipment: ["Barbell"],
      customEquipment: ["Barbell"],
      cycleStart: 1777932000000,
    };
    const storage = createMemoryStorage();

    const state = await loadPersistedFitPlanState({
      storage,
      fetchJson: async () => apiState,
    });

    assert.deepEqual(state, apiState);
  });

  it("falls back to existing local storage keys when the API fails", async () => {
    const storage = createMemoryStorage({
      "fitplan:sessions": { "05/05/2026": { date: "05/05/2026" } },
      "fitplan:equipment": ["SkiErg"],
      "fitplan:customEquipment": ["SkiErg", "Bike"],
      "fitplan:cycleStart": 1777932000000,
    });

    const state = await loadPersistedFitPlanState({
      storage,
      fetchJson: async () => {
        throw new Error("API unavailable");
      },
    });

    assert.deepEqual(state, {
      sessions: { "05/05/2026": { date: "05/05/2026" } },
      equipment: ["SkiErg"],
      customEquipment: ["SkiErg", "Bike"],
      cycleStart: 1777932000000,
    });
  });

  it("returns default state when API and local fallback are empty", async () => {
    const state = await loadPersistedFitPlanState({
      storage: createMemoryStorage(),
      fetchJson: async () => {
        throw new Error("API unavailable");
      },
    });

    assert.deepEqual(state, defaultFitPlanAppState);
  });
});

describe("savePersistedFitPlanState", () => {
  it("saves to the API and keeps local fallback keys fresh", async () => {
    const storage = createMemoryStorage();
    const savedRequests: unknown[] = [];
    const state = {
      sessions: { "05/05/2026": { date: "05/05/2026" } },
      equipment: ["Barbell"],
      customEquipment: ["Barbell"],
      cycleStart: null,
    };

    await savePersistedFitPlanState(state, {
      storage,
      fetchJson: async (path, init) => {
        savedRequests.push({ path, init });
        return state;
      },
    });

    assert.deepEqual(savedRequests, [
      {
        path: "/api/fitplan",
        init: {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(state),
        },
      },
    ]);
    assert.deepEqual(storage.read("fitplan:sessions"), state.sessions);
    assert.deepEqual(storage.read("fitplan:equipment"), state.equipment);
    assert.deepEqual(storage.read("fitplan:customEquipment"), state.customEquipment);
    assert.deepEqual(storage.read("fitplan:cycleStart"), state.cycleStart);
  });
});
