# M5 conversations, agreements and notifications

Automated verification is the default: run `npm run test:postman` against local MongoDB Community Server. The runner uses only guarded `mygarb_phasonable_test`, separate free-port APIs and fresh cookie jars for each milestone. It checks actual responses/assertions and removes only its own fictional users, sessions, requests, orders and notifications. It never loads development `.env`. No full manual collection repetition is required; manual execution is **DEFERRED by user choice**, not passed.

The main [importable collection](MYGARB_Backend.postman_collection.json) includes **M5 Conversations and Notifications**, with 52 requests / 117 assertions and its own fixture initialization script. Existing M1/M2/M4 items and scripts are preserved; M3 remains available separately. Import into a temporary collection and copy only the M5 folder with its scripts if you use an edited collection. Do not overwrite your existing collection, environment, cookies or credentials.

## Optional isolated GUI setup

Use a separate PowerShell window at the repository root. This optional command starts a new API; existing APIs stay running. Use an unused port if 5003 is occupied and update only the dedicated M5 environment URL. These process-only settings do not modify `.env`:

```powershell
$env:NODE_ENV = 'test'
$env:PORT = '5003'
$env:MONGODB_URI = 'mongodb://127.0.0.1:27017/mygarb_phasonable_test'
$env:FRONTEND_ORIGINS = 'http://localhost:3000'
$m5KeyBytes = New-Object byte[] 32
$m5Rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$m5Rng.GetBytes($m5KeyBytes)
$env:JWT_SECRET = [BitConverter]::ToString($m5KeyBytes).Replace('-', '').ToLowerInvariant()
$m5Rng.Dispose()
node src/server.js
```

Import the blank [M5 environment](M5-manual.postman_environment.json), select it and use `http://127.0.0.4:5003/api`. This loopback hostname isolates cookies from earlier milestone hosts; retain a separate cookie jar. Check `/health/ready` and `/docs.json` (version 0.5.0) on this new API. Existing running APIs continue serving the code they loaded until you choose to restart them.

Run only the M5 folder. It generates fictional credentials/dates on first use, creates three accounts and retains them in GUI runs. Do not use personal accounts or export the populated environment. The folder uses exactly ten authentication attempts (three registrations/seven logins); extra attempts may receive 429 until the 15-minute window expires. If revisiting fixtures, log in again as the correct participant and preserve any initial 401/429 result rather than treating it as a successful check. Clear only `m5Initialized` for a new fictional run after the rate window; keep `fixtureMode` blank in GUI use.

## Examples and contract

All writes use JSON, the session cookie and `X-MYGARB-Request: 1`. Unknown fields/query selectors are rejected. Foreign records return 404; admin access is forbidden. Text is plain text, never HTML: future clients must use `textContent` or equivalent safe rendering.

| Method/path | Body or query | Result |
| --- | --- | --- |
| POST `/requests/:id/messages` | `{"text":"Please review the corrected measurements."}` | 201 with message ID, actor, time, text, kind and request/order linkage |
| GET `/requests/:id/messages` | `?page=1&limit=20` | Participant history, including request-phase messages after confirmation |
| POST `/orders/:id/amendments` | `{"expectedVersion":0,"unit":"cm","values":[{"label":"Chest","value":95}],"explanation":"Please review this complete correction."}` | Designer records version 1 and proposal message; 201 |
| PATCH `/orders/:id/amendments/accept` | `{"version":1}` | Customer records explicit consent to those exact values/unit/version; 200 |
| PATCH `/orders/:id/amendments/withdraw` | `{"version":1}` | Designer withdraws a pending proposal; 200 |
| GET `/orders/:id/amendments` | `?page=1&limit=20` | Immutable original, effective set, current/pending version and agreement audit |
| GET `/notifications` | `?page=1&limit=20` | Own metadata-only notifications; polling also recovers durable pending events |
| PATCH `/notifications/:id/read` | `{}` | Own notification's first readAt; same retry preserves it |

Example consent response (fictional identifiers):

```json
{"success":true,"data":{"amendment":{"version":1,"measurements":{"unit":"cm","values":[{"label":"Chest","value":95}],"capturedAt":"2026-11-01T20:00:00.000Z"},"designerId":"000000000000000000000002","customerId":"000000000000000000000001","proposedAt":"2026-11-01T20:00:00.000Z","proposalMessageId":"000000000000000000000003","consentMessageId":"000000000000000000000004","acceptedAt":"2026-11-01T20:01:00.000Z","withdrawnAt":null,"supersededAt":null}}}
```

Messages allow 1-2000 characters after trimming (raw input at most 2000), newline/tab but no other ASCII controls. Pagination is page 1-1000 / limit 1-50. Each phase stores at most 500 messages, including agreement records; a pending proposal reserves one resolution slot. At most 50 proposals are supported. Every proposal replaces the full nonempty set with explicit cm/in and the existing M3 numeric/label limits. Starting production requires no pending proposal. Accepted records remain unchanged; later profile edits and arbitrary chat never imply consent. Once production starts, no new proposal or resolution can change measurements. A retry of an already successful consent/withdrawal returns that original result without changing production.

Declined/cancelled requests and completed orders have readable, closed conversations. New messages require a submitted/accepted request or materialized confirmed/in_progress/ready order. A confirmed intent awaiting order recovery returns 409 for new messages; the customer must retry the existing M4 confirmation endpoint.

Notification events are journaled with business writes, then delivered by owner polling. Types: new_request, accepted, declined, confirmed, new_message and each order status change. Agreement messages also generate new_message notices. Notifications contain record IDs/type/time/readAt, not private text, measurements or contact data. Map types to display text in a future client. Cancellation notifications are outside this FR07 slice.

Polling handles at most 100 events and 20 source documents per collection per call. Continue polling while `deliveryPending` is true; 503 `NOTIFICATIONS_PENDING` means retry polling, not repeat the business action. Unique event IDs and idempotent inserts retain one notification and its readAt across retries/restarts. There is no daemon, external delivery or inferred historical backfill. Notification offset pages can shift when older pending events are recovered. Text POST retries can duplicate text; proposal retries with an old expectedVersion return 409, so inspect the audit before another submission.

The M5 Postman folder covers messages/linkage, exact consent, supersession, original/effective measurements, notification ownership/read retries, pagination, cancellation closure, invalid fields and foreign users. Withdrawal, completed-order closure, production races, suspended/admin/changed-role access, caps and partial-failure/restart recovery are additionally exercised by the real MongoDB integration suite. See [actual test report](../milestones/M5-test-report.md).
