# FitPlan

FitPlan is a personal training planner for CrossFit, Hyrox, and strength work. It helps build and track a four-week training cycle, manage available equipment, save sessions, review history, and inspect simple training stats.

## Features

- Four-week cycle view: Base, Progression, Peak, and Deload.
- Daily session planning with workout type, duration, rounds, notes, and exercises.
- Equipment management, including custom equipment.
- Exercise filtering by WOD, Hyrox, and Force.
- Session history and lightweight usage stats.
- AI session generation from the current cycle context.
- Local MongoDB persistence through the FitPlan API, with browser storage fallback.

## Persistence

The app stores one full FitPlan state document through the local API:

- `GET /api/fitplan`
- `PUT /api/fitplan`
- `GET /api/health`

The API writes to MongoDB database `fitplan`, collection `app_state`, document `_id: "default"`.

If the API or MongoDB is unavailable, the frontend falls back to browser-side storage so the app can still open during local development.

Fallback browser keys:

- `fitplan:sessions`
- `fitplan:equipment`
- `fitplan:customEquipment`
- `fitplan:cycleStart`

## Roadmap Specs

Design specs live in `docs/superpowers/specs`.

- `2026-05-04-local-mongodb-persistence-design.md`: local MongoDB persistence through a backend in `server/`.
- `2026-05-04-openai-session-generation-design.md`: planned migration from the direct Anthropic browser call to a secure OpenAI backend endpoint.

Important: the OpenAI generation backend described in the roadmap does not exist yet. The current generation flow still runs from the frontend.

## Tech Stack

- React 19
- TypeScript
- Vite
- Express
- MongoDB Node driver
- ESLint
- CSS in `src/fitplan.css`

## Project Structure

```text
FitPlan/
  docs/superpowers/specs/  Design specs for planned backend work
  public/                  Static public assets
  server/
    app.ts                 Express app and API routes
    appStateStore.ts       MongoDB app-state store
    index.ts               Local API server entry point
  src/
    fitplan.tsx            Main FitPlan application component
    fitplanPersistence.ts  Frontend API/local fallback persistence adapter
    fitplan.css            FitPlan styles
    main.tsx               React entry point
  package.json             Scripts and dependencies
  vite.config.ts           Vite configuration
```

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Start the API server:

```bash
npm run dev:server
```

Start the frontend and API together:

```bash
npm run dev:all
```

Expected local services:

- Vite frontend: `http://localhost:5173`
- API server: `http://localhost:3001`
- MongoDB: `mongodb://127.0.0.1:27017`

Build the app:

```bash
npm run build
```

Run linting:

```bash
npm run lint
```

Run API and persistence tests:

```bash
npm run test:server
```

Preview the production build:

```bash
npm run preview
```

## AI Generation Note

The current generation flow is still implemented in the frontend and calls Anthropic directly. A spec exists to replace this with a secure server-side OpenAI integration using an `OPENAI_API_KEY` environment variable.

Do not put API secrets in Vite client environment variables. Browser bundles are public.

