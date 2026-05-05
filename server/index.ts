import "dotenv/config";
import { MongoClient } from "mongodb";
import { createApp } from "./app.ts";
import {
  createAppStateStore,
  createUnavailableAppStateStore,
  getAppStateCollection,
} from "./appStateStore.ts";

const mongoUrl = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";
const databaseName = process.env.MONGODB_DATABASE ?? "fitplan";
const port = Number(process.env.PORT ?? 3001);

const client = new MongoClient(mongoUrl);
let mongoConnected = false;

async function startServer() {
  let store = createUnavailableAppStateStore();

  try {
    await client.connect();
    mongoConnected = true;

    const db = client.db(databaseName);
    store = createAppStateStore(getAppStateCollection(db));
  } catch (error) {
    void error;
    console.warn("MongoDB unavailable; API will keep running with local frontend fallback.");
  }

  const app = createApp({
    store,
    isMongoConnected: () => mongoConnected,
  });

  app.listen(port, () => {
    console.log(`FitPlan API listening on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Unable to start FitPlan API", error);
  process.exitCode = 1;
});
