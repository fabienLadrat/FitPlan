import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { Server } from "node:http";
import { createApp } from "./app.ts";
import type { FitPlanAppState } from "./appStateStore.ts";

type TestServer = {
  baseUrl: string;
  close(): Promise<void>;
};

async function startTestServer(store: {
  load(): Promise<FitPlanAppState>;
  save(state: FitPlanAppState): Promise<FitPlanAppState>;
}, isMongoConnected = true): Promise<TestServer> {
  const app = createApp({
    store,
    isMongoConnected: () => isMongoConnected,
  });

  const server = await new Promise<Server>((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });

  const address = server.address();
  assert.ok(address && typeof address === "object");

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

describe("FitPlan API", () => {
  let testServer: TestServer | undefined;

  afterEach(async () => {
    await testServer?.close();
    testServer = undefined;
  });

  it("returns persisted state from GET /api/fitplan", async () => {
    const state = {
      sessions: { "05/05/2026": { date: "05/05/2026" } },
      equipment: ["Barbell"],
      customEquipment: ["Barbell"],
      cycleStart: 1777932000000,
    };
    testServer = await startTestServer({
      load: async () => state,
      save: async (nextState) => nextState,
    });

    const response = await fetch(`${testServer.baseUrl}/api/fitplan`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), state);
  });

  it("saves full state through PUT /api/fitplan", async () => {
    let savedState: FitPlanAppState | null = null;
    const nextState = {
      sessions: {},
      equipment: ["SkiErg"],
      customEquipment: ["SkiErg"],
      cycleStart: null,
    };
    testServer = await startTestServer({
      load: async () => nextState,
      save: async (state) => {
        savedState = state;
        return state;
      },
    });

    const response = await fetch(`${testServer.baseUrl}/api/fitplan`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextState),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(savedState, nextState);
    assert.deepEqual(await response.json(), nextState);
  });

  it("returns JSON errors for invalid PUT payloads", async () => {
    testServer = await startTestServer({
      load: async () => ({ sessions: {}, equipment: [], customEquipment: [], cycleStart: null }),
      save: async (state) => state,
    });

    const response = await fetch(`${testServer.baseUrl}/api/fitplan`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessions: [] }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid FitPlan state payload" });
  });

  it("reports API and MongoDB availability from GET /api/health", async () => {
    testServer = await startTestServer({
      load: async () => ({ sessions: {}, equipment: [], customEquipment: [], cycleStart: null }),
      save: async (state) => state,
    }, false);

    const response = await fetch(`${testServer.baseUrl}/api/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, mongodb: false });
  });

  it("returns service-unavailable JSON when persistence is offline", async () => {
    const originalConsoleError = console.error;
    const consoleErrors: unknown[] = [];
    console.error = (...args: unknown[]) => {
      consoleErrors.push(args);
    };

    try {
      testServer = await startTestServer({
        load: async () => {
          const error = new Error("MongoDB unavailable");
          Object.assign(error, { statusCode: 503 });
          throw error;
        },
        save: async (state) => state,
      }, false);

      const response = await fetch(`${testServer.baseUrl}/api/fitplan`);

      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: "MongoDB unavailable" });
      assert.deepEqual(consoleErrors, []);
    } finally {
      console.error = originalConsoleError;
    }
  });
});
