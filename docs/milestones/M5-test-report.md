# M5 automated test report

Work began 1 November 2026; delivery verification continued 2 November 2026 (Africa/Lagos). Automated verification is the required workflow. Manual Postman repetition is **DEFERRED by user choice**, not passed. Human review is separate. M5 publication/exact-SHA CI verification is pending until recorded below.

## Baseline and preservation

Verified M4 [PR #5](https://github.com/ikhaliddevs/my-garb-backend/pull/5) merged approved head `0e82d11610466317420e6da492edf5de4b70b1aa` into develop as `255df969fd3bdfb595ad9531b86bd93f8c878c62`, 1 November at 20:43:33 Africa/Lagos. Merge [CI 41343173608](https://github.com/ikhaliddevs/my-garb-backend/actions/runs/41343173608), job 124957329657: install/lint passed, 53 passed/0 failed/0 skipped (26.653s); Newman 29/94 + 22/51 + 55/125 = 106 requests/270 assertions, zero failures. The old feature and merge trees were identical; local develop advanced with a compare-and-swap fast-forward reference update, then the M5 branch was created.

Windows Node 26.3.1; clean install in ignored `.tmp/m5-verification` preserves the loaded native modules and existing APIs. No development `.env` is copied into the verification directory. Tests/runners fail closed unless URI is local `mygarb_phasonable_test`. Fixtures are random fictional accounts; cleanup filters only owned user IDs (including their notifications) and never drops/resets a database. Original API processes remain outside the test lifecycle.

## Executed local checks

| Check | Actual result |
| --- | --- |
| `npm.cmd ci --prefix .tmp/m5-verification` | PASS: 327 packages in 42s; existing deprecation/install-script notices remain. PowerShell blocks npm.ps1, so npm.cmd was used. |
| Focused initial M5 tests | PASS: 10/10, zero failures/skips (12.542s), subsequently expanded to 13 M5 tests. |
| First full suite | FAILED in the database-free HTTP fixture because the new service lacked a default models argument; corrected to preserve app construction without database connection. All 13 M5 tests in this run passed. This failed attempt is retained as evidence, not counted as final success. |
| Lint | Initial control-character-regex lint error corrected using explicit code-point validation; final isolated `npm.cmd run lint` PASS. |
| Combined Newman | PASS: M1/M2 29 requests/94 assertions, M3 22/51, M4 55/125, M5 52/117; **158 requests / 387 assertions**, zero request/assertion/runner failures. Each milestone used its own API/cookie jar and unchanged rate limits. |
| Follow-up root suite | 64 passed/1 failed/1 Windows skip: the OpenAPI path-list assertion still expected only M1-M4 paths. Updated the assertion to include all six M5 paths. No APIs or accounts were changed by this guarded run. |
| Final isolated `npm.cmd test` | PASS: **66 total, 65 passed, 0 failed, 1 existing Windows signal skip**, 70.460s. |
| Artifact and unsafe-URI guards | PASS: 41 source/test/configuration/collection files match the verification copy; all 284 OpenAPI references resolve; six prior main Postman items and parent scripts preserved; M5 scripts parse; blank environment checked; unsafe test and Newman URIs rejected before connection. Guide PowerShell parses without execution. |
| Fresh audit | Registry access initially blocked in sandbox; authenticated/network-capable retry succeeded. Full audit exit 1: **23 development package entries (11 high, 12 moderate, zero critical)**. Production audit exit 0: zero findings. No dependency/lockfile changes. |
| Preservation and whitespace | PASS: original .env hash and main ref unchanged; all five original Node process IDs remain running; .env/AGENTS.md ignored and untracked; `git diff --check` passed. |

The 13 M5 tests cover participant and admin/foreign/suspended/changed-role restrictions, body/query/field bounds, safe plain-text contracts, CSRF/CORS/JSON protections, phase linkage and pagination, terminal conversation closure, explicit consent and immutable originals, stale/superseded proposals, concurrent proposals/consent and production cutoff, reserved resolution capacity/version cap, notification isolation/dedup/read retries, failed insertion response and source acknowledgement, no historical backfill, legacy record defaults, actual child-process restart persistence/recovery and two isolated customer/designer journeys through completion. Only owned fixtures are cleaned and absence is asserted. All M1-M4 regression tests remain enabled; Windows skips only the existing POSIX child-signal test.

## Limits and remote evidence

Source events are atomically journaled with business changes; delivery happens during authenticated notification polling, not in a background worker. Retrying a poll recovers failures; callers should not resubmit business actions to recover notices. No transaction/replica-set assumption, migration reset or inferred historical backfill. Caps and pagination limitations are explicit in the guide/OpenAPI. Text POST retries are not idempotent. Original API processes continue running their previously loaded code until the user chooses to restart them.

Dependencies and lockfile are unchanged. Fresh M5 audit matches the prior 23 development package entries (11 high, 12 moderate, zero critical), production zero. Existing Newman/ESLint tooling risks are not waived by functional success. Ubuntu 22.04 runner maintenance remains. M2 custom-account manual identity/login checks remain separately pending; automated M5 evidence does not overwrite that history.

Branch: `feature/milestone-05-messages-notifications`. No PR created/modified/merged; main untouched. M6 prompt is preparation only. Exact pushed SHA/run/job evidence will be added after publication, with the final documentation SHA checked again.
