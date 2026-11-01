# M3 test report

Updated: 1 November 2026, Africa/Lagos. Implementation and previously recorded automated verification passed. M3 manual Postman execution is now completed per the user, including the re-authentication retry described below. Human review and PR creation remain separate, unapproved steps. This documentation follow-up's latest pushed SHA must also pass CI before final handoff.

## Local verification

Environment: Windows, Node v26.3.1, npm 11.16.0, MongoDB Community 8.3.4; Intel Core i7-8565U, 8 logical CPUs, 16 GiB RAM. Integration tests target only guarded local `mygarb_phasonable_test`, with run-owned fixtures and cleanup. No development accounts or database reset/drop operations are used.

| Check | Actual result |
| --- | --- |
| Original-directory clean install | Two attempts failed with Windows EPERM unlinking bcrypt's loaded native module, including outside sandbox. The user chose to keep the running API and use an isolated verification copy. No process was stopped. Missing dependency files from the interrupted install were restored from the clean copy without overwriting existing files; all existing files matched. |
| Authorized isolated clean install | PASS: `npm.cmd ci --prefix .tmp/m3-verification --fetch-retries=0 --fetch-timeout=15000`; 327 packages, 49s, unchanged package/lockfile. No `.env` copied. Existing deprecation/install-script warnings retained. |
| Isolated `npm.cmd run lint` | PASS. An initial control-character-regex lint failure was corrected before final verification. |
| Isolated `npm.cmd test` with real MongoDB | PASS: 42 tests total, 41 passed, 0 failed, 1 existing Windows POSIX signal skip; 76.896s. Includes nine M3 tests and all M1/M2 regressions. Cleanup asserts zero remaining run-owned users/sessions. |
| M1/M2 Newman regression | PASS: 29 requests, 94 assertions, zero failures. |
| M3 Newman | PASS: 22 requests, 51 assertions, zero failures. Initial collection script scope errors were corrected; the initial run's zero assertions was not accepted as a pass. Final combined `npm.cmd run test:postman` passed both collections: **51 requests, 145 assertions**, zero request/assertion/runner failures. Each collection cleaned its two run-owned users; zero sessions remained. |
| Production audit | PASS: exit 0, zero findings. |
| Full audit | Exit 1: 23 findings (11 high, 12 moderate, zero critical); unresolved development-tool findings, not an audit-clean result. |
| Git whitespace check | Passed; final diff review before commit. |
| Verification-copy equivalence / OpenAPI references | PASS: 29 implementation/test/configuration/collection files matched the verified copy byte-for-byte; all 110 OpenAPI references resolved. |
| Unsafe test URI checks | PASS: M3 test module and Newman runner rejected a non-test database URI with exit 1 before connecting. |

New integration coverage includes customer/designer/admin access, anonymous access, owner isolation and mass-assignment rejection, current account status/role, CSRF/CORS methods and JSON policy, schema bounds, safe image URL handling, portfolio ownership and atomic cap under concurrent additions, discovery eligibility/search/filters/empty pages/privacy, customer measurement privacy/replacement, reconnect and actual API restart persistence. Performance test creates 50 run-owned eligible designers, warms the query and records ten requests with a one-second-per-request acceptance bound.

Final warmed discovery timings (milliseconds): **14, 19, 20, 16, 29, 17, 11, 12, 13, 12**. Each response contained 50 eligible fixtures. This is local acceptance evidence, not a production load benchmark. Both actual API process restart checks and database reconnection checks passed. The Windows-only skipped signal test remains enabled on Ubuntu CI.

## Remote verification and publication

Branch: `feature/milestone-03-profiles-discovery-measurements`. Implementation committed and pushed at **`ca678180da701a76343a410dd4940d927f69f468`**. [Push CI 41234398413](https://github.com/ikhaliddevs/my-garb-backend/actions/runs/41234398413) succeeded for that exact SHA. GitHub job 124635027006 confirms MongoDB initialization, checkout, Node 24 setup, clean install, lint, integration tests and both Postman collections all executed successfully. Downloaded logs confirm **42 tests passed, 0 failed, 0 skipped** (19.105s); M1/M2 **29 requests / 94 assertions**, M3 **22 requests / 51 assertions**, all with zero failures. CI's ten warmed discovery requests were 4ms then nine at 3ms. Raw logs stay ignored locally.

No M3 PR exists: creation was explicitly deferred, and existing PRs were not changed. GitHub confirms PR #3 merged at `2026-10-31T18:51:50Z`; its merge was fetched at `97f1d922b5032e9edd8c3c4664c706679297811a`, and M3 was safely fast-forwarded to that updated develop commit. Earlier GitHub DNS failures recovered. This report is a documentation follow-up to the verified implementation; the final delivery SHA and its own push-CI result are recorded in the final handoff and local progress notes after publication. No PR merge or M4 implementation was performed.

## Manual status

**M3 Postman manual results — user-confirmed, 1 November 2026:** all **22 M3 requests completed**, with **51 assertions passing across their successful results**. This is not a claim that every initial attempt passed or that one uninterrupted runner execution had zero failures.

| Manual check | User-reported result |
| --- | --- |
| Update private customer profile, initial attempt | HTTP **401** after a long pause. Retained as an unsuccessful initial attempt; the cause was not independently diagnosed. |
| Update private customer profile, retry | Logged in again, retried, and received HTTP **200** with **3/3 tests passing**. |
| Overall M3 requests | All 22 completed successfully after the retry; 51 passing assertions across the successful results. |
| Postman organization | Requests moved into an **M3 folder inside the user's existing collection**, preserving the M3 scripts and existing Postman edits. No exported copy of the user's edited collection was required or committed. |
| Manual setup | **MY GARB M3 Manual (isolated)**; API `http://127.0.0.2:5001/api`; separate local `mygarb_phasonable_test` database. Existing accounts and APIs preserved. |

The [manual setup guide](../postman/M3-guide.md), blank [environment template](../postman/M3-manual.postman_environment.json), and README setup link are included in this follow-up. The committed environment contains only the loopback base URL and empty fixture variables, with no generated credentials, account IDs, cookies or personal details. These GUI results are user-reported evidence, distinct from the independently executed automated checks above. This documentation update does not rerun the user's requests or modify their Postman collection, running APIs or accounts.

Documentation follow-up verification: local `npm.cmd run lint`, environment JSON/blank-value assertions, PowerShell startup-snippet parsing without execution, and `git diff --check` passed. Application code, dependencies and lockfile are unchanged. No new local clean install or integration run was performed for these documentation-only changes; the automated local results above remain historical. The latest pushed commit's CI must run clean install, lint, integration tests and both Postman collections, with the actual result recorded in the final handoff and ignored local progress notes.

M2 manual testing remains as last reported: customer/designer identity assertions need alignment with custom test accounts and rerunning (**PENDING**); rate-limit test **PASSED** per the user; the last reported designer-login attempt returned HTTP **429** while the limit was active, so that M2 login/identity check remains **PENDING**. The completed M3 checks do not silently close these separate M2 items. No personal details are copied into the reports.

## Dependency and operational limits

No dependency versions or lockfile changed in M3. Current audit reports **23 affected package entries: 11 high, 12 moderate, zero critical; production-only zero**. The increase from M2's 18 is five moderate entries in the ESLint tree: `minimatch`, `@eslint/config-array`, `eslint`, `@eslint-community/eslint-utils`, and `@eslint/js`. The root advisory is [minimatch globparts amplification denial of service](https://github.com/advisories/GHSA-g3hv-75wg-m249), affecting versions below 11.0.1 according to the npm audit response. Parent entries are propagated findings, not five independent exploits. The remaining Newman-tree findings are described in [M2 dependency audit](M2-dependency-audit.md).

The audit service proposes breaking downgrades (ESLint 4.0.0, @eslint/js 9.39.5, Newman 4.6.1), not a validated drop-in remediation. No force fix, downgrade or override was added. These findings remain unresolved development-tool risks; passing functional checks does not waive them or establish an audit-clean repository. The trusted repository collections/configuration and isolated fictional fixtures remain the supported test scope. Production audit is zero; API import inspection excludes Newman/ESLint/Postman Runtime/Handlebars. Preserve the MongoDB 8 / Ubuntu 22.04 CI compatibility fix and review the runner before retirement. Clean-install verification used the user-authorized isolated copy so the existing API could remain running.
