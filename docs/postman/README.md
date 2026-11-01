# M2 Postman requests and local automation

Run from the repository root with local MongoDB Community Server running:

```powershell
npm.cmd ci
npm.cmd run test:postman
```

On other shells, `npm` works in place of `npm.cmd`. Newman is pinned as a development dependency in the lockfile. No Postman login, API key, external server, or cloud publication is used.

The runner starts the actual `createApp` on a free loopback port, with normal middleware, real MongoDB models, and unchanged default rate limits. It verifies the served OpenAPI title, version 0.2.0 and login path before running the collection. It does not load or modify `.env`, or use an existing development API. Database lifecycle is explicit; importing the runner does not start it. `TEST_MONGODB_URI` optionally selects a local port, but must match `mongodb://localhost:<port>/mygarb_phasonable_test` or the `127.0.0.1` equivalent exactly. Credentials, query strings, remote hosts and other databases are rejected before connecting.

Each run uses unique fictional customer/designer emails, a random password and signing key, and Newman's fresh default in-memory cookie jar. Cleanup selects only the two exact generated emails, removes sessions belonging to those users, then removes those users. No database is dropped or reset. The server and connection close after the run. A forced process kill can leave only that run's fixtures behind; no broad cleanup is attempted. Each invocation gets a fresh server rate-limit budget.

Output contains request names, HTTP statuses, assertion counts and cleanup counts. Any runner/assertion failure produces a nonzero exit code. Raw Newman results are deliberately not exported because they contain request passwords and response cookies.

## Import into Postman

1. Import `MYGARB_Backend.postman_collection.json` and `local.postman_environment.json` from this directory.
2. Select **MY GARB Local**. Point `baseUrl` at a separately configured local test API using only `mygarb_phasonable_test`. The shipped URL is a placeholder default; do not run this collection against development data. The automated runner manages its own ephemeral URL and exits afterward.
3. Use No Auth and a fresh cookie jar for the selected hostname. Keep cookie handling enabled; use the same hostname throughout.
4. Run the complete collection once, in order, with one iteration. Leave `authPassword` blank for a generated run-scoped fictional password, or supply a private demo value (8 Unicode code points minimum, 72 UTF-8 bytes maximum). The M2 folder initializes unique emails once per run. Run the folder rather than individual dependent requests.
5. Inspect assertion results. The final request intentionally receives 429. Wait 15 minutes for the default authentication budget before another GUI run. GUI runs retain fictional accounts because the API has no delete-account route; automated runs clean only their own fixtures.

Do not export populated environments, run reports, console dumps or cookie jars. Committed environment credential/email fields are blank. Saved response examples are fictional, omit Set-Cookie, and contain no passwords or session tokens.

## Request contract and coverage

Authentication POSTs use `Content-Type: application/json` and `X-MYGARB-Request: 1`, except deliberate negative cases. Non-browser calls omit Origin; an Origin, when supplied, must be allowlisted. No bearer token is used. Login sets `mygarb_session`; subsequent requests use the jar. A revoked cookie is retained only in run-scoped memory for one replay request and then unset.

Registration body:

```json
{"name":"Demo customer","email":"{{customerEmail}}","password":"{{authPassword}}","role":"customer"}
```

Designer registration substitutes `Demo designer`, `{{designerEmail}}` and `designer`. Login sends only email and password; logout sends `{}`; current-user GET sends no body.

| Scenario | Expected HTTP / result |
| --- | --- |
| M1 liveness/readiness/OpenAPI/unknown route | 200 / 200 / 200 / 404 |
| No session, registration without login | 401 UNAUTHENTICATED |
| Missing custom header, unlisted Origin, cross-site metadata | 403 CSRF_REJECTED |
| Non-JSON auth POST | 415 JSON_REQUIRED |
| Customer and designer registration | 201; exact safe fields, active status, expected role; no session issued |
| Duplicate email | 409 REGISTRATION_CONFLICT |
| Public admin role, weak password, extra privileged field | 400 INVALID_INPUT |
| Wrong password and unknown account | 401 INVALID_CREDENTIALS, same safe envelope |
| Customer and designer login/current user | 200; exact safe fields, matching registration id/email/name/role |
| Login cookie | HttpOnly, SameSite=Strict, Path=/api, host-only |
| Logout | 200; exact Logged out envelope; expired cookie with matching attributes |
| Current user after either logout, replay of revoked cookie, repeated logout | 401 UNAUTHENTICATED |
| Eleventh login/register attempt | 429 AUTH_RATE_LIMITED and positive Retry-After |

Every M2 response also asserts JSON and no-store. Error bodies are compared exactly, excluding accidental raw input or internal fields. User responses allow only id, name, email, role and status. All 25 M2 requests have descriptions and fictional saved response examples; four existing M1 requests are preserved.

## Administrator and other checks

Dependency status: a scoped override selects Handlebars 4.7.10 under Newman, removing its critical advisory. Eighteen development dependency findings remain (11 high, 7 moderate); production audit has zero findings. See [dependency audit](../milestones/M2-dependency-audit.md) for practical impact, remaining fix options and verified compatibility. Execute only trusted collections/data.

There is no public administrator-creation, user-listing, suspension or role-restricted business endpoint in M2. Public admin registration is tested as a rejection. A trusted operator can separately use the documented protected `npm run setup:admin` command, then exercise the existing login/me/logout routes with private administrator credentials. This Newman run does not create an administrator or claim that manual check passed.

`npm test` covers protected administrator setup, role middleware, suspension/deletion, forged/expired sessions, other-session preservation, restart persistence and production cookie policy using isolated fixtures. These are distinct from Newman checks and browser GUI verification. See `../milestones/M2-test-report.md` for actual executions and limitations, including the Newman dependency audit findings.
## M4 requests and orders

The existing main collection now also contains **M4 Requests and Orders** (55 requests), with its own folder-level fixture script. Prior M1/M2 requests/scripts are preserved; the separate M3 collection remains available. Use [M4 manual guide](M4-guide.md) and the blank [M4 environment](M4-manual.postman_environment.json). Copy only the M4 folder into an already edited GUI collection; do not overwrite your M3 folder or parent scripts. Run M4 separately from M2's rate-limit checks. `npm run test:postman` executes M1/M2, M3 and M4 in separate real test API instances and cleans only run-owned records. Manual M4 execution is deferred by user choice; automated collection verification passed and full manual repetition is not required.
