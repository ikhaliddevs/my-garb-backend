# MY GARB PHASONABLE Backend

M1 foundation is approved and merged into `develop`. M2 adds accounts and role-based access only. The [PRD](docs/PRD.md) defines the product scope; see [M2 summary](docs/milestones/M2-summary.md) and [test report](docs/milestones/M2-test-report.md) for evidence. Profiles, portfolios, discovery, requests, orders and other business features remain deferred.

## Setup

Use Node.js 24 LTS (recommended; `.nvmrc`) or Node 26, MongoDB Community Server 8.x, Git, and optionally Compass/Postman. Windows users can use `npm.cmd` if PowerShell blocks `npm`.

1. Run `npm ci`.
2. Copy `.env.example` to `.env` only if `.env` does not exist; preserve existing values.
3. Configure the values below. Generate a private signing key with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and save it as `JWT_SECRET` only in your local environment. Do not share the output or commit it.
4. Ensure local MongoDB is running, then run `npm run dev` (watch mode) or `npm start`.

| Variable | Meaning |
| --- | --- |
| `NODE_ENV` | development, test or production; defaults to development |
| `PORT` | API port, default 5000 |
| `MONGODB_URI` | Required development URI; example uses local `mygarb_phasonable` |
| `FRONTEND_ORIGINS` | Required comma-separated exact origins without paths/trailing slashes; include the API origin to use Swagger auth POSTs, e.g. `http://localhost:5000,http://localhost:3000` |
| `JWT_SECRET` | Required 64 hexadecimal characters generated from 32 random bytes; no default |
| `SESSION_TTL_SECONDS` | Integer 300-86400, defaults to 3600; no refresh endpoint |
| `TEST_MONGODB_URI` | Tests only; local localhost/127.0.0.1 with explicit port and exactly `mygarb_phasonable_test` |

Use the same hostname consistently in Postman/Swagger because cookies are host-scoped. If another project owns the configured port, preserve it and choose an available port, updating local configuration, origin allowlist and Postman `baseUrl` together. Start only one MY GARB instance; confirm its OpenAPI title before testing.

On Windows, inspect MongoDB with `Get-Service MongoDB`; starting a stopped service with `Start-Service MongoDB` may require an administrator terminal. Never delete/reset its data directory. Compass can connect to the local MongoDB server. M2 stores users and sessions; do not use real customer data for demos.

Startup validates configuration, connects MongoDB and creates the authentication indexes before listening. Importing modules does not connect or listen. Shutdown drains HTTP and closes MongoDB. Readiness follows driver heartbeat timing, not an immediate database ping. Startup errors are sanitized; configuration/connection details are never logged.

## API and authentication

Default base URL: `http://localhost:5000/api`. Swagger UI: `/api/docs/`; JSON: `/api/docs.json` (title `MY GARB PHASONABLE Backend`, OpenAPI 3.0.3, API version 0.2.0).

| Method/path | Behavior |
| --- | --- |
| GET `/health/live` | 200, `{success:true,data:{status:"alive"}}` |
| GET `/health/ready` | 200 ready or 503 `NOT_READY` |
| POST `/auth/register` | 201; name, email, password, role (`customer` or `designer`); returns safe user, does not log in |
| POST `/auth/login` | 200; email/password; safe user and HttpOnly session cookie |
| GET `/auth/me` | 200 safe current user; 401 for missing, expired, revoked, deleted or suspended account |
| POST `/auth/logout` | 200; send `{}`; revokes current session and expires cookie; stale/repeated logout returns 401 |

Every auth POST requires `Content-Type: application/json` and `X-MYGARB-Request: 1`. Browser `Origin`, when present, must exactly match the configured allowlist; `null`, unlisted origins and cross-site Fetch Metadata are rejected. Non-browser clients may omit Origin but still require the header. This custom-header/preflight policy plus SameSite=Strict protects against CSRF, including login CSRF. Credentialed CORS allows only configured origins. CORS alone is not authentication; do not add untrusted origins. Swagger UI is same-origin but its POST Origin still needs to be allowlisted.

Session cookie: `mygarb_session`, HttpOnly, SameSite=Strict, Path=/api, host-only; Secure in production. Production configuration requires HTTPS origins; deploy behind HTTPS before real use. Local HTTP development omits Secure. No bearer-token mode is implemented. JWT uses HS256 with fixed issuer/audience, subject and random session identifier. MongoDB stores a SHA-256 hash of that identifier and expiry; every protected request checks persisted session expiry and current active user/role. TTL deletion is housekeeping, never the authorization check. Logout deletes the current session; other logins remain valid. Revocation persists across process restart. Changing the signing key invalidates existing cookies. No refresh, password reset or email verification flow is included.

Passwords require at least 8 Unicode code points and at most 72 UTF-8 bytes; NUL is rejected and passwords are not trimmed. Bcrypt cost is 12. Email is trimmed/lowercased and uniquely indexed; duplicate registrations return safe 409 `REGISTRATION_CONFLICT`. Login failures for wrong, unknown or suspended accounts return the same 401 `INVALID_CREDENTIALS`. Registration conflict can reveal that an email cannot be registered; this is a documented MVP limitation, not a claim of complete enumeration resistance.

JSON success/error envelopes remain consistent. User responses contain only id, name, email, role and status. Bodies are limited to 16 KB; errors omit raw input, connection details and stacks. Helmet and no-store headers remain. Logs contain method/status/duration only. Login/register share 10 attempts per 15 minutes per IP, including successful attempts; general API traffic allows 100/minute/IP. Health probes bypass general limits. Limits are process-local and trust proxy is disabled; review proxy handling/shared storage before scaling.

## Protected administrator setup

Only a trusted operator with shell/database access may run `npm run setup:admin`. It is not a public API and never runs at application startup. In a private shell, supply `ADMIN_SETUP_CONFIRM=create-admin`, `ADMIN_NAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`, plus normal API/database configuration. No default administrator or credentials are supplied. Do not put a password in a committed script, CLI argument, screenshot or shell history; use a secure environment injection mechanism. Remove those admin environment variables when finished.

Setup creates one active admin with a bcrypt hash. A rerun for an existing active admin is a no-op: it does not reset their password. An existing customer, designer or suspended account causes a safe conflict, never promotion/reactivation. The command connects and closes explicitly, and logs only a sanitized outcome. Do not run it against test data unless the URI is the isolated test database. FR08 admin listing/suspension APIs are not part of M2.

## Postman and manual verification

Run `npm run test:postman` for automated M2 verification with Newman. The runner starts the actual API on a free loopback port against only local `mygarb_phasonable_test`, verifies the API contract, uses a fresh in-memory cookie jar and random fictional credentials, then cleans only its own users/sessions and closes the server. It does not load or modify development `.env`. The unchanged default rate limit is tested by the final expected 429 response.

Import `docs/postman/MYGARB_Backend.postman_collection.json` and `docs/postman/local.postman_environment.json` into Postman and select **MY GARB Local**. For GUI execution, point `baseUrl` at a separately configured local test API, use a fresh cookie jar, and run the collection once in order. A blank `authPassword` generates an ephemeral fictional password for the run. Do not export populated credentials, cookies or raw execution reports. GUI runs retain their fictional accounts; the automated runner cleans its own fixtures. Wait 15 minutes before repeating GUI runs after the final rate-limit test.

The collection contains four M1 requests and 25 M2 requests with exact success/error assertions, cookie/logout/replay checks, descriptions and safe fictional response examples. See [Postman request guide](docs/postman/README.md) for import steps, bodies, expected statuses and administrator limitations, and [M2 test report](docs/milestones/M2-test-report.md) for actual results. No public administrator route exists; protected administrator setup and role middleware are covered separately by the integration suite. Automated Newman execution does not constitute manual browser verification.

Safe readiness-outage demo: use a separate MongoDB process on 27018 with a new temporary directory and a separate API on 5001 configured for `mygarb_phasonable_test`. Stop only that isolated MongoDB, wait for detection, and check ready=503/live=200. Restart it for recovery. Never stop a shared development database or reset data. The normal readiness Postman assertion intentionally expects 200 and fails during this demo.

## Tests, structure and delivery

Run `npm ci`, `npm run lint`, `npm test`. Tests connect only to the validated isolated local test database, do not load development `.env` into their database setup, and clean only their own authentication fixtures. Startup tests may initialize indexes; no database is dropped. Integration tests fail rather than silently skip when MongoDB is unavailable. Windows skips only the POSIX child-signal test; Ubuntu CI runs it.

App creation, database lifecycle and startup remain in `src/app.js`, `src/config/database.js` and `src/server.js`. Authentication uses focused models, validators, services, middleware and routes. `scripts/setup-admin.js` is the explicit bootstrap entrypoint. Tests cover auth and the M1 regression; OpenAPI lives in `src/docs/openapi.json`.

M2 uses `feature/milestone-02-authentication-rbac` and a PR targeting `develop`. Keep `.env` and `AGENTS.md` ignored/untracked. CI runs Node 24 with MongoDB 8.0. Check the exact pushed SHA, review and request separate merge authorization. `main` remains stable. See the actual M2 report for local/CI results and limitations; M3 is only a prepared prompt, not implementation approval.
