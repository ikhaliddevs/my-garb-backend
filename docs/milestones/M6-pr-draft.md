# User-managed M6 PR draft

Base: `develop`

Head: `feature/milestone-06-administration-handover`

Title: **M6: Add minimal administration and backend handover**

Description:

Adds admin-only bounded user/request/order metadata lists and customer/designer suspension/reactivation. Lists omit contacts, private messages and measurements. Suspension atomically invalidates prior sessions; reactivation requires fresh login. Admin accounts are protected from status changes, including self and concurrent peer attempts. No role changes, deletion or impersonation.

Includes OpenAPI 0.6.0, an M6 Postman folder and blank optional environment, regression/security/race and complete-journey tests, milestone reports and final backend demonstration/setup guidance. Preserves existing APIs/accounts/settings. Existing processes need a user-scheduled restart before relying on M6 revocation across every instance.

Local validation: clean install/lint passed; 75 tests total, 74 passed, zero failed, one Windows signal skip. Newman 178 requests/430 assertions, zero failures. Implementation CI 41398832754 at 5207abf passed clean install/lint, 75 tests with zero failures/skips and the same Newman totals. See `docs/milestones/M6-test-report.md` and the feature branch checks for final documentation-head CI evidence. Manual Postman repetition is deferred. Production audit zero; 23 development findings remain documented. No frontend or deployment included.

This file is copyable text only. No PR has been created, modified or merged by this work.
