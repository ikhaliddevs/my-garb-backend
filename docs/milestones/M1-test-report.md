# Milestone 1 test report

Original implementation verification: 2026-10-16. Latest local review: 2026-10-24 (Africa/Lagos).

## Environment and latest local results

Windows PowerShell; Node v26.3.1; npm 11.16.0; installed MongoDB Community Server 8.3 with running MongoDB service. Integration tests connect only to `mongodb://127.0.0.1:27017/mygarb_phasonable_test`. No test writes or deletes database data.

| Command | Actual result |
| --- | --- |
| `npm.cmd ci --fetch-retries=0 --fetch-timeout=15000` | PASS: 188 packages installed in 42 seconds; no new audit count reported |
| `npm.cmd run lint` | PASS: ESLint 10, zero errors |
| `npm.cmd test` | PASS: 18 tests, 17 passed, 0 failed, 1 explicitly skipped; 7.854 seconds |
| `git diff --check` | PASS: no whitespace errors; Git emitted Windows line-ending notices |

The one local skip is the POSIX SIGTERM process test: Windows child.kill force-terminates instead of delivering a POSIX signal. Real HTTP/database graceful closure and idempotence passed locally. Ubuntu CI is configured to run the signal test without skipping.

These checks were executed during the 24 October review at `ef313566f444bcd77876572ddb6e14cfd55cd958`, with the supplied PRD present locally. This delivery follow-up changes documentation only; application code, tests, dependencies, lockfile and CI configuration are unchanged. The original 16 October run also had 17 passed, 0 failed and 1 skipped, in 7.773 seconds; its clean install reported zero vulnerabilities. The latest install again warned that the optional `@scarf/scarf` postinstall script was not approved; install and checks passed without approving it. MongoDB was running for the latest tests; its installed version was recorded during the original verification, not re-queried during this review.

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

Current-history implementation commit: `91848b61f0ef32a2f838c544215d061b20662520`. Reviewed documentation baseline: `ef313566f444bcd77876572ddb6e14cfd55cd958`. Branch: `feature/milestone-01-backend-foundation`. [PR #1](https://github.com/ikhaliddevs/my-garb-backend/pull/1) is recorded as targeting develop and unmerged, pending human review; live status must be checked separately.

Historical CI evidence was recorded for the former implementation identifier `90d32ecd4810243496f33a2da3b72efa8cf76e26`. This identifier predates the current history and is retained only to identify the original runs. At the original verification, GitHub Actions was inspected through the API without printing or storing credentials. Both historical runs completed successfully:

- [PR run 38928759785](https://github.com/ikhaliddevs/my-garb-backend/actions/runs/38928759785): completed, success.
- [Push run 38928757747](https://github.com/ikhaliddevs/my-garb-backend/actions/runs/38928757747): completed, success.

These historical runs used Node 24 and MongoDB 8.0 and executed `npm ci`, `npm run lint`, and `npm test`. The POSIX test is enabled on Ubuntu. Repository workflow permissions are contents:read only. Historical success does not establish CI success for `91848b6`, `ef31356`, or the latest documentation commit. Verify the latest pushed SHA in [PR #1 checks](https://github.com/ikhaliddevs/my-garb-backend/pull/1/checks) or [GitHub Actions](https://github.com/ikhaliddevs/my-garb-backend/actions).

During the 24 October review, GitHub CLI was unavailable, the credential lookup returned no credential, API requests failed with `fetch failed` (including the outside-sandbox retry), and browser lookups returned `Cache miss`. Therefore that review could not verify the current PR or CI. These failures are verification limitations, not CI failures. Delivery publication and a fresh remote verification are attempted separately after this documentation update; their result must be tied to the actual pushed SHA.

Publication commands executed successfully: `git diff --cached --check`, `git commit -m "feat: establish milestone 1 backend foundation"`, `git push -u origin feature/milestone-01-backend-foundation`, `node .tmp/github.cjs pr`, and `node .tmp/github.cjs ci`. The ignored helper calls GitHub REST for PR creation and workflow inspection because GitHub CLI is not installed. Final status inspection showed no tracked/untracked deliverable changes before this evidence-only update.

Postman and Compass GUI interaction and Swagger browser interaction were not executed; the import artifacts and HTTP documentation responses are provided and tested as described above. No separate Node 24 local run was performed; historical CI supplies that runtime evidence. No destructive test cleanup or development database reset occurred. No authentication or future milestone work was performed. The supplied PRD v1.1 is now included at `docs/PRD.md`; its section 10 foundation requirements were reviewed against the implementation, as mapped in M1-summary.md. Product-wide acceptance criteria remain outside M1.
