# Copy-ready Milestone 2 prompt

Updated 26 October 2026. Preparation only: saving or reviewing this prompt does not authorize implementation. Execute it only after the user explicitly approves Milestone 2 and this scope.

## Starting point and workflow

Implement Milestone 2 only for MY GARB PHASONABLE: authentication and role-based access, using PRD v1.1 FR01 and sections 4, 9, 10 and 11. Read `docs/PRD.md`, local `AGENTS.md`, `README.md`, `docs/milestones/M1-summary.md` and `docs/milestones/M1-test-report.md` before changing code.

M1 was approved and PR #1 was merged into `develop` on 26 October 2026. The merge commit is `5fc1f38efcd71f91cd63842c788b62cad6b23449`; the approved PR head was `576064d5519169eabfe18bab97ad3afcbc2ec7a2`. Both PR and push CI passed for that head. The user confirmed manual health endpoint and Swagger checks. The recorded local automated result is 17 passed, 0 failed and 1 Windows-only signal skip. Earlier reports describe their historical state; do not treat the already-merged M1 PR as an outstanding approval or merge task. Reassess only newly discovered blockers.

Inspect status, diffs, branches and current remote state. Safely update `develop` and create `feature/milestone-02-authentication-rbac` from it. Preserve uncommitted work, including this prepared prompt, and ignored local configuration. Do not overwrite changes, reset data, rewrite history or force-push. Do not implement directly on `develop` or `main`. If the feature branch already exists, inspect and continue safely rather than recreating it.

Keep Node.js (24 LTS recommended; 26 accepted), Express, JavaScript CommonJS, Mongoose, local MongoDB Community Server, dotenv, OpenAPI, Postman and GitHub Actions. Do not add TypeScript, SQL, XAMPP or frontend code. Preserve root configuration, the lockfile, app/database/server lifecycle separation, bounded bodies, safe logs and centralized response/error envelopes. Module imports must not connect or listen. Add models, validators, controllers and services only where this feature needs them.

## M2 scope and acceptance

Implement:

- `POST /api/auth/register`: accept name, email, password and a public role of `customer` or `designer` only.
- `POST /api/auth/login`: verify credentials and establish the authenticated session.
- `POST /api/auth/logout`: revoke the session server-side and clear the matching cookie.
- `GET /api/auth/me`: return safe current-user fields for an authenticated, active account.

Use a validated User model with timestamps, normalized email enforced by a unique database index, password hash, role and account status. Require at least eight password characters and use bcrypt as specified in the PRD. Handle duplicate-email races safely, restrict accepted fields, and prevent mass assignment of privileged fields. Never expose passwords, hashes, tokens, cookie contents or connection details in responses, logs, examples or reports.

Use JWT authentication in an HttpOnly cookie as specified in the PRD. Validate signatures and expiry. Implement server-side session expiry/revocation: replaying a previously valid cookie after logout must fail; clearing the browser cookie alone is insufficient. Check current persisted account status on login and every protected request. Suspended accounts must be denied access even with a previously issued token. Use current server-side roles rather than client-supplied roles or stale token claims alone.

Provide reusable authentication and role-authorization middleware. Test customer, designer and admin permissions without adding unrelated production endpoints merely to demonstrate middleware. Distinguish unauthenticated and forbidden access using the established error envelope.

Provide a protected, explicit administrator seed/setup command. Public registration must never grant admin access. Do not create an admin on startup, publish a public bootstrap endpoint, ship default credentials, or promote an existing account silently. Keep setup credentials outside Git and logs, document safe reruns, and connect/close explicitly.

Add focused authentication abuse limits and safe credential-failure responses. Configure cookies for local HTTP and secure HTTPS deployment, with consistent clearing on logout. Review exact-origin credentialed CORS and CSRF protection for cookie-authenticated state-changing requests; document and test the chosen policy. Preserve public M1 health and documentation endpoints and their existing protections.

The PRD fixes bcrypt and JWT-in-HttpOnly-cookie authentication but does not specify numeric session lifetime, bcrypt cost, refresh-token flows or revocation storage design. Document bounded implementation choices and tradeoffs; do not describe them as existing PRD decisions. Do not introduce a refresh endpoint or account-recovery features without separate scope approval. Routine implementation choices within approved M2 scope do not require repeated approval.

Defer profile editing, portfolios, discovery, measurements, requests, orders, messaging, notifications, payments and FR08 administration APIs. M2 includes account-status enforcement needed by later administration; test suspension with isolated fixtures. No additional roles, frontend, deployment or subsequent milestone implementation is authorized.

## Local safety and verification

Preserve the existing `.env` and development databases. Keep `.env` and `AGENTS.md` local, ignored and untracked; never stage them or copy local instructions into remote reports or PR descriptions. Add only safe placeholders to `.env.example`; document new configuration without exposing secrets or replacing existing local configuration wholesale.

Before starting the API, identify any existing listener on its configured port. Reuse the correct MY GARB instance where appropriate; preserve unrelated servers. If a port change is needed, use an available local port and align Postman. Verify that OpenAPI identifies MY GARB before treating responses as evidence. Explain any administrator-only action needed rather than stopping unrelated services.

Retain fail-closed test URI validation before any connection, fixture write or cleanup. Integration tests and CI must use only validated local `mygarb_phasonable_test`. M1 tests do not write/delete data; M2 may create isolated authentication fixtures and clean up only its own test records. Never drop/reset development data or weaken URI validation. Use real MongoDB and do not silently skip database tests. Do not assume standalone MongoDB supports multi-document transactions.

Cover registration/login/current-session/logout success, input validation, the eight-character minimum and bcrypt input handling, normalized duplicate emails and concurrent registration, wrong credentials, public admin-registration rejection, privileged-field injection, missing/invalid/expired tokens, replay after logout, persistent revocation across restart, current account-status enforcement, role restrictions, protected admin setup and safe reruns, cookie/CORS/CSRF behavior, rate limits, and absence of secret leakage. Keep M1 health, documentation, security, database and lifecycle regression checks passing.

Run `npm ci`, `npm run lint` and `npm test` with real local MongoDB; use `npm.cmd` on Windows if needed. Preserve the lockfile except for intentional dependency changes. Record actual command results, environment, passed/failed/skipped counts and reasons separately from CI. The historical M1 Windows signal skip is not permission to skip authentication tests. Do not claim completion while required verification is blocked.

## Delivery and stopping point

Update OpenAPI, the importable Postman collection and safe local environment, README setup/manual verification steps, `.env.example`, `docs/milestones/M2-summary.md` and `docs/milestones/M2-test-report.md`. Update `AGENTS.md` only locally with verified progress. Prepare a copy-ready next milestone prompt aligned with the PRD's remaining backend roadmap; do not assume obsolete milestone numbering or implement that next scope.

After local checks pass, inspect the diff for scope and secrets, commit only intended files, push the M2 feature branch, and open/update its PR targeting `develop`. Verify CI for the exact latest pushed SHA, including install, lint and real-MongoDB tests. Recheck after later commits. If remote access is blocked, preserve work, report the exact safe error and provide PR/check links; do not claim unverified publication or CI success. Keep automated checks and user-confirmed manual checks distinct.

Return the milestone summary, actual test report, Postman examples/importable collection, setup instructions, branch and commit SHA, PR URL/status, limitations and next copy-ready prompt. Stop for human review and approval. A milestone approval alone is not merge authorization: merge only after a separate explicit request, rechecking the approved SHA, target and checks, using a permitted method without bypassing protections. Do not merge into `main`, auto-merge, or start the next milestone.
