# Milestone 2 test report

## Local Postman automation follow-up — 30 October 2026

CI recovery verified 31 October: failed PR/push job logs identify MongoDB's host-kernel startup guard (CONTROL 12257600, SERVER-121912). Fix `f203187dce036f6f9b69d2336d40729dd173e22c` pins the runner to Ubuntu 22.04 while preserving MongoDB 8, health checks and all test steps. [PR CI 41106431063](https://github.com/ikhaliddevs/my-garb-backend/actions/runs/41106431063) and [push CI 41106420778](https://github.com/ikhaliddevs/my-garb-backend/actions/runs/41106420778) passed install/lint/tests/Postman; 33 integration tests passed with zero skips, 29 requests/94 assertions passed. Local rerun: install/lint passed, 32 tests passed/1 Windows skip, Newman 29/94 passed. See [cause, fix and execution report](M2-ci-repair.md). Final documentation-head checks are recorded in PR #3 after publication.

Delivery status correction: GitHub inspection on 30 October confirmed PR #2 was already merged on 27 October at 14:14:32 UTC (15:14:32 Africa/Lagos), merge commit `e35459d82dcb6539fcfe1c1c3c0b68f9bfef2d3a`. Earlier open/unmerged statements below describe the original handoff and were stale. The Postman follow-up is prepared on the same M2 branch; its latest commit and CI evidence are recorded on GitHub after publication. No merge is performed by this follow-up. The remaining development findings are assessed as non-blocking for trusted M2 functional scope, subject to reviewer acceptance; see the approval assessment in the dependency report.

Later dependency remediation on the same date: the scoped Handlebars 4.7.8 → 4.7.10 patch removed the critical finding. Current full audit: 18 (11 high, 7 moderate, 0 critical), production: 0. Clean install/lint passed; rerun integration tests: 32 passed, 0 failed, 1 Windows skip (32.141s); Newman: 29 requests/94 assertions, zero failures. The earlier 19-finding result below is historical. See [dependency investigation and verification](M2-dependency-audit.md) for paths, compatible options, remaining risks and exact checks.

New local execution only; no new CI or manual GUI result is claimed. Branch: `feature/milestone-02-authentication-rbac`, base HEAD `4e7cbbd12e01b02a8295cd425a9eadfe1be1482f`. This follow-up is uncommitted/unpublished; no merge or next-milestone work occurred.

Inspected collection/environment, M2 reports, PRD, OpenAPI 0.2.0 and authentication implementation. Expanded from 12 to 25 M2 requests, retaining four M1 requests. Added exact envelopes, identity/role/status assertions, cookie flags, registration-without-login, revoked-cookie replay, repeated logout, security/validation rejections and default rate-limit coverage. Every M2 request has a description and fictional response example without Set-Cookie. See the [request guide](../postman/README.md).

Runner: `npm.cmd run test:postman`, pinned Newman 6.2.3, Windows PowerShell, Node v26.3.1 and real MongoDB. It starts the actual application on a free loopback port with normal middleware/default limits, verifies served OpenAPI title/version/login path, and uses only validated local `mygarb_phasonable_test`. It never loads development `.env` or reuses the development server. Random credentials and a fresh Newman cookie jar remain in memory. Cleanup targets only two unique run-owned emails and their user IDs; no database reset/drop occurs.

| Executed check | Actual result |
| --- | --- |
| Initial `npm.cmd ci --fetch-retries=0 --fetch-timeout=15000` | PASS; 207 packages in 39s, before Newman |
| Final clean install, same command with updated lockfile | PASS; 327 packages in 59s; existing install-script approval warnings retained |
| `npm.cmd run lint` | PASS; zero errors |
| `npm.cmd test` | PASS; 33 total, 32 passed, 0 failed, 1 Windows signal skip; 25.282s |
| First `npm.cmd run test:postman` | PASS; 29 requests, 94 assertions, 0 failed requests/assertions, 0 runner failures |
| Repeat Newman run after clean install | PASS; 29 requests, 94 assertions, 0 failures with independent fixtures/cookies |
| Cleanup, each Newman run | 2 owned users removed; 0 remaining sessions (logout already removed them) |
| Unsafe database URI guard | PASS; non-test URI rejected with process exit 1 before connection |
| `git diff --check` | PASS; line-ending notices only |
| `.env` and `AGENTS.md` | Both ignored and untracked; `.env` unchanged |
| `npm.cmd audit --omit=dev --fetch-retries=0 --fetch-timeout=15000` | PASS; 0 production vulnerabilities |

Observed HTTP results in both Newman runs: M1 probes/docs 200 and unknown route 404; no session 401; missing header/unlisted Origin/cross-site metadata 403 each; non-JSON 415; customer registration 201; current user before login 401; duplicate 409; public admin registration 400; wrong credentials 401; customer login/me/logout 200 each; current user after logout/revoked-cookie replay/repeated logout 401 each; designer registration 201, login/me/logout 200 each, current user after logout 401; weak password/privileged field injection 400 each; unknown account 401; eleventh authentication attempt 429 with positive Retry-After. All expected rejection assertions passed.

Failures/fixes: initial Newman download was blocked by sandbox registry access (EACCES); an authorized network retry installed it. Neither collection run had API/assertion failures. The old mostly status-only assertions were strengthened; email generation now occurs once per folder run for shared unique fixtures. Application implementation was unchanged.

Unresolved dependency limitation: `npm audit fix` without force exited 1 and left **19 development-tool findings: 7 moderate, 11 high, 1 critical**. npm proposed a breaking Newman downgrade, which was not applied. These findings remain unresolved and are not labeled passed; review before adopting the tooling in CI. Production-only audit found zero vulnerabilities. The runner executes only the repository collection and suppresses raw Newman result/failure exports containing passwords/cookies; this does not eliminate dependency risk.

Not executed by Newman: protected administrator CLI setup/login, manual Postman/Swagger GUI interaction, production HTTPS cookie behavior, or role-protected business/admin routes (none exist in M2). The newly executed integration suite separately covers administrator setup, role middleware, forged/expired sessions, account status/deletion, other-session preservation and restart revocation using isolated fixtures. No development administrator was created. Ubuntu CI evidence below is historical; no new CI/publication was requested. Human review and separate merge authorization remain pending.

## Original milestone evidence

Date: 26 October 2026 (Africa/Lagos). This report separates executed local tests, agent HTTP smoke checks, user/manual testing and remote CI. The PR description records the exact final pushed SHA and its CI runs after publication.

## Local environment and final results

Windows PowerShell; Node v26.3.1; npm 11.16.0; local MongoDB service running. Integration tests used only validated `mongodb://127.0.0.1:27017/mygarb_phasonable_test`. Each auth run generated unique fixture emails and removed only its own users/sessions. No database was dropped or reset. M1 regression checks remain included.

| Command | Actual result |
| --- | --- |
| `npm.cmd ci --fetch-retries=0 --fetch-timeout=15000` | PASS: 207 packages installed, 208 audited, 32 seconds, 0 vulnerabilities |
| `npm.cmd run lint` | PASS: ESLint, zero errors |
| `npm.cmd test` | PASS: 33 total, 32 passed, 0 failed, 1 skipped; 29.694 seconds |
| `git diff --check` | PASS; Windows line-ending notices only |

The sole skip is the inherited Windows POSIX SIGTERM child-process test. Actual graceful HTTP/database closure and the new separate-process authentication restart test passed locally. Ubuntu CI enables the POSIX test. No auth tests were skipped.

The install policy did not approve optional @scarf/scarf telemetry or bcrypt's install hook; no blanket script approval was granted. Packaged bcrypt native hashing loaded and passed the real hash/compare tests after clean install. CI separately validates the Linux runtime.

## Coverage and observed results

| Area | Result |
| --- | --- |
| Customer/designer register, login and current user | PASS; safe fields, stored cost-12 bcrypt hash, cookie and session persistence |
| Input validation | PASS; missing/invalid fields, weak passwords, 72-byte boundary, overlong ASCII/Unicode, NUL, privileged-field injection and public admin role rejected |
| Normalized email and concurrent duplicate registration | PASS; exactly one user, one 201 and one 409 |
| Credential failures | PASS; wrong, unknown and suspended accounts return identical safe 401 bodies |
| Active-account enforcement | PASS; existing cookie rejected after suspension or deletion |
| Logout | PASS; matching cookie expiry, only current session revoked, replay rejected, other session preserved |
| Persistence across restart | PASS; logout through a separate API process remains revoked after that process exits and a new process starts against the same test database |
| JWT/session checks | PASS; absent, forged, wrong algorithm/audience, expired JWT, expired database session and unregistered session identifier rejected |
| Role middleware | PASS; unauthenticated 401, wrong role 403, customer/designer/admin permissions and role changes read from database |
| Cookie/CORS/CSRF | PASS; HttpOnly/Strict/path, Secure in production, matching clear attributes, exact credentialed preflight, missing header, unlisted/null Origin, cross-site metadata and form bodies rejected |
| Abuse limits | PASS; shared auth attempt budget returns 429 while probes remain available |
| Admin setup service | PASS; explicit confirmation, validation, active admin creation/login, no-op rerun with unchanged hash, no promotion or suspended-account reset |
| Logging/error safety | PASS; metadata-only logs, generic database/internal failures, no raw credentials/hash exposure in user responses |
| Configuration | PASS; required signing key, bounded lifetime, HTTPS production origins |
| M1 regression | PASS; health, readiness disconnection, bounded connection failure, HTTP cleanup/occupied port, security/CORS/body limits, docs and sanitized CLI failure |

The tests exercise admin setup against isolated fixtures through its service; the trusted operator CLI is documented but no development administrator was created. Test-only role routes are not exposed by the application.

## Execution history and fixes

1. Read the approved prompt, PRD and local instructions; safely updated develop and created `feature/milestone-02-authentication-rbac` from M1 merge `5fc1f38efcd71f91cd63842c788b62cad6b23449`, preserving the prepared prompt.
2. Added bcrypt 6, jsonwebtoken 9 and cookie-parser 1 with the lockfile. Initial dependency audit reported one existing high-severity body-parser compressed-body denial-of-service advisory. Updated only that transitive package within its allowed range to 2.4.0; subsequent audit reported zero vulnerabilities.
3. Initial lint and suite passed: 32 total, 31 passed, 0 failed, 1 Windows skip, 29.431 seconds. Added the actual separate-process restart test to strengthen persistent revocation evidence.
4. Required clean install, lint and final suite passed as recorded above. No destructive cleanup was used, and no test failure was hidden by skipping a case.

## Runtime smoke checks and manual status

Preserved the existing local environment entries and appended only a missing random JWT signing key without displaying it. Confirmed port 5000 was available before starting one API instance with `npm.cmd start`, which reported `API started`.

Agent HTTP smoke checks on the running API: liveness 200/alive; readiness 200/ready; OpenAPI JSON 200 with title MY GARB PHASONABLE Backend, API version 0.2.0 and OpenAPI 3.0.3; unauthenticated current-user request 401; login without the security header 403. These checks did not create development accounts. The startup initialized authentication indexes without deleting records. The API base URL is http://localhost:5000/api.

M2 Postman/Swagger browser authentication interaction was not manually executed or user-confirmed. The importable collection includes 12 auth requests and blank private credential fields; README explains cookie handling, Origin configuration, CSRF headers, expected results and rate limits. M1 manual verification was previously user-confirmed and is not counted as M2 manual evidence. No production deployment or separate local Node 24 run is claimed.

## CI and delivery

Implementation commit: `32f5ff42e4b87415ab4a40642fb04d2a8ca1cf1e`. [PR #2](https://github.com/ikhaliddevs/my-garb-backend/pull/2) is open, targets `develop` and is unmerged. GitHub Actions ran Node 24 with a real MongoDB 8.0 service. Both [PR run 40262023003](https://github.com/ikhaliddevs/my-garb-backend/actions/runs/40262023003) and [push run 40261809850](https://github.com/ikhaliddevs/my-garb-backend/actions/runs/40261809850) completed successfully for this implementation SHA, including clean install, lint and tests. CI log summaries confirm **33 tests passed, 0 failed, 0 skipped**, including the POSIX shutdown test. These results are separate from the Windows results above.

This documentation follow-up records those executed results without changing application code. Its own latest pushed SHA and check results are verified after publication and recorded in PR #2 and the final handoff; the implementation runs are not substituted for checks on a later commit.

PR #2 is published against develop. Do not merge or begin M3. Human review and separate merge authorization remain required. See M2-summary.md for implementation choices, limits and setup references; M3-codex-prompt.md contains proposed next scope only.
