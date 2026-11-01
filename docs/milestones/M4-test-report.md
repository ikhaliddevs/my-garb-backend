# M4 test report

Date: 1 November 2026 (Africa/Lagos). Implementation and local automated verification passed; remote publication/CI verification pending. **All manual M4 testing remains PENDING** until the user reports actual execution. Existing M2/M3 user evidence is unchanged.

## Environment and safety

Windows, Node 26.3.1, npm 11.16.0, local MongoDB Community 8.3.4. To preserve the loaded APIs/bcrypt modules, the authorized verification uses ignored `.tmp/m4-verification` with copied source/tests/scripts/docs and the unchanged package/lockfile, excluding `.env` and private instruction files. Integration and Newman runners validate a local `mygarb_phasonable_test` URI before connecting. Cleanup targets only the run's fixture user IDs and their request/order/session records. No development account reset/drop is used.

## Local evidence

| Check | Actual result |
| --- | --- |
| Isolated `npm.cmd ci --prefix .tmp/m4-verification --fetch-retries=0 --fetch-timeout=15000` | PASS: 327 packages installed in approximately one minute; existing deprecation/install-script warnings retained. |
| Isolated lint | PASS. |
| Focused M4 integration suite | Initial PASS: 11 tests, 11 passed, 0 failed, 0 skipped; 15.147s. Subsequently rerun within the final full suite with journal-acknowledged writes. |
| Final isolated `npm.cmd test` | PASS: **53 total, 52 passed, 0 failed, 1 existing Windows POSIX signal skip**, 56.017s. All M1-M3 regressions and 11 M4 tests included. |
| Final isolated `npm.cmd run test:postman` | PASS: M1/M2 **29 requests / 94 assertions**, M3 **22 / 51**, M4 **47 / 106**; combined **98 requests / 251 assertions**, zero request/assertion/runner failures. Separate API instances, fresh cookie jars and unchanged default rate limits. Removed only each run's owned fixtures (2, 2 and 3 users respectively, plus their workflow/session records). |
| Existing tracked main Postman items/scripts | Verified unchanged as parsed JSON; M4 folder appended. |
| Existing OpenAPI paths | All 12 prior paths unchanged; eight M4 paths added. |
| Artifact/static validation | PASS: 35 implementation/test/configuration/collection files match the verified copy; all 199 OpenAPI references resolve; blank M4 environment contains no generated data; documented PowerShell startup snippet parses without execution. |
| Unsafe URI checks | PASS: new M4 test module and M4 Newman runner reject a non-test database URI before connecting. |
| Fresh dependency audit | Production: exit 0, zero findings. Full: exit 1, **23 development package entries (11 high, 12 moderate, zero critical)**. Initial registry timeout/TLS failures recovered on retry; the audit is not clean. |
| Preservation / whitespace | PASS: .env hash unchanged, all original Node process IDs still running, main unchanged, git diff --check passed. No dependency/lockfile changes. |

M4 tests cover role/active-account checks, foreign access and enumeration-safe 404s, mass assignment/injection/body limits, exact monetary/date/URL bounds, nonempty measurements and explicit sharing, immutable snapshots, designer response requirements, terminal/cancellation behavior, competing decisions, concurrent cancellation/confirmation, eight concurrent confirmations yielding one order, unique request index, five concurrent production retries yielding one event, all sequential actor rules, list privacy, CSRF/JSON enforcement and sanitized errors. Faults are injected before intent, before insert and after successful insertion with a lost response. A child API is restarted twice and recovers the same persisted intent/order/history. Both workflow schemas use w:1/j:true journal acknowledgement; final tests exercise these actual MongoDB writes. No test-only fault route is exposed. The M3 discovery regression also passed its ten warmed requests under one second each (9-36ms in the final local run).

## Remote, manual and dependency status

Branch: `feature/milestone-04-requests-orders`; base develop `b2f9498fd1881f68b420440302d657577862f14e`. No M4 commit/push/CI result at report preparation. Prior milestone CI is not M4 evidence. PR creation and merging are prohibited by current instructions.

Manual baseline: 47 M4 requests / 106 assertions in the main tracked collection, with required folder and request scripts and safe fictional examples. Manual guide/environment provided; **execution and assertions remain pending**, not inferred from automated success. The folder fits the unchanged authentication limit exactly (three registrations/seven logins); extra attempts may need the 15-minute window to expire. Existing GUI Postman edits, accounts, `.env` and APIs are preserved.

No dependency changes were introduced. The new audit matches M3's 23 development entries (11 high, 12 moderate, zero critical), production zero; initial registry errors were retried successfully. Known Newman/ESLint advisories and Ubuntu 22.04 runner-retirement maintenance remain unresolved; no force upgrades or audit waiver. See the prior dependency assessment and M3 report for affected tooling. These are residual development-tool risks, not a new installation blocker or a claim of production vulnerability. The supported runner scope remains trusted repository collections and fictional local/CI fixtures.

Recovery is explicitly retried by the customer; no background materializer or multi-document transaction is promised. Submission retries may create additional requests; do not use a new submission to recover confirmation. Measurement corrections are deferred to the later messaging milestone, subject to M5 scope approval. No payments, proposal revisions, messaging, notifications, admin workflow or post-confirmation cancellation is implemented.
