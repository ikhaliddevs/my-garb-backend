# Milestone 1 test report

Date: 2026-10-16 (Africa/Lagos).

## Environment and final local results

Windows PowerShell; Node v26.3.1; npm 11.16.0; installed MongoDB Community Server 8.3 with running MongoDB service. Integration tests connect only to `mongodb://127.0.0.1:27017/mygarb_phasonable_test`. No test writes or deletes database data.

| Command | Actual result |
| --- | --- |
| `npm.cmd ci --fetch-retries=0 --fetch-timeout=15000` | PASS: 188 packages installed; audit found 0 vulnerabilities |
| `npm.cmd run lint` | PASS: ESLint 10, zero errors |
| `npm.cmd test` | PASS: 18 tests, 17 passed, 0 failed, 1 explicitly skipped; 7.773 seconds |
| `git diff --check` | PASS: no whitespace errors; Git emitted Windows line-ending notices |

The one local skip is the POSIX SIGTERM process test: Windows child.kill force-terminates instead of delivering a POSIX signal. Real HTTP/database graceful closure and idempotence passed locally. Ubuntu CI is configured to run the signal test without skipping.

## Cases

| Case | Local result |
| --- | --- |
| Real MongoDB connected readiness 200, disconnected readiness 503, liveness 200 | PASS |
| Refused connection bounded by timeout with sanitized error | PASS |
| Real HTTP server closes idempotently and disconnects DB | PASS |
| Occupied HTTP port rejects startup and closes database | PASS after fix |
| Liveness response, security headers, no framework header, no-store | PASS |
| Unavailable database produces safe readiness 503 | PASS |
| Unknown route JSON 404 | PASS |
| Malformed JSON 400, payload not echoed | PASS |
| Oversized JSON 413 | PASS |
| Exact allowed origin and preflight | PASS |
| Disallowed/missing/null origins receive no allowance; public API remains callable | PASS |
| Unexpected error safe 500 with no secrets/stack | PASS |
| JSON rate limit 429; probes stay available | PASS |
| Logging omits secrets in query/headers/cookies/body | PASS |
| OpenAPI JSON, Swagger HTML and initialization asset | PASS |
| Invalid environment configuration rejected safely | PASS |
| CLI invalid configuration exits 1 without leaking supplied URI | PASS |
| POSIX SIGTERM child process shutdown | SKIP on Windows; scheduled in Ubuntu CI |

## Execution history, issues, and fixes

1. Inspected `git status --short`, `git remote -v`, `git branch -a`, `git ls-remote --heads origin`, local files/tool versions, and MongoDB service. Origin matched the requested repository; local and remote repositories were empty. No AGENTS.md/PRD/development docs were present. Parent user-directory enumeration was denied; no inaccessible instructions were inferred.
2. Initial sandboxed remote access failed. Retried `git ls-remote --heads origin` with approved network access: succeeded. Created/pushed the minimal main/develop baseline and switched to the milestone feature branch.
3. Initial sandboxed npm install stalled and was cancelled. Successful approved commands: `npm.cmd install express@5 mongoose@9 dotenv@17 helmet@8 cors@2 express-rate-limit@8 swagger-ui-express@5 --fetch-retries=0 --fetch-timeout=15000`; `npm.cmd install --save-dev eslint@9 @eslint/js@9 globals@16 supertest@7 --fetch-retries=0 --fetch-timeout=15000`.
4. First `npm.cmd run lint` passed; first `npm.cmd test` ran 16 cases, 15 passed and 1 failed. The occupied-port test found Express 5 passes listen errors to the callback. Startup now rejects that callback error and closes MongoDB; the affected test passed on retest.
5. npm identified ESLint 9 as unsupported. Upgraded using `npm.cmd install --save-dev eslint@10 @eslint/js@10 globals@17 --fetch-retries=0 --fetch-timeout=15000`. Added CLI startup and platform-specific signal tests. The clean install/lint/full-test commands in the results table all passed.
6. npm reported optional @scarf/scarf install telemetry scripts not approved under the local npm 11 policy; no broad script approval was granted. Runtime and docs asset tests passed.

## Remote validation and remaining risks

Feature implementation commit: `90d32ecd4810243496f33a2da3b72efa8cf76e26`. Branch: `feature/milestone-01-backend-foundation`. [PR #1](https://github.com/ikhaliddevs/my-garb-backend/pull/1) targets develop and remains unmerged.

GitHub Actions was inspected through the GitHub API using the existing Git credential helper (no credentials printed or stored). Both runs completed successfully:

- [PR run 38928759785](https://github.com/ikhaliddevs/my-garb-backend/actions/runs/38928759785): completed, success.
- [Push run 38928757747](https://github.com/ikhaliddevs/my-garb-backend/actions/runs/38928757747): completed, success.

These runs used Node 24 and MongoDB 8.0 and executed `npm ci`, `npm run lint`, and `npm test`. The POSIX test is enabled on Ubuntu. CI success is independent evidence from the Windows results above. Repository workflow permissions are contents:read only. This documentation follow-up records results for the implementation SHA explicitly; subsequent workflow runs must be checked for their own status.

Publication commands executed successfully: `git diff --cached --check`, `git commit -m "feat: establish milestone 1 backend foundation"`, `git push -u origin feature/milestone-01-backend-foundation`, `node .tmp/github.cjs pr`, and `node .tmp/github.cjs ci`. The ignored helper calls GitHub REST for PR creation and workflow inspection because GitHub CLI is not installed. Final status inspection showed no tracked/untracked deliverable changes before this evidence-only update.

Postman and Compass GUI interaction and Swagger browser interaction were not executed; the import artifacts and HTTP documentation responses are provided and tested as described above. No separate Node 24 local run was performed; CI supplies that runtime. No destructive test cleanup or development database reset occurred. No authentication or future milestone work was performed. PRD mapping remains unverified because no PRD was available.
