# M3 Postman examples and manual checks

Use the separate M3 collection and manual environment below. Preserve your edited M1/M2 collections, environments, cookies and accounts. Do not reimport over existing edited items, clear all cookies, change `.env`, or reset/drop either database.

## Exact files

- Collection: `C:\Users\user\Documents\my-garb-backend\docs\postman\MYGARB_M3.postman_collection.json`
- Dedicated manual environment: `C:\Users\user\Documents\my-garb-backend\docs\postman\M3-manual.postman_environment.json`
- This guide: `C:\Users\user\Documents\my-garb-backend\docs\postman\M3-guide.md`

## Start a separate M3 API on Windows

1. Leave the existing API terminal/process running. Open a **new PowerShell window**. Ensure local MongoDB Community Server is running (read-only check: `Get-Service MongoDB`). If MongoDB was installed without a Windows service, use its existing local process instead. Do not stop MongoDB or delete its data.
2. Run the following in the new window. These settings apply only to this shell and its child API; they do not edit `.env` or the existing server. Existing shell variables take precedence over dotenv in this repository. The signing key is generated in memory and is not printed or saved to a tracked file.

```powershell
Set-Location 'C:\Users\user\Documents\my-garb-backend'
git branch --show-current
# Expected: feature/milestone-03-profiles-discovery-measurements
# If another branch is active, stop here; do not switch over unsaved work.

$env:NODE_ENV = 'test'
$env:PORT = '5001'
$env:MONGODB_URI = 'mongodb://127.0.0.1:27017/mygarb_phasonable_test'
$env:TEST_MONGODB_URI = $env:MONGODB_URI
$env:FRONTEND_ORIGINS = 'http://127.0.0.2:5001'
$env:SESSION_TTL_SECONDS = '3600'
$env:JWT_SECRET = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
npm.cmd start
```

The installed dependencies can be reused. Do not run `npm ci` in this working directory while the original API holds bcrypt open; that previously caused an EPERM error. If dependencies are missing, use an isolated verification copy as documented in the M3 test report rather than stopping the original API.

The test database is separate from `mygarb_phasonable` on the same MongoDB server. It may already contain test accounts: retain them. Startup creates indexes, not a database reset. The M3 collection registers uniquely named fictional accounts and updates only its authenticated fixture users; GUI-created fixtures remain afterward. Setting `TEST_MONGODB_URI` alone does **not** redirect `npm start`; the `MONGODB_URI` setting above is essential.

Port 5001 must be free. If startup reports a port conflict, do not terminate the existing listener. Choose a free port such as 5002 and update `PORT`, `FRONTEND_ORIGINS` and the new Postman environment's `baseUrl` together. Start the new process again. Keep the same JWT key in this dedicated shell when restarting for persistence checks; a newly generated key requires logging in again but does not delete accounts.

3. Verify the new instance at:

   - `http://127.0.0.2:5001/api/health/ready` — HTTP 200 and ready.
   - `http://127.0.0.2:5001/api/docs.json` — title `MY GARB PHASONABLE Backend`, version **0.3.0**, and `/api/measurements` present.
   - `http://127.0.0.2:5001/api/docs/` — Swagger UI.

Use **127.0.0.2** consistently for this manual API. Cookies are scoped to host, not port: using localhost on another port can replace an existing localhost session cookie. Reserve 127.0.0.2 for M3; if you already use that hostname for another session, choose another unused loopback address such as 127.0.0.3 and change the API origin, URLs and new environment together. The MongoDB URI stays on 127.0.0.1.

## Preserve your Postman changes

The user completed manual verification with these requests in an **M3 folder inside an existing collection**, preserving the M3 scripts. Keep that edited folder; reimporting is not necessary. If arranging a fresh copy this way, preserve both request scripts and fixture-initialization scripts at the appropriate folder/collection scope without overwriting unrelated parent scripts. Run only the M3 folder for this baseline. The import steps below apply to a new setup.

1. Import the M3 collection and **M3-manual.postman_environment.json** as new items. Do not overwrite an existing edited M3 collection/environment if Postman detects a duplicate; keep that item and use a separately named copy for the baseline run. Do not reimport the shared `local.postman_environment.json` over your current environment.
2. Select **MY GARB M3 Manual (isolated)**. Confirm its `baseUrl` is `http://127.0.0.2:5001/api`. Its `fixtureMode`, `m3FixtureReady`, emails, password and generated IDs should initially be blank. Do not copy your custom-account credentials into this environment: the collection generates new fictional fixtures and replaces these fixture variables.
3. Keep the cookie jar enabled for the cookie login flow. Use the previously unused M3 hostname; do not clear cookies for localhost/127.0.0.1 or other projects. Check for any request/global variable override of `baseUrl` that might point to the old API.
4. Run the M3 collection once, from **Register M3 customer** through **Logout M3 designer**, in order. The baseline is **22 requests / 51 assertions**, zero failures. Normal negative checks intentionally return 400, 403 and 404. The last steps delete the fixture's portfolio entry and log out, so an empty discovery result afterward is expected. To inspect a populated portfolio, pause after **Read public designer detail**.
5. For a new full run, clear only `m3FixtureReady` in this new environment (keep `fixtureMode` blank). The first request then generates new unique fixture emails/password; do not clear or edit your old environments. For inspecting the same fixtures, retain the generated values and start with the appropriate login request rather than rerunning registration. After a 429, wait for the 15-minute authentication window to expire; do not count it as a successful login.

If a protected request returns 401 after a long pause, log in again as the appropriate fixture user, then retry that request. Keep both outcomes in your results. In the completed manual checks, **Update private customer profile** initially returned 401; after logging in again it returned 200 with 3/3 tests passing. Re-authentication resolving the request does not independently establish the cause of the initial 401.

Never export or commit populated environments/cookies. For private GUI-only work, keep generated secrets local. Do not copy actual account details into reports. The automated `npm run test:postman` runner is separate: it starts its own test API and cleans only its own users/sessions; it is not required to start this manual instance.

When finished, press Ctrl+C **only in the new M3 terminal** and close that window to discard its temporary settings. Leave the original API terminal and MongoDB running. No account or database deletion is required.

M3 has 22 requests, with status/envelope assertions, ownership/role failures, validation failures, saved-field checks, discovery and public-field checks. The runner first executes the unchanged M1/M2 collection, then M3 with fresh fixtures and a separate API rate-limit budget. Keep the default limits: after repeated manual logins or the M2 rate-limit test, wait for the 15-minute auth window to expire before retrying. A 429 is not successful login evidence.

Send `Content-Type: application/json` and `X-MYGARB-Request: 1` on writes. Login uses the existing cookie flow, not a bearer token.

| Request | Fictional body/query | Expected |
| --- | --- | --- |
| PATCH /api/profile (customer) | `{"name":"Sample Customer","phone":"+1 (202) 555-0100"}` | 200 own profile; phone private |
| PATCH /api/profile (designer) | `{"businessName":"Sample Studio","biography":"Fictional studio","location":"Sample City","specialties":["Formal"],"available":true}` | 200; not discoverable until portfolio exists |
| POST /api/portfolio | `{"title":"Sample garment","category":"Formal","imageUrl":"https://example.com/sample.jpg"}` | 201; save entry id; URL is illustrative |
| GET /api/designers | `?q=Sample&location=Sample%20City&available=true&limit=20&page=1` | 200 public fields and pagination only |
| GET /api/designers/:id | Use created designer id | 200 eligible designer; no email/phone/measurements |
| PUT /api/measurements (customer) | `{"unit":"cm","values":[{"label":"Chest","value":90}]}` | 200 set with server updatedAt |
| GET /api/measurements (customer) | No body/query | 200 own set; another customer gets their own set/null |
| GET /api/measurements (designer/admin) | No body/query | 403 |
| DELETE /api/portfolio/:id | `{}` | 200 owner deletion; 404 foreign/missing entry |

Check persistence by restarting only your test API and reading saved profiles/measurements. Verify missing business name/location/specialties/portfolio excludes the designer. Test with a second fictional owner: profile IDs cannot be selected, measurement owner query parameters fail, foreign portfolio deletion fails. No suspend API is introduced; suspension/current-role behavior is covered by isolated integration fixtures.

M2 custom-account GUI identity assertions remain pending: align expected names/emails/IDs privately and rerun after the active rate limit expires. Do not put those account details in tracked files. User-reported rate-limit success is recorded separately from the latest designer login's 429 and pending successful identity verification.
