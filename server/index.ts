import "dotenv/config";
import { MongoClient } from "mongodb";
import { createApp } from "./app.ts";
import { createAppStateStore, getAppStateCollection } from "./appStateStore.ts";

const mongoUrl = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";
const databaseName = process.env.MONGODB_DATABASE ?? "fitplan";
const port = Number(process.env.PORT ?? 3001);

const client = new MongoClient(mongoUrl);
let mongoConnected = false;

async function startServer() {
  await client.connect();
  mongoConnected = true;

  const db = client.db(databaseName);
  const store = createAppStateStore(getAppStateCollection(db));
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
