# Local MongoDB Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save FitPlan state to a local MongoDB-backed API while preserving localStorage fallback behavior.

**Architecture:** Add a small Express API in `server/` that owns MongoDB access and stores one `app_state` document. Move frontend persistence into a typed adapter that loads from `/api/fitplan`, falls back to existing local keys, and saves the complete app state after hydration.

**Tech Stack:** Vite, React, TypeScript, Express, official MongoDB Node driver, Node test runner.

---

### Task 1: Shared App State Shape

**Files:**
- Create: `src/fitplanPersistence.ts`
- Modify: `src/fitplan.tsx`

- [ ] **Step 1: Write exported app-state types and helpers**

Create `FitPlanAppState`, `defaultFitPlanAppState`, local fallback read/write helpers, API load/save helpers, and `loadPersistedFitPlanState`.

- [ ] **Step 2: Refactor `FitPlan` persistence**

Replace the four key-by-key effects with one startup load and one full-state save effect.

- [ ] **Step 3: Run frontend build**

Run: `npm.cmd run build`
Expected: TypeScript and Vite build exit 0.

### Task 2: MongoDB Store

**Files:**
- Create: `server/appStateStore.ts`
- Create: `server/appStateStore.test.ts`
- Modify: `tsconfig.node.json`

- [ ] **Step 1: Write failing store tests**

Test default-state fallback, document normalization, and upsert payload.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm.cmd run test:server -- server/appStateStore.test.ts`
Expected: FAIL because the store module does not exist yet.

- [ ] **Step 3: Implement store**

Export `APP_STATE_ID`, `DEFAULT_APP_STATE`, `normalizeAppState`, `createAppStateStore`, and collection helpers.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm.cmd run test:server -- server/appStateStore.test.ts`
Expected: PASS.

### Task 3: Express API

**Files:**
- Create: `server/app.ts`
- Create: `server/index.ts`
- Create: `server/app.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing route tests**

Test `GET /api/fitplan`, `PUT /api/fitplan`, JSON errors, and `GET /api/health`.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm.cmd run test:server -- server/app.test.ts`
Expected: FAIL because the Express app module does not exist yet.

- [ ] **Step 3: Implement app and server entrypoint**

Create dependency-injected Express app, MongoDB connection bootstrap, and JSON error responses.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm.cmd run test:server -- server/app.test.ts`
Expected: PASS.

### Task 4: Dev Wiring

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `eslint.config.js`
- Modify: `README.md`

- [ ] **Step 1: Add dependencies and scripts**

Install Express, MongoDB, CORS, dotenv, concurrently, and TSX. Add `dev:client`, `dev:server`, `dev:all`, and `test:server`.

- [ ] **Step 2: Add Vite proxy**

Proxy `/api` to `http://localhost:3001`.

- [ ] **Step 3: Update docs**

Document MongoDB, API, and combined dev startup.

- [ ] **Step 4: Run final verification**

Run: `npm.cmd run lint`, `npm.cmd run build`, and `npm.cmd run test:server`.
Expected: all exit 0.
