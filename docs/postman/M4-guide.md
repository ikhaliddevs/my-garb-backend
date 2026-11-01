# M4 manual Postman testing

**Manual testing: PENDING.** Automated results are recorded separately in the M4 test report. Do not count a retry's success as a successful initial attempt.

## Files and preserving Postman edits

- Main collection: `docs/postman/MYGARB_Backend.postman_collection.json`, folder **M4 Requests and Orders** (55 requests). Prior tracked M1/M2 items and scripts are retained; the separate tracked M3 collection remains unchanged.
- Blank environment: `docs/postman/M4-manual.postman_environment.json`, named **MY GARB M4 Manual (isolated)**.
- OpenAPI: `/api/docs/` and `/api/docs.json`, API version **0.4.0**.

The user's GUI collection already contains an edited M3 folder. Do not overwrite that collection or its scripts with a repository import. Import the updated repository collection under a temporary distinct name, then copy **only the M4 folder**, including its folder-level pre-request script and every request test script, into the existing main GUI collection. Keep existing M1/M2/M3 folders and personal environment edits intact. If the M4 folder already exists, preserve edits before deliberately replacing any baseline item; do not silently overwrite it.

Import the M4 environment as a new environment rather than overwriting M3 or another local environment. Only baseUrl is populated in the committed template; credentials, account IDs, dates and fixture flags start blank. Never export generated credentials, cookies or IDs into tracked files. All fixtures are fictional.

## Start an independent manual API

Leave existing APIs and MongoDB running. Open a **new PowerShell window** at the repository root; confirm `git branch --show-current` is `feature/milestone-04-requests-orders`. Do not switch branches over unsaved work or reinstall loaded native modules in the active directory. Use existing installed dependencies; clean-install verification is performed in an ignored isolated copy to preserve running APIs.

```powershell
$env:NODE_ENV = 'test'
$env:PORT = '5002'
$env:MONGODB_URI = 'mongodb://127.0.0.1:27017/mygarb_phasonable_test'
$env:TEST_MONGODB_URI = $env:MONGODB_URI
$env:FRONTEND_ORIGINS = 'http://127.0.0.3:5002'
$env:SESSION_TTL_SECONDS = '3600'
$env:JWT_SECRET = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
npm.cmd start
```

These settings are process-local and override dotenv without editing `.env`. `MONGODB_URI`, not only `TEST_MONGODB_URI`, selects this manual API's database. Do not reset/drop that database: existing manual test accounts may be present. Startup prepares indexes for users/sessions/outfitrequests/orders without deleting records. If port 5002 is occupied, select a free port and change PORT, FRONTEND_ORIGINS and this new environment's baseUrl together; do not terminate another listener.

Use `http://127.0.0.3:5002/api/health/ready` (200), then `/api/docs.json` (version 0.4.0 with `/api/requests` and `/api/orders`). Reserve **127.0.0.3** for M4. Cookies are host-scoped, not port-scoped, so a new port alone does not isolate existing sessions. If this hostname is already in use for another session, choose another unused loopback address and update the origin/URLs/environment together. Do not clear existing cookies for localhost, 127.0.0.1 or the M3 host 127.0.0.2.

## Execute only the M4 folder

Select **MY GARB M4 Manual (isolated)** with baseUrl `http://127.0.0.3:5002/api`. Keep the cookie jar enabled. All `m4*` variables and fixtureMode initially remain blank. The M4 folder script generates three fictional accounts, an ephemeral password and future UTC dates. It uses distinct variable names to avoid overwriting M2/M3 fixture data.

Run **only M4 Requests and Orders** in order, not the entire parent collection: M2's final authentication-rate-limit test intentionally exhausts its budget. M4 uses the unchanged maximum of 10 authentication attempts per 15 minutes/IP (three registrations and seven logins). Extra attempts or paused sessions may require waiting for that window to expire and logging in again. Preserve initial 401/429 outcomes alongside successful retries. A 429 is not successful login evidence.

The baseline is **55 requests / 125 assertions**; manual execution remains pending. The folder registers customer/designer/unrelated-customer fixtures, completes the designer profile and portfolio, saves customer measurements, submits and cancels requests, declines with explicit response text, rejects an accepted proposal, accepts another proposal, confirms/retries confirmation, advances/completes an order, and verifies snapshot and ownership protections. Negative requests intentionally expect 400/401/403/404/409. At the end, all fixture accounts are logged out and retained for inspection. The automatic runner separately cleans only its own users/sessions/requests/orders.

For a fresh full run, clear only `m4Initialized` in this dedicated environment (keep fixtureMode blank); new emails/password/dates are generated. To inspect the same fixtures, keep values and log in as the intended participant instead of rerunning registration. Do not manually replace the generated IDs with personal accounts. In a combined collection, ensure parent scripts do not override baseUrl, authentication or these m4 variables; preserve those scripts and use a temporary baseline copy to diagnose conflicts.

## Request examples and expected behavior

All writes require JSON and `X-MYGARB-Request: 1`; session cookies provide authentication. Examples use variables, not actual account data.

| Request | JSON or query | Expected |
| --- | --- | --- |
| POST `/requests` (customer) | `{"designerId":"{{m4DesignerId}}","outfitType":"Sample outfit","description":"Fictional sample","quantity":1,"desiredCompletionDate":"{{m4DesiredDate}}","budgetAmount":"25000.00","shareMeasurements":true}` | 201, immutable snapshot of the customer's current nonempty measurement set |
| PATCH `/requests/:id/decision` (designer) | `{"decision":"accepted","responseText":"I can make this sample outfit.","priceAmount":"27500.00","completionDate":"{{m4ProposedDate}}"}` | 200 accepted proposal |
| PATCH `/requests/:id/decision` (designer) | `{"decision":"declined","responseText":"Unable to meet the requested schedule."}` | 200 declined; no price/date fields allowed |
| PATCH `/requests/:id/cancel` (customer) | `{}` | 200 from submitted/accepted; 409 after confirmation/terminal state |
| PATCH `/requests/:id/confirm` (customer) | `{}` | 200 same single order on every successful retry |
| GET `/requests` or `/orders` | `?page=1&limit=20&status=confirmed` | Own participant summaries; no measurement values |
| GET `/requests/:id` or `/orders/:id` | No body | Own participant details; unrelated 404, admin 403 |
| PATCH `/orders/:id/status` | `{"status":"in_progress"}`, then `{"status":"ready"}` by designer; `{"status":"completed"}` by customer | 200 with chronological actor/time history; no jumps/backward states |

Money uses exact decimal **strings** in NGN, 0.01-100000000.00; numeric JSON is rejected. Dates must be real YYYY-MM-DD UTC dates after today and within 730 days. See the refined M4 prompt for all field bounds. Initial submission is not idempotent: each repeated POST creates a new request. Only confirmation and same-state order updates have the documented retry guarantees.

## Recovery and additional manual checks (pending)

An accepted request becomes a durable confirmed intent before its order is inserted. If insertion fails, the endpoint returns **503 CONFIRMATION_PENDING**. Read the same request: orderId is predetermined; orderPending=true means insertion still needs recovery. Retry **PATCH the same request's confirm endpoint with `{}`** after service recovery. Do not submit a replacement request, cancel the committed intent, manually insert an order, or change snapshots. Retrying after a lost successful response returns the existing order without resetting production status/history. No background worker repairs pending intents; explicit confirmation retry is required.

Fault injection and restart recovery are automated using isolated fixtures; there is no public fault-injection API. Do not stop a shared MongoDB or alter personal records to simulate a failure. For ordinary persistence checks, stop/restart only the new M4 API terminal, keeping its signing key and environment values. Never stop the original M2/M3 APIs. If the shell/key changes, re-login; records are not deleted.

Also inspect an explicit decline with response text; customer rejection/cancellation of an accepted proposal; duplicate/concurrent confirmation returning one order; a second unrelated customer/designer receiving 404; and saved profile measurement edits leaving both snapshots unchanged. Report what was actually executed, including retries. No measurement-correction endpoint exists: correction agreement/recording is deferred to the later messaging milestone. No payments, paid flag, post-confirmation cancellation or admin access are implied.

When done, stop only the new M4 terminal and close it to discard its temporary settings. Existing fixture data may remain; no database cleanup/reset is required for manual testing.
