# M2 CI MongoDB startup repair

Investigation: 30 October 2026; verification/report update: 31 October 2026 (Africa/Lagos). PR #3 targets `develop`; this follow-up performs no merge or M3 work.

## Cause and evidence

At commit `3775866cbf0efee10d13aad7837f29e6bee82533`, [PR CI 41095498643](https://github.com/ikhaliddevs/my-garb-backend/actions/runs/41095498643) and [push CI 41078305967](https://github.com/ikhaliddevs/my-garb-backend/actions/runs/41078305967) failed during MongoDB service initialization, including retry attempt 2. Checkout, install, lint, integration tests and Postman execution were skipped, not passed.

The downloaded PR attempt-2 job log (job 124206291706) and push attempt-2 job log (job 124206326004) both show the image pull and container creation/start succeeding. MongoDB then logs fatal CONTROL event 12257600: its Linux kernel compatibility guard refuses startup and references SERVER-121912. Both runners identify themselves as Ubuntu 24.04.5, image `20261025.353.1`. The `mongo:8.0` image digest was `sha256:b9924c330a8bbc5800fe9c69f04a84e221eca7b28fd049a0354147d9908fa142`. The service immediately becomes unhealthy. This is not a failed application assertion, missing signing key, database URI validation error or insufficient health-check retry budget.

[MongoDB's compatibility explanation](https://jira.mongodb.org/browse/SERVER-125742) attributes the problem to Linux rseq behavior affecting TCMalloc. Its startup guard deliberately prevents running affected combinations. Container images share the host kernel; extending a timeout cannot fix the guard. The failed log does not print the exact host kernel version, so none is inferred beyond MongoDB's reported rejection.

## Smallest fix

Change only `jobs.checks.runs-on` from `ubuntu-latest` to `ubuntu-22.04`, with an explanatory comment. [GitHub's current Ubuntu 22.04 image manifest](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2204-Readme.md) reports kernel `6.8.0-1070-azure`, below the affected kernel range. This selects a compatible host without downgrading MongoDB, bypassing its guard, adding privileged container flags, or changing application code.

Keep `mongo:8.0`, the real mongosh ping health check, Node 24, install/lint/integration/Postman steps, test-only URI validation and owned-fixture cleanup unchanged. No tests are skipped to work around the failure.

This runner pin is temporary compatibility maintenance, not an immutable kernel pin. GitHub updates hosted images and has announced Ubuntu 22.04 runner retirement; revisit before retirement, or when a supported newer host/MongoDB combination is verified. Do not replace it with a startup-guard bypass.

## Verification

Fix commit: `f203187dce036f6f9b69d2336d40729dd173e22c`. The following results were inspected on 31 October; the CI executions completed on 30 October UTC. Raw CI downloads stay in ignored temporary files; delivery contains only sanitized evidence.

| Check | Actual result |
| --- | --- |
| Local Windows `npm.cmd ci --fetch-retries=0 --fetch-timeout=15000` | PASS; 327 packages installed, existing deprecation/install-script warnings retained |
| Local `npm.cmd run lint` | PASS |
| Local `npm.cmd test` | 33 total, 32 passed, 0 failed, 1 existing Windows POSIX signal skip; 48.946s |
| Local `npm.cmd run test:postman` | 29 requests, 94 assertions, zero failures; two owned users cleaned, no remaining sessions |
| [PR CI 41106431063](https://github.com/ikhaliddevs/my-garb-backend/actions/runs/41106431063) | SUCCESS for fix SHA; MongoDB initialization, checkout, Node 24 setup, clean install, lint, integration tests and Postman all executed and passed |
| [Push CI 41106420778](https://github.com/ikhaliddevs/my-garb-backend/actions/runs/41106420778) | SUCCESS for fix SHA; same required steps executed and passed |

CI log summaries confirm 33 tests passed, zero failed, zero skipped; Postman: 29 requests, 94 assertions, zero failures. The Linux POSIX signal check runs normally. The prior service-startup blocker is resolved without suppressing checks. The documentation follow-up's own latest SHA and CI evidence are recorded in PR #3 after publication; fix-SHA checks are not substituted for checks on a later commit.

Readiness: the container-initialization blocker is resolved. Existing residual development dependency findings (11 high, 7 moderate, no critical) and manual GUI verification limitations remain as documented in the dependency assessment. No production deployment or merge is claimed.
