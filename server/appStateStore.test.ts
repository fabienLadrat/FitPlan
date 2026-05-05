import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APP_STATE_ID,
  DEFAULT_APP_STATE,
  createUnavailableAppStateStore,
  createAppStateStore,
  normalizeAppState,
} from "./appStateStore.ts";
import type { AppStateDocument } from "./appStateStore.ts";

type StoredDocument = Partial<AppStateDocument> & { _id: string };

type ReplaceCall = {
  query: { _id: string };
  nextDocument: StoredDocument;
  options: { upsert: boolean };
};

function createFakeCollection(existing: StoredDocument | null = null) {
  let document = existing;
  const calls: ReplaceCall[] = [];

  return {
    calls,
    collection: {
      async findOne(query: { _id: string }) {
        assert.equal(query._id, APP_STATE_ID);
        return document;
      },
      async replaceOne(query: { _id: string }, nextDocument: StoredDocument, options: { upsert: boolean }) {
        calls.push({ query, nextDocument, options });
        document = nextDocument;
      },
    },
  };
}

describe("normalizeAppState", () => {
  it("returns default state for null documents", () => {
    assert.deepEqual(normalizeAppState(null), DEFAULT_APP_STATE);
  });

  it("normalizes persisted MongoDB documents into frontend state", () => {
    assert.deepEqual(
      normalizeAppState({
        _id: APP_STATE_ID,
        sessions: { "05/05/2026": { date: "05/05/2026" } },
        equipment: ["Barbell"],
        customEquipment: ["Barbell", "SkiErg"],
        cycleStart: 1777932000000,
        updatedAt: new Date("2026-05-05T10:00:00.000Z"),
      }),
      {
        sessions: { "05/05/2026": { date: "05/05/2026" } },
        equipment: ["Barbell"],
        customEquipment: ["Barbell", "SkiErg"],
        cycleStart: 1777932000000,
      },
    );
  });
});

describe("createAppStateStore", () => {
  it("loads the default state when no document exists", async () => {
    const { collection } = createFakeCollection();
    const store = createAppStateStore(collection);

    assert.deepEqual(await store.load(), DEFAULT_APP_STATE);
  });

  it("upserts the single app-state document with an updated timestamp", async () => {
    const { collection, calls } = createFakeCollection();
    const store = createAppStateStore(collection);
    const state = {
      sessions: {},
      equipment: ["Barbell"],
      customEquipment: ["Barbell"],
      cycleStart: null,
    };

    assert.deepEqual(await store.save(state), state);

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      query: { _id: APP_STATE_ID },
      nextDocument: {
        _id: APP_STATE_ID,
        ...state,
        updatedAt: calls[0].nextDocument.updatedAt,
      },
      options: { upsert: true },
    });
    assert.ok(calls[0].nextDocument.updatedAt instanceof Date);
  });
});

describe("createUnavailableAppStateStore", () => {
  it("throws service-unavailable errors while MongoDB is offline", async () => {
    const store = createUnavailableAppStateStore();

    await assert.rejects(store.load(), {
      message: "MongoDB unavailable",
      statusCode: 503,
    });
    await assert.rejects(store.save(DEFAULT_APP_STATE), {
      message: "MongoDB unavailable",
      statusCode: 503,
    });
  });
});
