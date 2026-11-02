# M6 administration verification

Automated verification is the default; manual Postman repetition is deferred by user choice. Run `npm ci`, `npm run lint`, `npm test`, then `npm run test:postman` with local MongoDB running. Only local `mygarb_phasonable_test` is permitted by the test runners. Never drop/reset any database. See the [backend demonstration guide](../backend-demonstration.md).

The main [importable collection](MYGARB_Backend.postman_collection.json) includes **M6 Administration**: 20 requests and 43 assertions. The runner starts its own API on a free loopback port, creates random fictional admin/customer fixtures through internal setup, and cleans only those fixtures. It does not change `.env`, existing APIs or external Postman collections. Earlier folders and scripts remain intact. M6 adds no public admin registration or promotion route.

## Endpoint examples

Authenticate using `POST /api/auth/login` with your isolated fixture credentials. Cookies remain HttpOnly and host-scoped. Writes require `Content-Type: application/json` and `X-MYGARB-Request: 1`; browser origins must match the configured allowlist.

| Request | Expected result |
| --- | --- |
| `GET /api/admin/users?page=1&limit=20` | Admin only; id, name, role, status, createdAt, updatedAt |
| `GET /api/admin/requests?limit=20` | id, customerId, designerId, status |
| `GET /api/admin/orders?limit=20` | Same metadata plus requestId |
| `PATCH /api/admin/users/{fixtureId}/status` with `{"status":"suspended"}` | Customer/designer suspended, all previous sessions invalidated |
| Same PATCH with `{"status":"active"}` | Reactivated; fresh login required |
| PATCH targeting any admin, including self | 409 `ADMIN_STATUS_PROTECTED` |

Lists use `{success:true,data:{users/requests/orders:[...],page,limit,hasMore}}`. Status changes use `{success:true,data:{user:{...}}}` with the same safe user allowlist. Page range 1-1000, limit 1-50, default 20; unknown filters/fields are rejected. Offset pages can shift when records change. No email, phone, passwords, sessions, private chat, measurement values, commercial details or raw documents are returned.

## Optional GUI setup

Do not overwrite an edited collection or populated environment. Import a temporary copy and copy only the M6 folder into your existing collection. The [blank environment](M6-manual.postman_environment.json) contains no URLs, accounts, IDs or secrets. Set `baseUrl` only to an isolated test API; use a fresh cookie jar and a distinct loopback hostname/port. The M6 folder expects already-created fictional admin/customer fixtures and a shared ephemeral fixture password. Do not point it at personal/custom accounts: it intentionally suspends the customer fixture.

For optional setup, use the existing protected `npm run setup:admin` process in an isolated shell with `MONGODB_URI` set to the guarded local test database and process-only configuration. Use public registration for the fictional customer. Keep credentials private; never commit/export populated environments or cookies. GUI fixtures are retained unless their creator explicitly cleans them. The automated runner is the preferred repeatable path and needs no manual credential setup.

## Policy and limitations

All admin targets are protected, so self/last-active-admin races cannot remove admin access through this API. No role change, deletion, impersonation, bulk action or admin recovery endpoint is implemented. Suspension and session-version increment share one journal-acknowledged user write on standalone MongoDB. Legacy user/session records default to version zero; no destructive migration is needed. Reactivation never resets the version. A login racing suspension may receive a cookie that is immediately rejected; log in again after reactivation. An already-authorized in-flight request may finish.

Preserved running APIs still use their loaded version. Their user must schedule a restart before relying on M6 suspension enforcement across all instances; M6 cannot retrofit its session-version check into an old process. This task does not stop or restart them.
