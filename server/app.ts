import cors from "cors";
import express from "express";
import type { FitPlanAppState } from "./appStateStore.ts";

type AppStateStore = {
  load(): Promise<FitPlanAppState>;
  save(state: FitPlanAppState): Promise<FitPlanAppState>;
};

type AppDependencies = {
  store: AppStateStore;
  isMongoConnected(): boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isFitPlanAppState(value: unknown): value is FitPlanAppState {
  if (!isRecord(value)) return false;

  return (
    isRecord(value.sessions) &&
    isStringArray(value.equipment) &&
    isStringArray(value.customEquipment) &&
    (value.cycleStart === null || typeof value.cycleStart === "number")
  );
}

export function createApp({ store, isMongoConnected }: AppDependencies) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true, mongodb: isMongoConnected() });
  });

  app.get("/api/fitplan", async (_request, response, next) => {
    try {
      response.json(await store.load());
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/fitplan", async (request, response, next) => {
    try {
      if (!isFitPlanAppState(request.body)) {
        response.status(400).json({ error: "Invalid FitPlan state payload" });
        return;
      }

      response.json(await store.save(request.body));
    } catch (error) {
      next(error);
    }
  });

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      next: express.NextFunction,
    ) => {
      void next;
      console.error(error);
      response.status(500).json({ error: "Internal server error" });
    },
  );

  return app;
}
