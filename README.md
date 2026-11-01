# MY GARB PHASONABLE Backend

M1-M3 provide the foundation, authentication, profiles, portfolios, discovery and private measurements. M4 adds outfit requests, explicitly shared immutable snapshots, recoverable customer confirmation and orders. The [PRD](docs/PRD.md) defines the product scope; see [M4 summary](docs/milestones/M4-summary.md) and [test report](docs/milestones/M4-test-report.md) for verification status. M4 manual testing remains pending. Messaging, measurement corrections, notifications, administration workflows and payments are not implemented.

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

Startup validates configuration, connects MongoDB and creates authentication, request/participant and unique order-request indexes before listening. Importing modules does not connect or listen. Shutdown drains HTTP and closes MongoDB. Readiness follows driver heartbeat timing, not an immediate database ping. Startup errors are sanitized; configuration/connection details are never logged.

## API and authentication

Default base URL: `http://localhost:5000/api`. Swagger UI: `/api/docs/`; JSON: `/api/docs.json` (title `MY GARB PHASONABLE Backend`, OpenAPI 3.0.3, API version 0.4.0).

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

Run `npm run test:postman` for automated M1/M2, M3 and M4 verification with Newman. Each milestone gets a separate actual API on a free loopback port against only local `mygarb_phasonable_test`, a fresh in-memory cookie jar and random fictional credentials. The runner cleans only its own users/sessions/requests/orders and closes the server. It does not load or modify development `.env`. The unchanged default rate limit is tested by the final expected M2 429 response; M3 and the M4 folder use fresh API instances and their own fixtures. Run the M4 folder alone for manual testing; do not run it after the M2 rate-limit request in the same API window.

Import `docs/postman/MYGARB_Backend.postman_collection.json` and `docs/postman/local.postman_environment.json` into Postman and select **MY GARB Local**. For GUI execution, point `baseUrl` at a separately configured local test API, use a fresh cookie jar, and run the collection once in order. A blank `authPassword` generates an ephemeral fictional password for the run. Do not export populated credentials, cookies or raw execution reports. GUI runs retain their fictional accounts; the automated runner cleans its own fixtures. Wait 15 minutes before repeating GUI runs after the final rate-limit test.

The collection contains four M1 requests and 25 M2 requests with exact success/error assertions, cookie/logout/replay checks, descriptions and safe fictional response examples. See [Postman request guide](docs/postman/README.md) for import steps, bodies, expected statuses and administrator limitations, and [M2 test report](docs/milestones/M2-test-report.md) for actual results. No public administrator route exists; protected administrator setup and role middleware are covered separately by the integration suite. Automated Newman execution does not constitute manual browser verification.

Safe readiness-outage demo: use a separate MongoDB process on 27018 with a new temporary directory and a separate API on 5001 configured for `mygarb_phasonable_test`. Stop only that isolated MongoDB, wait for detection, and check ready=503/live=200. Restart it for recovery. Never stop a shared development database or reset data. The normal readiness Postman assertion intentionally expects 200 and fails during this demo.

## Tests, structure and delivery

Run `npm ci`, `npm run lint`, `npm test`. Tests connect only to the validated isolated local test database, do not load development `.env` into their database setup, and clean only their own authentication fixtures. Startup tests may initialize indexes; no database is dropped. Integration tests fail rather than silently skip when MongoDB is unavailable. Windows skips only the POSIX child-signal test; Ubuntu CI runs it.

App creation, database lifecycle and startup remain in `src/app.js`, `src/config/database.js` and `src/server.js`. Authentication uses focused models, validators, services, middleware and routes. `scripts/setup-admin.js` is the explicit bootstrap entrypoint. Tests cover auth and the M1 regression; OpenAPI lives in `src/docs/openapi.json`.

M3 is merged into develop. M4 uses `feature/milestone-04-requests-orders`, based on M3 merge `b2f9498`. Keep `.env` and `AGENTS.md` ignored/untracked. CI runs Node 24 with MongoDB 8.0 on the retained Ubuntu 22.04 runner. M4 commit/push and CI verification are authorized; PR creation, merging, main changes and M5 implementation are not. See the M4 report for actual local/CI results and limitations.

## M3 profiles, portfolios and measurements

No new dependencies or environment variables are required. Startup creates the additional user discovery indexes through the existing explicit database preparation step. Existing users need no migration: absent optional profile fields read as empty defaults. All M3 data is embedded in the owning user document, so updates and the portfolio cap are atomic on standalone MongoDB. Existing accounts, credentials and sessions are preserved.

| Method/path | Access and behavior |
| --- | --- |
| GET/PATCH `/profile` | Customer/designer own profile; admin forbidden. Customer edits name/private phone. Designer edits businessName, biography, location, specialties, available. |
| POST `/portfolio` | Designer adds title/category/imageUrl; maximum 50 entries. |
| DELETE `/portfolio/:id` | Designer removes own entry; JSON `{}` required. Foreign/missing entry returns 404. |
| GET `/designers` | Public; q (literal name/business/specialty substring), location (exact ignoring case), available=true/false, page=1..1000, limit=1..50 (default 20). Returns designers/page/limit/hasMore. |
| GET `/designers/:id` | Public eligible active designer and portfolio; otherwise 404. |
| GET/PUT `/measurements` | Customer's own private set only. No set returns null. PUT replaces unit and values; empty values clears them. |

Every M3 write requires JSON and `X-MYGARB-Request: 1`, with the existing Origin/Fetch Metadata policy. Unknown fields, owner selectors and unsupported query parameters are rejected. Protected endpoints check the current active account and role. Profiles cannot update email identity, credentials, role or status. No designer/admin endpoint can read another customer's profile or measurements.

Customer phone is optional, private and at most 30 characters; blank clears it. Allowed characters are digits, optional leading +, spaces, parentheses, dots and hyphens (nonempty length at least 3). Name/businessName/location are at most 100 characters, biography 2000, specialties 10 unique labels of 60 characters. Portfolio title/category limits are 100/60. Text is stored as plain text; future clients must render it safely. Image references require HTTPS external DNS hostnames, maximum 2048 characters, no credentials, IP literals, local/internal/test names, fragments or non-443 ports. The API never fetches URLs or verifies that content is an image. `https://example.com/sample.jpg` is an illustrative reference, not a promised hosted asset; binary uploads remain deferred.

Discovery requires business name, location, at least one specialty and portfolio entry. Public fields are exactly id, name, businessName, biography, location, specialties, available and portfolio (entry id/title/category/imageUrl). Email, private phone, measurements, account status, password hashes and sessions are excluded. Unavailable designers remain visible unless filtered; suspended/ineligible accounts do not. Stable ID pagination uses bounded offsets; concurrent edits can shift pages. Substring search uses escaped literals and a three-second database timeout, with role/status/availability/location indexes; it is intended for MVP scale.

Measurements use `{"unit":"cm","values":[{"label":"Chest","value":90}]}` (or `in`). Maximum 50 unique case-insensitive labels of 60 characters; numbers must be finite, positive and at most 1000. Units are explicit; no implicit conversion. PUT replaces the whole set with a server timestamp; last completed write wins. Sharing and immutable request/order snapshots require a later approved milestone.

Import [M3 Postman collection](docs/postman/MYGARB_M3.postman_collection.json) with the separate [M3 manual environment](docs/postman/M3-manual.postman_environment.json), preserving your edited collections and existing environment. Follow [M3 startup instructions and manual examples](docs/postman/M3-guide.md) to launch a second API against the test database with an independent cookie hostname. Manual GUI checks remain distinct from automated evidence; remaining M2 customer/designer identity assertions require alignment with custom local accounts and rerunning. The user reported the rate-limit test passed; the latest designer login returned 429 while the limit was active, so successful login/identity confirmation remains pending.

## M4 outfit requests and orders

No new dependency or configuration is needed. M4 stores separate `outfitrequests` and `orders` collections, prepares indexes without resetting data, and works on standalone MongoDB. Private profile measurements remain owner-only; submitting a request with `shareMeasurements:true` shares a frozen copy of the customer's entire current nonempty set with the selected designer. Later profile edits never change request/order snapshots.

| Method/path | Behavior |
| --- | --- |
| POST `/requests` | Customer submits designerId, outfitType, description, quantity, desiredCompletionDate, budgetAmount, optional referenceImageUrls and explicit shareMeasurements=true. Returns 201. |
| GET `/requests`, `/orders` | Current participant summaries; page 1-1000, limit 1-50 (default 20), optional strict status filter. No measurement values in lists. |
| GET `/requests/:id`, `/orders/:id` | Participant-only details and snapshots. Foreign/missing records 404; admins forbidden. |
| PATCH `/requests/:id/decision` | Assigned designer accepts/declines a submitted request with required responseText. Acceptance also requires priceAmount and completionDate. |
| PATCH `/requests/:id/cancel` | Customer cancels submitted/accepted request; JSON `{}`. |
| PATCH `/requests/:id/confirm` | Customer confirms accepted proposal or retries recovery; JSON `{}`; returns the same single order. |
| PATCH `/orders/:id/status` | Designer advances confirmed -> in_progress -> ready; customer advances ready -> completed. Same-state retry adds no history. |

Write security/header/cookie requirements are unchanged. Money inputs are NGN decimal strings from 0.01 through 100000000.00, stored as integer kobo; output has two decimals. Dates are real YYYY-MM-DD UTC days strictly after today and at most 730 days ahead when submitted/proposed. First confirmation requires a still-future proposal date. Quantity is integer 1-100; outfitType 1-100 characters, description 1-4000, designer response 1-2000, and at most five distinct M3-validated HTTPS reference URLs. Missing/empty saved measurements fail with 409. Availability is informational; the selected designer must be active and satisfy M3 discovery eligibility. See the [refined contract](docs/milestones/M4-codex-prompt.md) for exact rules.

Confirmation atomically records a durable intent on the request, then idempotently materializes an order with a unique requestId and deterministic order ID. Concurrent retries cannot create duplicates; concurrent cancellation/confirmation has one winner. If order insertion fails, 503 `CONFIRMATION_PENDING` instructs the customer to retry that same endpoint. Request detail exposes orderId/orderPending; order lists include materialized orders only. A retry after restart, lost response or elapsed proposal date recovers the original confirmed intent without resetting status/history. There is no background recovery worker or rollback of a committed intent. Submission POST itself is not idempotent and can create additional requests if repeated.

Measurements cannot be corrected through M4 snapshot endpoints: corrections and explicit message-based agreement are deferred to the later messaging milestone. No payment/paid flag, messaging, notifications, admin workflow, proposal revision or post-confirmation cancellation is included.

The main [Postman collection](docs/postman/MYGARB_Backend.postman_collection.json) now contains **M4 Requests and Orders**, with fixture initialization at folder scope and per-request assertions. Preserve your edited GUI collection and M3 folder by copying only the new M4 folder/scripts from a temporary import. Use the blank [M4 environment](docs/postman/M4-manual.postman_environment.json) and [manual guide](docs/postman/M4-guide.md) to start a new API at `http://127.0.0.3:5002/api` against the test database without changing `.env`, existing APIs, accounts or cookies. **M4 manual testing remains pending.**
