# FitPlan

FitPlan is a personal training planner for CrossFit, Hyrox, and strength work. It helps build and track a four-week training cycle, manage available equipment, save sessions, review history, and inspect simple training stats.

## Features

- Four-week cycle view: Base, Progression, Peak, and Deload.
- Daily session planning with workout type, duration, rounds, notes, and exercises.
- Equipment management, including custom equipment.
- Exercise filtering by WOD, Hyrox, and Force.
- Session history and lightweight usage stats.
- AI session generation from the current cycle context.
- Browser persistence through `window.storage` when available, with `localStorage` fallback.

## Current Persistence

The current app is a Vite React SPA and stores data in browser-side storage.

Persisted keys:

- `fitplan:sessions`
- `fitplan:equipment`
- `fitplan:customEquipment`
- `fitplan:cycleStart`

The planned MongoDB backend is documented but not implemented yet.

## Roadmap Specs

Design specs live in `docs/superpowers/specs`.

- `2026-05-04-local-mongodb-persistence-design.md`: planned local MongoDB persistence through a backend in `server/`.
- `2026-05-04-openai-session-generation-design.md`: planned migration from the direct Anthropic browser call to a secure OpenAI backend endpoint.

Important: the backend described in those specs does not exist yet. The current app still runs as a frontend-only Vite app.

## Tech Stack

- React 19
- TypeScript
- Vite
- ESLint
- CSS in `src/fitplan.css`

## Project Structure

```text
FitPlan/
  docs/superpowers/specs/  Design specs for planned backend work
  public/                  Static public assets
  src/
    fitplan.tsx            Main FitPlan application component
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

Build the app:

```bash
npm run build
```

Run linting:

```bash
npm run lint
```

Preview the production build:

```bash
npm run preview
```

## AI Generation Note

The current generation flow is still implemented in the frontend and calls Anthropic directly. A spec exists to replace this with a secure server-side OpenAI integration using an `OPENAI_API_KEY` environment variable.

Do not put API secrets in Vite client environment variables. Browser bundles are public.

## Planned Local Backend

The planned backend will live in `server/` and provide:

- `GET /api/fitplan`
- `PUT /api/fitplan`
- `GET /api/health`
- `POST /api/generate-session`

Planned local services:

- Vite frontend: `http://localhost:5173`
- API server: `http://localhost:3001`
- MongoDB: `mongodb://127.0.0.1:27017`
