# M6 automated test report

Executed 2 November 2026 (Africa/Lagos). Local implementation and verification passed. Publication and exact-head CI are pending at this implementation commit; this is not yet a claim of remote verification. Manual Postman repetition remains **DEFERRED by user choice**.

## Prerequisite and preservation

GitHub read-only verification confirms [M5 PR #6](https://github.com/ikhaliddevs/my-garb-backend/pull/6) merged on 2 November at 05:31:33 UTC (06:31:33 Africa/Lagos), approved head `0e4ee988901d8f0eaed67f64c4ecd6b2be932b35`, merge `768534ffeb6befc6e433e4a58b773d3b86d1e664`. Merge [CI 41394533770](https://github.com/ikhaliddevs/my-garb-backend/actions/runs/41394533770), job 125112900920, passed initialization/install/lint/tests/Newman. Downloaded logs: 66 tests passed, zero failed/skipped (30.183s); Newman 158 requests/387 assertions, zero failures. Local develop was safely fast-forwarded using an ancestry check and compare-and-swap reference update. The merge tree matched the M5 feature tree; M6 was then branched from develop.

Windows Node 26.3.1 with local MongoDB. Clean install ran in ignored `.tmp/m6-verification` without copying `.env`, preserving loaded native modules and existing APIs. Only validated local `mygarb_phasonable_test` is used. Random fictional accounts and their owned records are cleaned by ID/email; no database reset/drop or personal-account mutation. Tests assert owned records are absent after cleanup. Main and `.env` hash remained unchanged; all five original Node processes remained running. External Postman state was not accessed or changed. `.env` and AGENTS.md remain ignored/untracked.

## Actual local checks

| Check | Result |
| --- | --- |
| Initial focused M6 integration | PASS: 6/6, zero failed/skipped, 31.619s. Expanded to nine tests for final verification. Mongoose deprecated `new` option warning corrected to `returnDocument: 'after'`. |
| Clean install | PASS: `npm.cmd ci --prefix .tmp/m6-verification`, 327 packages, 48s; existing deprecation/install-script notices retained. |
| Lint | PASS: root and isolated `npm.cmd run lint`. |
| Final full real MongoDB regression | PASS: **75 total, 74 passed, 0 failed, 1 existing Windows POSIX signal skip**, **137.921s**. |
| Combined actual-API Newman | PASS: M1/M2 **29/94**, M3 **22/51**, M4 **55/125**, M5 **52/117**, M6 **20/43**; **178 requests / 430 assertions**, zero request/assertion/runner failures. Each folder uses its own API and cookie jar, unchanged default rate limits. |
| M6 discovery benchmark | 50 isolated eligible designers; ten warmed calls: **10.51, 10.52, 10.79, 22.25, 17.47, 13.23, 12.62, 11.46, 11.61, 11.65 ms**; all under 1000ms. Local measurement, not a production SLA. Existing M3 performance regression also passed. |
| Artifact verification | PASS: 45 source/test/config/collection files match the clean verification copy; 320 OpenAPI references resolve; seven prior main collection items and parent scripts preserved; M6 scripts parse; optional environment entirely blank; unsafe test/Newman URIs fail before connection. |
| Audit | First sandbox registry request failed; retried with network permission. Full audit: **23 development entries (11 high, 12 moderate, 0 critical)**; production **0 findings**. No dependency/lockfile changes. |
| Preservation/whitespace | PASS: `.env`, main, five original Node processes preserved; private files ignored/untracked; `git diff --check` passed. |

No integration/Newman failures were observed in these M6 runs. The first audit-output parsing helper also failed because PowerShell redirection emitted UTF-16; the successful retry parsed the response explicitly. This tooling failure is not represented as a passing audit attempt. No required local checks are blocked. Automated runs do not constitute manual GUI execution or human approval.

## Coverage and limits

Nine M6 tests verify unauthenticated/customer/designer/changed-role/suspended restrictions; bounded pages and explicit response keys; malformed IDs, fields and bodies; CSRF/origin/JSON rules; concurrent self/peer admin protection; repeated/opposing suspension races; all-session revocation and fresh-login reactivation; zero-version legacy compatibility; persistence after database reconnect; login racing suspend/reactivate; two separately registered customer/designer discovery-to-completion journeys with M5 consent, immutable originals, notifications and private-detail isolation; and discovery performance. Existing M1-M5 tests retain actual process restart, outbox recovery, duplicate confirmation, production/consent races and ownership coverage.

Admin status and session-version updates are atomic and journal-acknowledged on standalone MongoDB. No multi-document transaction or session-deletion race. All admin targets are protected; no role changes, deletion, bulk operations or impersonation. Offset pages can shift. Already-authorized operations may finish during suspension. Existing running APIs retain old code and need a user-scheduled restart before enforcing the M6 version policy across all instances. No production deployment claim is made.

Development dependency risks are not waived; Ubuntu 22.04 runner retirement needs maintenance. Separate M2 custom-account manual identity/login checks retain their prior pending history. Payments, frontend, sockets, external notifications, disputes and post-confirmation cancellation remain out of scope.

## Publication

Branch: `feature/milestone-06-administration-handover`. CI workflow adds only this feature branch to the existing push trigger. Node 24, MongoDB 8.0, Ubuntu 22.04 and all check steps are retained. Commit/push and exact-head CI verification are authorized; no PR actions or main changes. Actual remote results will be appended after verification; final documentation-head CI is recorded in the delivery handoff and ignored local notes to avoid self-referential SHA metadata.
