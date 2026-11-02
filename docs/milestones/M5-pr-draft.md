# M5 PR draft (text only; no PR created)

Base: `develop`  
Head: `feature/milestone-05-messages-notifications`

Title:

```text
Milestone 5: Conversations, measurement agreements and notifications
```

Description:

```markdown
Implements PRD FR05/FR07 after merged M4: persisted participant-only request/order conversations, explicit versioned measurement corrections before production, and owner-only in-app notifications.

The assigned designer records a complete replacement measurement proposal and explanation; the customer explicitly accepts the exact version. Original snapshots and accepted audit records remain unchanged, stale consent fails, and pending proposals block production. Terminal conversations remain readable but reject new messages. Business writes atomically persist journaled notification events; bounded owner polling recovers partial failures/restarts and deduplicates delivery without resetting read state or assuming MongoDB transactions.

Includes OpenAPI 0.5.0, an M5 folder in the existing Postman collection, blank optional environment/setup examples, milestone reports, and a prepared M6 prompt (no M6 implementation).

Validation: local clean install/lint passed; 66 integration tests total, 65 passed/0 failed/1 Windows POSIX signal skip. Implementation CI 41392856922 at 4a6ca348d1fda6bc004fd48900401527a43e66b6 passed clean install/lint and 66 tests with no failures/skips. Newman passed 158 requests/387 assertions across M1-M5, including M5 52/117. See the current branch checks for the final documentation commit and docs/milestones/M5-test-report.md for exact evidence.

Manual Postman repetition is deferred by user choice. Existing accounts, .env, running APIs and external Postman edits were preserved. No dependency/lockfile changes; audit retains 23 development findings (11 high/12 moderate/0 critical), production zero. Notification delivery requires polling; bounded histories and retry semantics are documented. No frontend, payment, external messaging, administration or post-confirmation cancellation expansion.
```
