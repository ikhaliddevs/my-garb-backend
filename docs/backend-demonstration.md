# Backend handover and demonstration

M1-M6 cover the backend MVP in PRD v1.1 FR01-FR08. M6 requires human review and user-managed integration after passing automated checks. Frontend is a separately approved phase, not another defined backend milestone. No frontend or production deployment is included.

## Start and verify

Use Node 24 LTS (Node 26 accepted), local MongoDB Community Server, and the [README setup](../README.md). Preserve any existing `.env`; supply private configuration locally. App imports never connect or listen. Run `npm ci`, `npm run lint`, `npm test`, and `npm run test:postman`. On Windows use `npm.cmd` if execution policy blocks npm.ps1. If an existing API holds a native module, perform clean-install verification in an ignored isolated source copy without `.env`; never terminate the user's API to install packages.

Tests fail closed outside local `mygarb_phasonable_test`. They use random fictional fixtures, clean only owned records and do not reset/drop databases. Newman runs actual APIs on free ports with fresh cookie jars and the normal rate limits. Safe seed/setup is the explicit protected `npm run setup:admin`; there are no default credentials or startup seeds. Automated fixtures are not durable demonstration accounts.

## Demonstration sequence and evidence

| PRD area | Demonstrate | Automated evidence |
| --- | --- | --- |
| Foundation | Liveness/readiness, Swagger `/api/docs/`, JSON `/api/docs.json` | HTTP/database/process tests; M1 Newman |
| FR01 | Registration, login, logout, current role/status, protected admin setup | Auth tests; M2 Newman |
| FR02-FR03 | Profiles, portfolio, eligible discovery and owner-only measurements | Profile tests; M3 Newman; M6 50-designer discovery benchmark |
| FR04-FR06 | Explicit sharing, designer response/price/date, customer confirmation, one order, sequential history | Order tests; M4 Newman; concurrency/recovery tests |
| FR05/FR07 | Private messages, exact amendment consent, production block, notification poll/read | Communication tests; M5 Newman; restart/recovery tests |
| FR08 | Safe admin lists, suspension, denied login/protected access, fresh login after reactivation | Admin tests; M6 Newman |
| Complete journeys | Two separately registered customer/designer pairs discover, request, agree, confirm, consent, produce and complete | M6 integration journey test; unrelated/admin private-detail denial |

Run the automated suite for the full demonstration, inspecting safe status/assertion summaries. Use only fictional examples if presenting Swagger/Compass. The tests assert persisted records and cleanup; mock interactions are not counted as end-to-end evidence. Manual collection repetition remains deferred, not passed. Existing M2 custom-account manual history is unchanged.

## Progress and delivery record

The three planned weekly checkpoints are grouped here by scope, not claimed elapsed calendar weeks: foundation/access ([M1](milestones/M1-test-report.md), [M2](milestones/M2-test-report.md)); discovery/requests/orders ([M3](milestones/M3-test-report.md), [M4](milestones/M4-test-report.md)); communication/administration/handover ([M5](milestones/M5-test-report.md), [M6](milestones/M6-test-report.md)). Reports retain failures, actual execution dates, local versus CI distinctions and deferred manual checks. This is evidence against the PRD's target schedule, not a claim that all work finished within 15 days.

## Known limitations and operational handover

- No payments, frontend, email/SMS/push, sockets, disputes, post-confirmation cancellation, password reset or email verification. No deployment hardening or production approval is implied.
- Confirmation recovery requires retrying the same endpoint; notification recovery requires owner polling. No background worker or historical-event backfill. Submission/text POST retries may duplicate content.
- Admin accounts cannot be suspended/reactivated through the API. No role changes, deletion or impersonation. Admin lists intentionally omit contact/private content; offset pages may shift.
- M6 revocation is persistent, but all serving instances must run M6 before its post-reactivation session policy can be relied on globally. Existing APIs were deliberately preserved; their owner chooses when to restart them. Already-authorized requests can finish during a suspension.
- Rate limits are process-local. Production needs HTTPS, reviewed CORS/proxy/cookie policy and an operational security review. Existing development dependency findings and Ubuntu 22.04 runner maintenance are documented in the latest report.

The next action is user review and a user-created PR from the M6 feature branch to `develop`. Do not modify `main`, auto-merge, or start frontend without separate authorization. See the [review prompt](milestones/post-M6-review-prompt.md).
