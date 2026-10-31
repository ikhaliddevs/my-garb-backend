# Milestone 2: Authentication and role-based access

Implementation commit `32f5ff42e4b87415ab4a40642fb04d2a8ca1cf1e` is published in [PR #2](https://github.com/ikhaliddevs/my-garb-backend/pull/2), targeting develop, open and unmerged. Local checks passed (32 passed, 0 failed, 1 Windows skip); implementation PR/push CI passed (33 passed, 0 failed, 0 skipped). Final documentation-commit checks are recorded in the PR after publication. Human review and manual authentication verification remain pending.

Local follow-up, 30 October 2026: added `npm run test:postman` and expanded collection coverage. Two Newman runs each passed 29 requests and 94 assertions with run-owned fixture cleanup. Clean install/lint passed; integration suite: 32 passed, 0 failed, 1 Windows skip. Changes remain uncommitted/unpublished. Newman development dependency audit findings remain unresolved; production-only audit found none. See the latest [test report](M2-test-report.md) and [request guide](../postman/README.md). Manual GUI verification remains pending.

## Scope delivered

CI recovery, verified 31 October: MongoDB's kernel guard caused the previous initialization failures. Pinning the CI runner to Ubuntu 22.04 resolved them; fix commit `f203187dce036f6f9b69d2336d40729dd173e22c` passed both push and PR checks, including install, lint, 33 integration tests (no skips) and 94 Postman assertions. See [CI repair report](M2-ci-repair.md). PR #3 remains open for review; no merge or M3 work is included.

GitHub status verified 30 October: PR #2 was already merged on 27 October 2026, merge commit `e35459d82dcb6539fcfe1c1c3c0b68f9bfef2d3a`. Earlier open/unmerged references are historical. This Postman delivery continues on the existing M2 branch and performs no merge. Remaining development findings are non-blocking for trusted functional scope subject to reviewer acceptance, not an audit-clean certification; latest delivery/CI evidence is recorded on GitHub.

Dependency follow-up: the scoped Handlebars 4.7.10 override fixes the Newman tree's critical finding. Remaining audit: 18 development findings (11 high, 7 moderate); production audit zero. Install/lint, integration and Postman checks passed again. See [audit investigation](M2-dependency-audit.md); the tooling is not claimed audit-clean.

M2 implements PRD v1.1 FR01 and the authentication milestone in section 10 on `feature/milestone-02-authentication-rbac`, based on approved M1 merge `5fc1f38efcd71f91cd63842c788b62cad6b23449`. M1 manual checks were user-confirmed; M2 manual Postman/Swagger authentication verification is not claimed.

- Register customer/designer accounts with strict fields, normalized uniquely indexed email and bcrypt passwords.
- Log in with an HttpOnly JWT cookie; retrieve safe current-user fields; log out with persistent server-side session revocation.
- Reject expired/forged/unregistered/revoked sessions and deleted/suspended accounts. Load current role/status from MongoDB for every protected request.
- Reusable authentication/role middleware; roles tested using isolated test routes rather than adding business/admin APIs.
- Explicit protected admin setup command with confirmation and private environment credentials; safe no-op reruns, no silent promotions or password resets.
- Exact credentialed CORS, auth POST custom-header/Origin checks, JSON-only writes, strict cookies, targeted rate limits, safe envelopes/logs and bounded bodies.
- Extended OpenAPI, reusable Postman requests/environment, setup instructions, real-MongoDB tests and CI on the M2 branch. M3 prompt prepared only.

No profiles, portfolios, discovery, measurements, orders, requests, messages, notifications, payment, frontend or FR08 admin API implementation is included.

## Implementation decisions

The PRD specifies bcrypt and JWT in an HttpOnly cookie. Implementation choices not fixed by the PRD are documented here:

| Decision | Choice and reason |
| --- | --- |
| Password cost/limits | bcrypt cost 12; 8 Unicode code points minimum, 72 UTF-8 bytes maximum; reject NUL and overlong input rather than truncate |
| Session lifetime | One hour default, configurable 300-86400 seconds, no refresh endpoint |
| Revocation | Persist a hashed random session identifier with user and expiry; delete current session on logout; valid signatures alone never grant access |
| Cookie | Host-only `mygarb_session`, HttpOnly, SameSite=Strict, Path=/api, Secure in production |
| JWT | HS256 only, fixed issuer/audience, mandatory subject/session/expiry; no credentials or roles in payload |
| CSRF | All auth POSTs require `X-MYGARB-Request: 1` and JSON; reject unlisted/null Origin and cross-site Fetch Metadata; exact-origin preflight required for browsers |
| Registration session | Registration returns safe user data but requires a separate login |
| Admin setup | Explicit shell command, confirmation and private credentials; never a public endpoint or automatic startup action |
| Throttling | Shared login/register budget of 10 attempts per 15 minutes/IP, plus existing general API limits |

Password handling was checked against the [bcrypt maintainer documentation](https://github.com/kelektiv/node.bcrypt.js#security-issues-and-concerns); JWT validation uses the [jsonwebtoken verification API](https://github.com/auth0/node-jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback). Dependency audit found an existing body-parser advisory; the lockfile now resolves body-parser 2.4.0 within the existing dependency range. No force upgrade was used.

## Verification and delivery

See [M2-test-report.md](M2-test-report.md) for actual local runs, failures/fixes, skips, CI evidence and limitations. The PR description records the exact latest pushed SHA and its CI results after publication; historical M1 success is not reused as M2 evidence. M2 requires human review and separate merge authorization. Nothing is merged by this milestone task.

Use [README](../../README.md) for environment setup, routes, admin bootstrap, cookie/CSRF policy and manual steps. Import the collection/environment under `docs/postman/`; set private credentials locally. Keep `.env`, credentials and local instructions out of Git. The next prompt is [M3-codex-prompt.md](M3-codex-prompt.md).

## Known limitations

Rate limiting is process-local; trust proxy is disabled. Deployments require HTTPS, review of proxy/shared-limit storage and restricted exact origins. SameSite=Strict and the Fetch Metadata policy do not support cross-site frontend hosting. Duplicate registration returns 409, exposing that an email cannot be registered; full enumeration resistance is not claimed. Logout revokes only the current session; no logout-all, refresh, recovery or password-change feature is provided. TTL cleanup is asynchronous but explicit expiry checks deny expired sessions immediately. Status is checked per request, not a global transaction with concurrent administrative changes. Manual auth GUI testing and production deployment are not claimed. Windows cannot exercise the POSIX signal test; Linux CI covers it.
