# MY GARB PHASONABLE

Product Requirements Document

**Version:** 1.1

**Updated:** 16 October 2026

**Current delivery:** Backend first, three-week target

**Backend repository:** https://github.com/ikhaliddevs/my-garb-backend

This Markdown edition preserves the product requirements from PRD v1.0 and incorporates the later approved backend workflow. It does not certify current implementation or CI status; use the repository reports and actual checks for that evidence.

## 1 Product overview

MY GARB PHASONABLE is a fashion marketplace that connects customers with designers for custom outfits. The MVP will let customers discover designers, send structured outfit requests, share measurements, communicate, and track an order through completion.

This PRD defines the product baseline for the internship build. Backend development comes first, with a three-week target and weekly demonstrations through API behavior, test evidence, and a short report. Frontend implementation follows under a separately agreed schedule. Preserve existing work when continuing implementation.

## 2 Source and planning assumptions

Source: the supplied MYGARB Product Requirements Review document, which summarizes an August 2026 PRD. This new PRD uses the supplied review as the MVP reference; the underlying August PRD was not supplied.

Planning assumptions: one developer, 15 working days across three weeks, and a local development environment. Week and day numbers are relative to the agreed internship start date. The current target is a working backend MVP; frontend delivery, production launch, and external service integrations are outside this backend schedule. Treat the schedule as a target and report scope or timing risks at weekly checkpoints.

## 3 Goals and users

| User | Need and MVP outcome |
| --- | --- |
| Customer | Find a suitable designer, submit clear requirements, and see progress in one place. |
| Designer | Show portfolio work, respond to requests, and manage confirmed orders. |
| Administrator | Inspect users and requests/orders and suspend access when necessary. |

Success means that two independent customer–designer journeys can be completed using real registered test accounts and persisted MongoDB data, with access restrictions verified. These are demonstration targets, not market adoption claims.

## 4 Technology stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | React; JavaScript and JSX | Reusable components, forms, dashboards, and UI state. |
| Build tooling | Vite | Local frontend development and production builds. |
| Styling | Bootstrap CSS; custom CSS | Responsive layout, shared controls, and MY GARB styling. |
| Backend | Node.js; Express; JavaScript CommonJS | REST API, validation, authentication, and business rules. |
| Database | MongoDB | Persistent users, portfolios, requests, orders, and messages. |
| Local database | MongoDB Community Server | Run the development database locally. |
| Database GUI | MongoDB Compass | Inspect local collections, records, and indexes. |
| API testing | Postman | Exercise endpoints and retain reusable test requests. |

Additional backend tooling: dotenv for configuration, Swagger/OpenAPI for API documentation, GitHub Actions for CI, and Git/GitHub for version control. Use CommonJS require/module.exports in the backend. Do not introduce TypeScript, SQL databases, or XAMPP.

Implementation choices: React Router for navigation; Mongoose for MongoDB models; bcrypt for password hashing; JWT authentication in an HttpOnly cookie. Use JavaScript throughout. Bootstrap JavaScript components are optional; Bootstrap CSS and custom CSS are required.

### Local setup and project structure

The backend uses the dedicated my-garb-backend repository, with package.json and configuration at its root. Separate application creation, database lifecycle, and server startup; importing a module must not automatically connect or listen. Add controllers, services, models, and validators when a real feature needs them. Run Express and MongoDB Community Server locally and inspect records using Compass. Store configuration in environment variables and provide a safe .env.example. Frontend location and repository setup will be agreed when frontend work starts.

Suggested local configuration: frontend on port 5173, API on port 5000, and MongoDB at mongodb://127.0.0.1:27017/mygarb_phasonable. Keep these values configurable. Use a Vite development proxy for /api requests and document installation and startup in the README.

## 5 Scope boundaries

Included: registration and login, role-based access, profiles, designer portfolios, discovery and basic search, outfit requests, measurements, accept/decline and customer confirmation, orders, persisted text messages, in-app notifications, and minimal administration.

Deferred: payment processing and escrow, delivery integration, reviews and ratings, formal designer verification, advanced filters, full admin analytics, email/SMS/push notifications, real-time chat, AI recommendations, virtual try-on, subscriptions, and loyalty features. No accountant role is required by this MVP source.

## 6 Functional requirements

### FR01 Accounts and authorization

Customers and designers can register with name, email, password, and role, then log in and log out. Enforce unique normalized emails, an eight-character password minimum, hashed passwords, and server-side role checks. Provide GET /api/auth/me for the current session. Create the administrator through a protected seed/setup process; public registration cannot grant admin access.

### FR02 Profiles and portfolios

Customers can edit their own name and contact details. Designers can edit business name, biography, location, specialties, and availability, and add/remove portfolio entries with title, category, and image URL. For this local MVP, use validated image URLs and bundled sample assets; binary uploads are deferred. A designer appears in discovery only after completing business name, location, specialty, and at least one portfolio entry.

### FR03 Discovery

Visitors can browse eligible designers and inspect profiles and portfolios. Search by designer/business name or specialty and filter by location and availability. Show useful empty, loading, and error states. Require login before sending a request.

### FR04 Outfit requests

A customer selects a designer and submits outfit type, description, quantity, desired completion date, budget amount in NGN, and optional reference image URLs. Require a positive quantity and budget, a future date, and non-empty outfit details. The designer can inspect only requests addressed to them and accept or decline with a response. Acceptance includes a proposed price and completion date.

### FR05 Measurements

Customers maintain named numeric measurements and select centimetres or inches. Values must be positive and labels cannot be empty. Only the customer and the selected designer can access the request’s shared measurements. Copy measurements into the request when submitted and into the order when confirmed, preserving the agreed snapshot. Later profile edits must not silently change an order; corrections are agreed in messages and explicitly recorded by the designer before production.

### FR06 Orders and tracking

After designer acceptance, the customer reviews the proposed price/date and confirms to create one order. Declining the proposal closes the request. The customer sees a chronological status history; the assigned designer updates permitted production states. Store the actor and timestamp for each transition. Payment is neither collected nor marked as paid by this process.

### FR07 Communication and notifications

Each submitted request has a text conversation visible only to its customer and designer; link it to the order on confirmation. Persist messages with sender and time. Refresh or poll for updates; live sockets are deferred. Create in-app notifications for new requests, acceptance/decline, confirmation, new messages, and order status changes. Users can mark only their own notifications as read.

### FR08 Minimal administration

Provide an admin-only user list with suspend/reactivate actions and a read-only request/order list with identifiers, participants, and statuses. Suspended users cannot log in or make protected requests. Do not expose measurement values or private chat content in admin list views. No full dispute system is included.

## 7 Request and order lifecycle

| Record | Transition | Actor and rule |
| --- | --- | --- |
| Request | Submitted → Accepted or Declined | Assigned designer; acceptance requires price and date. |
| Request | Submitted → Cancelled | Owning customer before a designer decision. |
| Request | Accepted → Confirmed or Cancelled | Customer confirms the proposal or rejects it. |
| Order | Confirmed → In progress → Ready | Assigned designer; transitions occur in sequence. |
| Order | Ready → Completed | Owning customer acknowledges receipt/completion. |

Create the order only when the customer confirms an accepted request. Enforce a unique requestId on orders and an atomic status check to prevent duplicate orders from repeated clicks. Confirmed requests cannot create another order. Declined and cancelled requests are terminal; customers submit a new request to try again. Post-confirmation cancellation and disputes are handled outside the MVP and must be disclosed in the demonstration.

## 8 Data requirements

| Collection | Essential data |
| --- | --- |
| Users | Name, normalized email, password hash, role, account status, profile, timestamps. |
| Designer profiles | User reference, business details, specialties, location, availability, portfolio entries. |
| Measurements | Customer reference, unit, named values, updated time. |
| Requests | Customer/designer references, outfit details, budget, proposed price/date, measurement snapshot, status. |
| Orders | Unique request reference, participants, agreed price/date, measurement snapshot, status history. |
| Messages | Request reference, optional order reference, sender, text, created time. |
| Notifications | Recipient, event type, linked record, message, read time, created time. |

Use timestamps and indexes for unique emails, order request references, participant lookups, and message/notification ordering. Return only permitted fields; never expose password hashes. Use test data for presentations and exclude secrets and real customer measurements from commits.

## 9 API outline

All routes use the /api prefix. Auth: POST /auth/register, /auth/login, /auth/logout; GET /auth/me. Profiles: GET/PATCH /profile; GET/PUT /measurements. Discovery: GET /designers and /designers/:id; designer portfolio: POST/DELETE /portfolio entries. Requests: POST/GET /requests; GET /requests/:id; PATCH decision, cancellation, and confirmation actions. Orders: GET /orders and /orders/:id; PATCH /orders/:id/status. Conversations: GET/POST /requests/:id/messages. Notifications: GET /notifications; PATCH /notifications/:id/read. Administration: GET /admin/users and /admin/orders; PATCH /admin/users/:id/status.

## 10 Three week backend delivery plan

This section supersedes the original combined frontend/backend schedule. Only the explicitly requested milestone may be implemented. A roadmap or prepared next prompt is not approval to begin work.

### Milestone 1 Backend foundation

Implement Node.js/Express initialization, CommonJS architecture, Mongoose connection, validated environment configuration, security middleware, safe logs, centralized errors, liveness/readiness checks, Swagger/OpenAPI, automated infrastructure tests, GitHub Actions, Postman exports, and setup documentation.

Required endpoints:

- `GET /api/health/live` returns 200 while the process is running.
- `GET /api/health/ready` returns 200 when MongoDB is connected and 503 when unavailable.
- Swagger UI is available at `/api/docs`.
- OpenAPI JSON is available at `/api/docs.json`.

Do not implement authentication, profiles, discovery, requests, orders, payments, or messages in Milestone 1. Completion requires executed local checks, an accurate report, and a feature PR targeting develop. Report CI separately and wait for review.

### Milestone 2 Authentication and role based access

After explicit approval, implement FR01 using customer, designer, and admin roles. Include register/login/logout/current-session APIs, hashed passwords, unique normalized emails, protected admin setup, server-side role checks, and session expiry/revocation. Clearing the browser cookie alone must not count as server-side logout. Require current active-account checks on protected operations.

Preserve and retest Milestone 1. Read this PRD before selecting roles or business rules. Detailed scope must be confirmed in the approved Milestone 2 prompt.

### Week 1 Foundation and account access

Target foundation and authentication milestones, their tests, documentation, Postman evidence, and review. Present health/readiness, Swagger, CI status, MongoDB connectivity, and implemented account flows. Clearly distinguish completed features from pending work.

### Week 2 Profiles discovery requests and orders

Target FR02–FR06: profiles/portfolios, discovery, measurements and snapshots, structured requests, proposals, customer confirmation, one-order-per-request creation, and sequential order tracking. Split these into independently approved feature milestones based on the updated milestone plan; do not reuse obsolete milestone numbering without reconciliation.

Demonstrate a request-to-order journey, decline/cancel behavior, snapshot privacy, ownership restrictions, duplicate confirmation handling, and stored records. Test concurrent retries and partial-failure recovery with the actual local MongoDB setup; do not assume standalone MongoDB supports multi-document transactions.

### Week 3 Communication administration and handover

Target FR07–FR08: persisted participant-only messages, in-app notifications across the existing flows, read states, minimal administration, suspension enforcement, regression, and two isolated complete backend journeys.

Finish setup instructions, safe seeds, OpenAPI documentation, Postman exports, milestone reports, and the final presentation. If approval, integration, or scope exceeds capacity, report the impact and agree a revised schedule rather than silently skipping acceptance criteria.

### Required milestone workflow

- Develop on a dedicated feature branch from updated develop after prerequisites are merged.
- Use `feature/milestone-01-backend-foundation` for M1 and the same naming pattern later.
- Keep main stable; use develop for integration.
- Execute relevant automated tests and regression, then provide actual results.
- Provide a milestone summary, separate test report, Postman examples/importable collection, setup notes, outstanding issues, and a copy-ready next milestone prompt.
- Update AGENTS.md locally. Keep it ignored and untracked; do not push it or copy its full contents into remote reports or PR descriptions.
- Commit reviewed milestone files, push the feature branch, and open/update a PR targeting develop.
- Required quality checks must pass and review approval must be received before merging. Do not auto-merge or bypass checks.
- Stop after the requested milestone. Wait for explicit approval before merging or starting the next milestone.

If GitHub permissions or authentication block a remote action, preserve local work and report the blocker. Do not claim a push or PR succeeded without evidence. History rewrites and force-pushes require separate explicit authorization.

## 11 Quality and acceptance requirements

| Area | Acceptance check |
| --- | --- |
| End to end | Two customer accounts and two designers complete separate discovery-to-completion journeys; each sees only their records. |
| Authentication | Wrong credentials fail; duplicate email fails; logout ends access; expired sessions require login; public admin registration fails. |
| Authorization | Unrelated users cannot read/update requests, orders, measurements, conversations, or notifications, including by direct API calls. |
| Business rules | Invalid dates/values fail; duplicate confirmation creates no duplicate order; invalid status jumps fail. |
| Persistence | Profile, request, order, message, and notification data remain after page refresh and backend restart. |
| Responsive UI in later frontend phase | Core forms and dashboards work at 360 px, 768 px, and 1440 px without horizontal page overflow. |
| Accessibility in later frontend phase | Visible form labels, keyboard-operable controls, visible focus, readable contrast, and clear validation messages. |
| Performance | With 50 seeded designers, ten local discovery requests return within one second each after warm-up; record environment and results. |
| Build and errors | Backend checks pass; API errors are consistent and omit stacks/secrets. Vite build verification applies during the later frontend phase. |

Test safety: use only a validated, isolated local mygarb_phasonable_test database for integration tests. Reject unsafe test URIs before connecting or cleaning up. Never reset/drop development data. Execute configured clean-install, lint, and test checks and report blocked/skipped checks accurately. CI must provision its own test MongoDB.

Security baseline: validate input on the server, restrict accepted fields, limit login attempts, use protected cookies and environment-based secrets, and check active-account status on protected requests. If deployed later, require HTTPS and review cookie/CORS settings before using real accounts.

## 12 Weekly evidence and final handover

Maintain a checklist linking requirement IDs to screenshots, Postman checks, and the relevant commit. Each weekly update should state the milestone, completed features, what was demonstrated, failures or blockers, and next steps. Do not report a mocked interaction as backend completion.

Final backend deliverables: source repository, milestone PRs and review status, OpenAPI documentation, and a clear README; setup and startup commands; .env.example; safe seed data including administrator setup; reusable Postman collection and local environment without credentials; this PRD; three weekly progress updates; and a final demo script with known limitations.

## 13 Risks and scope decisions

The main schedule risk is integrating several roles and workflows within 15 working days while allowing time for review. Defer frontend work during this backend schedule and use use text messaging with refresh/polling, image URLs, basic search, and minimal administration. Preserve time for permission checks and full journey testing.

Proposed MVP decisions made to resolve gaps in the supplied review: customer confirmation creates the order, prices use NGN, measurements use explicit units and snapshots, completion is acknowledged by the customer, and payments remain outside the app. Review these choices with the internship supervisor at the first weekly checkpoint. Geography and target outfit segment remain open product decisions; the internship demo may use labelled sample locations and styles.

## 14 Document changes

Version 1.1 converts the PRD to Markdown, records the dedicated backend repository and CommonJS convention, adds dotenv/OpenAPI/CI requirements, separates foundation M1 from authentication M2, updates feature PRs to target develop, and keeps AGENTS.md local. Full product requirements remain in scope for the overall platform; frontend acceptance criteria apply to its later delivery phase. Older prompts or milestone documents that conflict with these approved changes must be reconciled before implementation.
