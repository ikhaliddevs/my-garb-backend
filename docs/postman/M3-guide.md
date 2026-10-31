# M3 Postman examples and manual checks

Import `MYGARB_M3.postman_collection.json` and `local.postman_environment.json`. Use an isolated local test API, consistent hostname, a fresh cookie jar and no personal data. Run the M3 collection once in order. GUI prerequisites generate fictional emails and an ephemeral password; reset `m3FixtureReady` before a fresh run. Never export populated environments/cookies. GUI accounts remain in the test database; automated `npm run test:postman` cleans only its run-owned users and sessions.

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
