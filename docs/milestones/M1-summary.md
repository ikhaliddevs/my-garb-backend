# Milestone 1: Backend foundation

## Goal and delivered functionality

Create a maintainable, tested CommonJS Express foundation for continued milestone development and weekly demonstrations. Delivered environment validation, local Mongoose connectivity, HTTP lifecycle, safe middleware, liveness/readiness, OpenAPI/Swagger, Postman examples, real database tests, and GitHub Actions.

Status: implementation and automated verification complete. Required local checks and both GitHub Actions runs passed for implementation commit 90d32ecd4810243496f33a2da3b72efa8cf76e26. [PR #1](https://github.com/ikhaliddevs/my-garb-backend/pull/1) targets develop and awaits human review; it is not merged. See M1-test-report.md for evidence. This is not merge authorization.

## Requirements and decisions

No PRD or development documents existed in the initial empty repository. The user's M1 brief provides the foundation requirements; mapping to an unavailable PRD cannot be verified. All requested foundation categories are represented; authentication and role-based access are deferred.

- Root-level package/configuration; Node 24 LTS recommended and Node 26 accepted. Express 5 and Mongoose 9 with supported ESLint 10 and a committed npm lockfile. Mongoose 9 requires at least Node 20.19; selected Node versions exceed that requirement (https://mongoosejs.com/docs/migrating_to_9.html).
- App creation, database lifecycle, and HTTP startup/shutdown are separate. Route handlers remain small; no unused models/services/scaffolding.
- Database connects before HTTP startup. Liveness is independent of subsequent database outages; readiness reflects driver connection state. Connection failures and port conflicts are sanitized and release resources.
- Exact configurable CORS origins, Helmet, 16 KB JSON limit, metadata-only request logging, process-local rate limiting, no cache on API responses, safe centralized errors. Health probes bypass rate limits.
- Tests use a guarded local database and never write/drop data. Local MongoDB service remains untouched.
- Minimal initial commit established main/develop; all substantive work is isolated on feature/milestone-01-backend-foundation. No PR merge is authorized.

## Files changed

- Root: README.md, AGENTS.md, package.json, package-lock.json, .gitignore, .env.example, .nvmrc, eslint.config.js.
- Runtime: src/app.js, src/server.js, src/config/env.js, src/config/database.js, src/routes/health.js, src/middleware/errors.js, src/docs/openapi.json.
- Tests: tests/http.test.js, tests/database.test.js, tests/process.test.js.
- Delivery: .github/workflows/ci.yml; docs/postman/MYGARB_Backend.postman_collection.json; docs/postman/local.postman_environment.json; docs/milestones/M1-summary.md, M1-test-report.md, M2-codex-prompt.md.

## Setup and presentation

Use Node 24, run `npm ci`, copy `.env.example` to `.env`, start local MongoDB, then run `npm run dev`. Open `/api/docs` and import both Postman files. Demonstrate live/ready success, unknown route JSON, and isolated readiness failure using README instructions. Run `npm run lint` and `npm test`. Production entrypoint: `npm start` with production environment configuration.

## Acceptance checklist

- [x] Approved CommonJS stack and lockfile; no frontend/SQL/TypeScript/authentication.
- [x] Safe empty-repository initialization and main/develop/feature separation.
- [x] Environment, DB lifecycle, security middleware, response conventions.
- [x] Health endpoints, OpenAPI JSON, Swagger UI, Postman artifacts.
- [x] Real database readiness, failure, cleanup, HTTP/security/configuration tests.
- [x] Clean install, lint, and local tests executed successfully; platform-specific signal test explicitly reported.
- [x] CI workflow, setup documentation, AGENTS rules, milestone reports, next prompt.
- [x] Feature published, PR #1 targets develop, push/PR CI successful on the implementation commit.
- [ ] Human review/approval (no merge performed).

## Limitations

PRD unavailable; future roles/business scope remain unconfirmed. Rate limiting is per-process; proxy trust is disabled. Readiness follows driver heartbeat timing. Postman/Compass GUI and Swagger browser interaction were not manually exercised. Windows cannot exercise POSIX child signals; Ubuntu CI runs that test. No business persistence or deployment infrastructure is included. Stop after M1 and wait for explicit M2 approval.
