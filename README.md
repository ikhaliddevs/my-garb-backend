# MY GARB PHASONABLE Backend

Milestone 1 provides the REST API foundation only. No authentication, frontend, business endpoints, or models are implemented. No PRD existed in the initial empty repository; the supplied Milestone 1 brief is the current specification.

## Setup

Install Node.js 24 LTS (recommended, `.nvmrc`), MongoDB Community Server 8.x, MongoDB Compass, Git, and optionally Postman. Node 26 is also accepted; CI uses Node 24. Windows PowerShell users can use `npm.cmd` if execution policy blocks `npm`.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Edit `.env` before startup. `NODE_ENV` accepts development/test/production; `PORT` defaults to 5000. `MONGODB_URI` and `FRONTEND_ORIGINS` are required. Origins are comma-separated exact HTTP(S) origins without paths or trailing slashes. Example: `http://localhost:3000,http://localhost:5173`. No wildcard or credentialed CORS is enabled. CORS controls browser access to responses, not authentication.

### Local MongoDB and Compass

On Windows, install MongoDB Community Server as a service. Check `Get-Service MongoDB`; if stopped, run `Start-Service MongoDB` from an administrator terminal. On Linux with a service installation, use `sudo systemctl start mongod`. Alternatively, run `mongod --dbpath <data-directory>` in another terminal. Never delete or reset existing database files.

Connect Compass to `mongodb://127.0.0.1:27017`. Development uses `mongodb://127.0.0.1:27017/mygarb_phasonable`. The database appears in Compass after a later milestone writes data; this foundation creates no collections. Keep MongoDB bound to loopback.

### Commands

```text
npm run dev     # watch mode
npm start       # normal startup; set NODE_ENV=production in deployment environment
npm run lint
npm test
```

Tests require real MongoDB and default to `mongodb://127.0.0.1:27017/mygarb_phasonable_test`. `TEST_MONGODB_URI` may override the port but must use localhost/127.0.0.1 and exactly that database name. Tests do not load `.env`, write data, or drop databases. Unavailable MongoDB fails integration tests rather than silently skipping them.

Startup validates configuration, connects MongoDB, then listens. Connection or port failures abort startup with a safe diagnostic. SIGINT/SIGTERM close HTTP and MongoDB; active HTTP requests get five seconds to drain. Readiness follows Mongoose connection state and driver heartbeat timing; it is not an immediate database ping.

## API

- Swagger UI: http://localhost:5000/api/docs
- OpenAPI JSON: http://localhost:5000/api/docs.json
- GET `/api/health/live`: 200, `{"success":true,"data":{"status":"alive"}}`
- GET `/api/health/ready`: 200, `{"success":true,"data":{"status":"ready"}}`; disconnected: 503, `{"success":false,"error":{"code":"NOT_READY","message":"Service is not ready"}}`
- Unknown route: 404, `{"success":false,"error":{"code":"NOT_FOUND","message":"Route not found"}}`

All endpoints are public and need no body. JSON is bounded to 16 KB. Error envelopes use `{success:false,error:{code,message}}`. Malformed JSON returns 400; oversized bodies 413; unsupported encoding/charset 415; unexpected errors 500. Raw errors and stacks never enter responses. Helmet sets security headers. API responses disable caching. Logs contain only method, status, and duration, excluding URLs, headers, cookies, and bodies. Non-health API requests are limited to 100/minute/IP with JSON 429 responses; health probes are exempt. Trust proxy is disabled; configure it deliberately before proxy deployment. The limiter is process-local and needs a shared store before horizontal scaling.

## Postman

1. Import `docs/postman/MYGARB_Backend.postman_collection.json` and `docs/postman/local.postman_environment.json`.
2. Select **MY GARB Local** (`baseUrl=http://localhost:5000/api`). Start MongoDB and the API.
3. Run the collection: liveness, readiness, OpenAPI JSON, and unknown route each have response assertions.
4. Safe readiness failure demo: run a separate `mongod` on port 27018 using a new temporary data directory. In a separate API terminal set `$env:PORT='5001'` and `$env:MONGODB_URI='mongodb://127.0.0.1:27018/mygarb_phasonable_test'`, then `npm start`. Point Postman to `http://localhost:5001/api`. Stop only the isolated MongoDB process, wait for driver detection, and send Readiness (503) and Liveness (200). The normal readiness assertion intentionally fails in this demo. Restart the isolated MongoDB and wait for readiness recovery. Never stop a shared development database for a demonstration.

## Structure and workflow

```text
src/app.js              Importable Express factory
src/server.js           Startup and graceful shutdown
src/config/             Environment and database lifecycle
src/routes/             Health routes
src/middleware/         Error and 404 handling
src/docs/               OpenAPI specification
tests/                  HTTP and real MongoDB tests
docs/postman/           Collection and local environment
docs/milestones/        Scope, evidence, next prompt
.github/workflows/      CI with MongoDB service
```

`main` holds stable approved code; `develop` integrates milestones. This milestone uses `feature/milestone-01-backend-foundation`. PRs target `develop`; review before merging and promote to `main` separately. Never force-push. CI runs `npm ci`, lint, and tests with MongoDB 8.0 and read-only repository permissions. See the test report for actual local and CI results.

## Limitations

No deployment infrastructure or business functionality is included. No PRD was supplied; confirm roles and business rules from it before Milestone 2. Automated HTTP checks do not imply Compass or Postman GUI testing. Do not start Milestone 2 without explicit approval.
