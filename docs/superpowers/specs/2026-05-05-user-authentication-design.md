# User Authentication And Per-User Data Design

## Goal

FitPlan should support user accounts with email/password authentication, account creation, user profile management, password reset, and per-user training data stored in MongoDB. Each authenticated user must only read and write their own equipment, sessions, planning, and related FitPlan state.

## Current State

FitPlan is a Vite React SPA backed by a local Express API and MongoDB.

Current persistence is intentionally single-user:

- `GET /api/fitplan`
- `PUT /api/fitplan`
- `GET /api/health`

The API stores one document in MongoDB:

- database: `fitplan`
- collection: `app_state`
- document id: `_id: "default"`

The frontend uses `src/fitplanPersistence.ts` to load `/api/fitplan`, save `/api/fitplan`, and fall back to browser storage if the API or MongoDB is unavailable.

This design changes the app from personal single-user persistence to authenticated multi-user persistence.

## Recommended Architecture

Add server-managed authentication using secure password hashes and httpOnly session cookies.

The browser should never receive password hashes, reset token hashes, or database credentials. The server owns all authentication, session, and user-data authorization rules.

Use MongoDB collections:

- `users`
- `sessions`
- `password_reset_tokens`
- `app_state`

The existing `app_state` collection should become user-scoped. Instead of `_id: "default"`, store one document per user:

```json
{
  "_id": "ObjectId or stable user-state id",
  "userId": "ObjectId",
  "sessions": {},
  "equipment": [],
  "customEquipment": [],
  "cycleStart": null,
  "updatedAt": "ISO date"
}
```

Add indexes:

- `users.email`: unique
- `sessions.sessionTokenHash`: unique
- `sessions.expiresAt`: TTL index
- `password_reset_tokens.tokenHash`: unique
- `password_reset_tokens.expiresAt`: TTL index
- `app_state.userId`: unique

## Authentication Model

Use email as the login identifier.

User document:

```json
{
  "_id": "ObjectId",
  "email": "user@example.com",
  "passwordHash": "argon2id or bcrypt hash",
  "displayName": "Fabien",
  "createdAt": "ISO date",
  "updatedAt": "ISO date",
  "lastLoginAt": "ISO date or null"
}
```

Password hashing should use `argon2id` if installation works cleanly on the project platform. If native dependency friction becomes a blocker on Windows, use `bcryptjs` as the fallback implementation. The implementation plan should make one explicit choice and test it.

Session document:

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "sessionTokenHash": "sha256 hash",
  "createdAt": "ISO date",
  "expiresAt": "ISO date",
  "lastSeenAt": "ISO date"
}
```

The raw session token should only exist in the cookie. Store only a hash in MongoDB.

Cookie:

- name: `fitplan_session`
- `httpOnly: true`
- `sameSite: "lax"`
- `secure: true` in production, `false` in local HTTP development
- path: `/`
- expiry aligned with session expiry

Default session duration: 30 days.

## Password Reset Model

Password reset should use a server-generated random token.

Password reset token document:

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "tokenHash": "sha256 hash",
  "createdAt": "ISO date",
  "expiresAt": "ISO date",
  "usedAt": "ISO date or null"
}
```

Default reset token duration: 30 minutes.

For local development, the API may return or log a reset URL because no email provider is configured. The response should be clearly marked as development-only:

```json
{
  "ok": true,
  "devResetUrl": "http://localhost:5173/reset-password?token=..."
}
```

For production, the API should send an email and not return the token. Email delivery is out of scope for the first implementation unless an SMTP provider is configured through environment variables.

Password reset requests must not reveal whether an email exists. The public response should always be:

```json
{ "ok": true }
```

Local development can include `devResetUrl` only when the email matches an existing user and `NODE_ENV !== "production"`.

## API

Add auth endpoints:

- `POST /api/auth/register`
  - Body: `{ "email": string, "password": string, "displayName": string }`
  - Creates user, creates default per-user app state, creates session, sets cookie.
  - Returns current user profile.

- `POST /api/auth/login`
  - Body: `{ "email": string, "password": string }`
  - Verifies password, creates session, sets cookie.
  - Returns current user profile.

- `POST /api/auth/logout`
  - Requires session cookie.
  - Deletes current session and clears cookie.
  - Returns `{ "ok": true }`.

- `GET /api/auth/me`
  - Returns current user profile if authenticated.
  - Returns `401` if unauthenticated.

- `PATCH /api/auth/me`
  - Requires session cookie.
  - Body: `{ "displayName"?: string, "email"?: string }`
  - Updates profile fields.
  - Returns updated current user profile.

- `POST /api/auth/request-password-reset`
  - Body: `{ "email": string }`
  - Creates reset token for existing users.
  - Always returns `{ "ok": true }`, plus local-only `devResetUrl` when applicable.

- `POST /api/auth/reset-password`
  - Body: `{ "token": string, "password": string }`
  - Validates unused, unexpired reset token.
  - Updates password, marks reset token used, deletes all sessions for the user.
  - Returns `{ "ok": true }`.

Update existing FitPlan state endpoints:

- `GET /api/fitplan`
  - Requires session cookie.
  - Loads app state for `currentUser.id`.
  - Returns `401` if unauthenticated.

- `PUT /api/fitplan`
  - Requires session cookie.
  - Saves app state for `currentUser.id`.
  - Returns `401` if unauthenticated.

Keep:

- `GET /api/health`
  - Does not require authentication.
  - Returns API and MongoDB availability.

## Frontend Pages And Routes

The app currently does not use a router. Add a lightweight client-side route state or introduce `react-router-dom`. Recommended: introduce `react-router-dom` because auth adds multiple real pages and protected navigation.

Routes:

- `/login`
  - Email field.
  - Password field.
  - Submit login.
  - Link to `/register`.
  - Link to `/forgot-password`.

- `/register`
  - Display name field.
  - Email field.
  - Password field.
  - Confirm password field.
  - Submit account creation.
  - Link to `/login`.

- `/forgot-password`
  - Email field.
  - Submit reset request.
  - Show neutral success message even if email does not exist.
  - In local development, if the API returns `devResetUrl`, show a development-only link.

- `/reset-password`
  - Reads `token` from query string.
  - Password field.
  - Confirm password field.
  - Submit new password.
  - On success, link to `/login`.

- `/profile`
  - Protected page.
  - Display current email.
  - Editable display name.
  - Logout button.
  - Optional email update field.

- `/`
  - Protected FitPlan application.
  - If unauthenticated, redirect to `/login`.

Add an auth provider or equivalent top-level state:

- Load `GET /api/auth/me` on startup.
- Track `user`, `authLoading`, and auth errors.
- Provide `login`, `register`, `logout`, `refreshUser`, and `updateProfile`.

## Frontend Persistence Changes

The current local fallback remains useful only before login or when the API is temporarily offline. Once auth is enabled:

- Authenticated API state is the source of truth.
- `GET /api/fitplan` and `PUT /api/fitplan` must use the current session cookie.
- Browser fallback storage must be namespaced per authenticated user where possible:
  - `fitplan:${userId}:sessions`
  - `fitplan:${userId}:equipment`
  - `fitplan:${userId}:customEquipment`
  - `fitplan:${userId}:cycleStart`
- If `GET /api/fitplan` returns `401`, the frontend should redirect to `/login` and not load another user's local fallback.
- If `GET /api/fitplan` fails because the API or MongoDB is unavailable while a user is already authenticated in memory, the frontend may use user-scoped local fallback.

Migration from the old anonymous `fitplan:*` localStorage keys:

- On first login/register, if the user has no MongoDB app state and old anonymous local keys exist, offer to import local browser data into the account.
- First implementation may automatically import after register only, because that is safest for a new account.
- Do not merge anonymous local data into an existing account without user confirmation.

## Server Data Flow

Register:

1. Validate email, password, and display name.
2. Normalize email to lowercase.
3. Reject duplicate email with `409`.
4. Hash password.
5. Insert user.
6. Insert default app state for `userId`.
7. Create session.
8. Set session cookie.
9. Return public user profile.

Login:

1. Normalize email.
2. Find user by email.
3. Verify password using constant-time password verification from the hash library.
4. Use the same generic `401` message for wrong email and wrong password.
5. Create session.
6. Set session cookie.
7. Return public user profile.

Authenticated request:

1. Read `fitplan_session` cookie.
2. Hash raw token.
3. Find unexpired session.
4. Load user.
5. Attach `currentUser` to request context.
6. Continue route handler.

Password reset:

1. Normalize email.
2. If no user exists, return public success.
3. Create reset token hash with expiry.
4. In local development, expose `devResetUrl`.
5. On reset submit, validate token hash and expiry.
6. Update password hash.
7. Mark reset token used.
8. Delete all active sessions for that user.

## Validation And Security Requirements

Email:

- Trim whitespace.
- Lowercase.
- Validate basic email shape.
- Unique in MongoDB.

Password:

- Minimum length: 10 characters.
- Must contain at least one letter and one number.
- Do not log passwords.
- Do not return password hashes.

Display name:

- Trim whitespace.
- Length: 1 to 80 characters.

Rate limiting:

- Add basic in-memory rate limiting for login and reset requests in the first implementation.
- Limits are per IP plus email when available.
- Recommended defaults:
  - login: 10 attempts per 15 minutes
  - password reset request: 5 attempts per 15 minutes

CSRF:

- SameSite=Lax cookie is acceptable for this local SPA first implementation.
- If the app later accepts cross-site requests or embeds third-party origins, add CSRF tokens.

CORS:

- In local development, allow `http://localhost:5173`.
- In production, configure allowed origin from environment variable.
- Use `credentials: true` once cookies are used.

Environment variables:

- `SESSION_SECRET`: required outside development.
- `MONGODB_URI`: defaults to `mongodb://127.0.0.1:27017`.
- `MONGODB_DATABASE`: defaults to `fitplan`.
- `PORT`: defaults to `3001`.
- `APP_ORIGIN`: defaults to `http://localhost:5173`.
- `NODE_ENV`: controls secure cookies and dev reset URL behavior.

## Error Handling

Use JSON error responses.

Common statuses:

- `400`: invalid request body.
- `401`: unauthenticated or invalid credentials.
- `403`: authenticated but not allowed, reserved for future use.
- `404`: route not found or reset token invalid.
- `409`: email already registered.
- `429`: rate limit exceeded.
- `500`: unexpected server error.
- `503`: MongoDB unavailable.

Authentication errors should avoid leaking sensitive details:

- Login should return a generic invalid credentials message.
- Password reset request should not reveal whether the email exists.
- Register may reveal duplicate email with `409` because the user is actively trying to create that account.

## UX Requirements

The auth screens should feel like part of FitPlan, not a marketing landing page.

Use a focused app-style layout:

- restrained header with FitPlan branding;
- centered form area with clear labels;
- compact validation errors near fields;
- primary action button;
- secondary navigation links.

Do not block the entire app on MongoDB if the API is up but persistence is unavailable. Show a small non-invasive message for authenticated users when training data is being served from local fallback.

Profile page:

- show email and display name;
- allow display name update;
- provide logout action;
- link back to the planner.

## Testing And Verification

Server tests:

- Register creates user, default app state, session cookie.
- Register rejects duplicate email.
- Login accepts valid password.
- Login rejects wrong password with generic `401`.
- Logout deletes current session and clears cookie.
- `GET /api/auth/me` returns profile for valid session.
- `GET /api/auth/me` returns `401` without valid session.
- Profile update changes display name.
- Password reset request returns neutral success for unknown email.
- Password reset creates token for known email.
- Password reset updates password and invalidates old sessions.
- Authenticated `GET /api/fitplan` loads only current user's state.
- Authenticated `PUT /api/fitplan` saves only current user's state.
- Unauthenticated FitPlan state endpoints return `401`.

Frontend tests or focused integration tests:

- Login route submits credentials and lands on planner.
- Register route creates account and lands on planner.
- Protected planner redirects unauthenticated users to login.
- Profile route displays current user and can logout.
- Forgot/reset password flow handles successful reset.
- Persistence adapter handles `401` without loading anonymous fallback.

Manual verification:

1. Start MongoDB.
2. Start `npm run dev:all`.
3. Register User A.
4. Add equipment and a session.
5. Logout.
6. Register User B.
7. Confirm User B does not see User A data.
8. Logout and log back in as User A.
9. Confirm User A data is restored.
10. Request password reset for User A.
11. Use local development reset link.
12. Confirm old password no longer works and new password works.

## Migration Strategy

Existing MongoDB document `_id: "default"` should not be deleted automatically.

First implementation should:

- keep the old default document untouched;
- create new user-scoped documents going forward;
- optionally offer import from anonymous browser storage after register.

A later migration can expose an admin-only or local-only script to assign the old default state to a chosen user.

## Out Of Scope

The first implementation does not include:

- OAuth providers;
- email verification;
- multi-factor authentication;
- account deletion;
- admin console;
- team/shared training plans;
- cloud deployment;
- real SMTP integration unless environment variables are provided;
- migration UI for the old MongoDB `_id: "default"` document.

## Implementation Notes

Recommended server files:

- `server/auth/authStore.ts`: user, session, and password reset persistence.
- `server/auth/passwords.ts`: password hashing and verification.
- `server/auth/tokens.ts`: random token generation and hashing.
- `server/auth/cookies.ts`: session cookie helpers.
- `server/auth/rateLimit.ts`: in-memory rate limiting.
- `server/auth/middleware.ts`: current-user middleware.
- `server/auth/routes.ts`: auth endpoints.
- `server/appStateStore.ts`: update to require `userId`.
- `server/app.ts`: mount auth routes and protect `/api/fitplan`.

Recommended frontend files:

- `src/auth/api.ts`: auth API calls.
- `src/auth/AuthProvider.tsx`: current user state and auth actions.
- `src/auth/LoginPage.tsx`
- `src/auth/RegisterPage.tsx`
- `src/auth/ForgotPasswordPage.tsx`
- `src/auth/ResetPasswordPage.tsx`
- `src/auth/ProfilePage.tsx`
- `src/auth/ProtectedRoute.tsx`
- `src/fitplanPersistence.ts`: update to handle authenticated state and `401`.

Recommended dependencies:

- `react-router-dom` for routing.
- `cookie-parser` for reading cookies on Express.
- `argon2` or `bcryptjs` for password hashing.

The implementation plan should choose the password hashing dependency explicitly after checking Windows install reliability.
