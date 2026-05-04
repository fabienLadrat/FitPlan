# OpenAI Session Generation Design

## Goal

Replace the current direct browser call to `https://api.anthropic.com/v1/messages` with a secure OpenAI integration. The OpenAI API key must be read from an environment variable and must never be shipped in the Vite browser bundle.

## Current State

`src/fitplan.tsx` contains `generateSession()`, which builds a workout prompt and calls Anthropic directly from the browser. It then parses the returned text as JSON and hydrates the session form.

This has two problems:

- Provider migration is needed: Anthropic should be replaced by OpenAI.
- API secrets cannot be kept safe in browser code.

## Recommended Architecture

Use the backend planned in `server/` as the OpenAI boundary.

The frontend will call a local API endpoint:

- `POST /api/generate-session`

The server will call OpenAI using `OPENAI_API_KEY` from its environment. The frontend will never receive the key.

## OpenAI API Choice

Use the OpenAI Responses API. Official OpenAI docs describe it as the recommended API for new text generation work, and it supports structured JSON output through response text formatting.

Use an environment-configured model:

- `OPENAI_MODEL`, defaulting to `gpt-5.4-mini`

The default is chosen as a cost-conscious model for a personal app. It can be changed without code edits.

## Request Flow

1. User clicks "Generate" in the session modal.
2. React gathers the current generation context:
   - available equipment
   - requested workout type
   - target duration
   - target rounds
   - current cycle week
   - current week's previous sessions summary
3. React sends this context to `POST /api/generate-session`.
4. Server builds the final OpenAI prompt and JSON schema.
5. Server calls OpenAI with `OPENAI_API_KEY`.
6. Server validates/parses the generated session object.
7. React receives the generated session JSON and updates the form.

## API Contract

### `POST /api/generate-session`

Request body:

```json
{
  "equipment": ["Barbell", "Bodyweight"],
  "type": "AMRAP",
  "duration": 20,
  "rounds": 3,
  "weekLabel": "Semaine 1 - Base",
  "progression": 1,
  "isDeload": false,
  "weekSummary": "Aucune séance effectuée cette semaine.",
  "weeklyCounts": {
    "highIntensity": 0,
    "strength": 0,
    "endurance": 0
  }
}
```

Response body:

```json
{
  "type": "AMRAP",
  "duration": 20,
  "rounds": 3,
  "notes": "description",
  "exercises": [
    {
      "name": "Burpee",
      "type": "WOD",
      "unit": "reps",
      "reps": 10,
      "weight": 0,
      "distance": 0
    }
  ]
}
```

## Environment Variables

Server-side only:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
```

`OPENAI_API_KEY` is required for generation. If missing, the endpoint should return a clear `500` JSON error.

## Frontend Changes

`generateSession()` should:

- stop calling `https://api.anthropic.com/v1/messages`
- call `/api/generate-session`
- send structured context instead of provider-specific prompt text
- keep the existing loading and error UI
- keep the current form update behavior

The server owns prompt construction and provider-specific parsing.

## Error Handling

The server should return JSON errors for:

- missing API key
- invalid request body
- OpenAI request failure
- invalid model output

The frontend can continue showing the existing generic generation error message.

## Testing And Verification

Verification should include:

- lint and build for the frontend
- server TypeScript or syntax check if server code is TypeScript
- manual generation flow with `OPENAI_API_KEY` defined
- manual missing-key flow confirms a clear API error and graceful frontend message

## Out Of Scope

This change does not add user accounts, streaming generation, chat history, OpenAI usage tracking, or deployment secrets management.
