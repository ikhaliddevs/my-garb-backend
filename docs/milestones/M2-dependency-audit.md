# M2 Postman dependency audit — 30 October 2026

The critical finding is fixed with one scoped transitive patch. Full audit now reports **18 affected packages: 11 high, 7 moderate, 0 critical**; production-only audit reports **0**. These counts include parent packages flagged through their dependencies, not 18 independent exploits. Remaining findings are not resolved or waived.

## Critical dependency and minimal fix

Installed path before remediation: `newman@6.2.3` (devDependency) → `postman-runtime@7.39.1` → `handlebars@4.7.8`. npm marks Handlebars development-only. Source inspection finds its use in Postman Runtime's visualizer; no application source imports Newman, Postman Runtime or Handlebars. Importing `src/server.js` and inspecting the loaded modules confirmed none of these packages loaded. The Newman runner deliberately loads the tooling, but ordinary API startup does not.

The critical package entry includes multiple injection advisories, notably [AST type confusion, GHSA-2w6w-674q-4c4q](https://github.com/handlebars-lang/handlebars.js/security/advisories/GHSA-2w6w-674q-4c4q), its [4.7.9 bypass, GHSA-8r5x-fm3f-whwj](https://github.com/handlebars-lang/handlebars.js/security/advisories/GHSA-8r5x-fm3f-whwj), and [own-property check bypass, GHSA-p8wg-vrv2-v86f](https://github.com/handlebars-lang/handlebars.js/security/advisories/GHSA-p8wg-vrv2-v86f). Maintainer advisories specify **4.7.10** as patched for the latter two; 4.7.9 is insufficient. These flaws can execute JavaScript with attacker-controlled compilation inputs/options. Postman Runtime's inspected visualizer rejects non-string templates, reducing the AST-object exposure through that wrapper; the own-property flaw has different prerequisites. Our collection does not invoke the visualizer. These observations do not make arbitrary external collections safe.

Registry metadata still lists Newman 6.2.3 as latest. It pins Runtime 7.39.1, which pins Handlebars 4.7.8 exactly. Normal compatible audit resolution cannot advance that exact pin. Latest Runtime 7.56.3 still pins vulnerable Handlebars 4.7.9 and changes sandbox, collection and other dependencies, so replacing Runtime is broader and does not fix all critical advisories. npm proposes a breaking Newman downgrade to 4.6.1; it was not applied.

Added only this root override, with the existing lockfile regenerated:

```json
"overrides": {
  "newman": {
    "postman-runtime": {
      "handlebars": "4.7.10"
    }
  }
}
```

`npm install` reported one changed package. This is a same-minor patch, deliberately overriding the upstream exact pin; compatibility was checked below. No production dependency range, API code, Newman version, or Postman Runtime version changed. No force option was used. Remove/reassess the override when Newman adopts a fixed upstream dependency tree.

## Remaining findings and available options

All affected instances below belong to Newman's development dependency tree. Registry versions listed are available candidates outside the current advisory ranges, not compatibility-certified replacements. Same-major candidates still override upstream pins and require separate behavior checks; they were left unchanged to keep this remediation to the critical package. No claim is made that all remaining fixes require major upgrades.

| Affected package / path below Newman | Practical issue | Available candidate / scope |
| --- | --- | --- |
| `postman-collection → @faker-js/faker@5.5.3` | Code execution through unsafe `helpers.fake` input | 10.6.0 available; multiple-major migration, cannot safely substitute blindly |
| `csv-parse@4.16.3` | Prototype replacement via CSV columns | Fixed range starts 7.0.2; 7.0.3 available, major migration |
| `postman-runtime → postman-sandbox → uvm → flatted@3.2.6` | Recursive parsing DoS / prototype pollution | Same-major 3.4.4 available; separate override/testing candidate (ESLint already has safe 3.4.4) |
| `postman-runtime → jose@4.14.4` | Resource exhaustion decoding compressed JWE | Same-major 4.15.9 available; advisory ends at 4.15.4 |
| `lodash@4.17.21` via Newman and multiple Postman packages | Template code injection / prototype pollution | Same-major 4.18.1 available; multiple pinned consumers need validation |
| `postman-runtime → node-forge@1.3.1` | ASN.1 DoS and certificate/signature validation weaknesses | Same-major 1.4.2 available; 1.4.0 remains affected |
| `postman-request → qs@6.14.3`, `postman-runtime → qs@6.5.5` | Parsing/stringification DoS | Same-major 6.17.1 available; production copy 6.16.1 is outside current affected ranges |
| `postman-runtime → httpntlm → underscore@1.12.1` | Unbounded recursive operations / DoS | Same-major 1.13.8 available |
| `uuid@8.3.2` and `serialised-error → uuid@3.4.0` | Missing bounds checks in v3/v5/v6 with supplied buffers | Fixed range starts 11.1.1; requires major migration and consumer API review |

The other nine audit entries are affected parents: Newman, postman-collection, postman-collection-transformer, postman-request, postman-runtime, postman-sandbox, serialised-error, httpntlm and uvm.

Practical exposure is in developer/CI runner processes handling collection scripts, templates, data, authentication helpers or responses. The current runner executes the repository collection against a verified local API, generates credentials in memory and does not use external CSV input, visualizer templates, NTLM or JWE authentication. These constraints reduce exposure; passing our collection does not prove those library features safe. Avoid running untrusted collections/data with privileged environment access. The API uses `jsonwebtoken`, not the affected development `jose`; no running-API vulnerability is established by these findings. Production-only installation omits the dev tree.

## M2 approval assessment

Recommendation: the remaining development findings **do not block M2 functional approval for the current backend and trusted local/CI test scope**, subject to reviewer acceptance of the documented residual risk. This is a technical recommendation, not human approval or a security waiver. The critical dependency is patched, production audit has zero findings, API imports exclude the affected tooling, and authentication plus Postman regression checks passed. M2 still requires human review; browser GUI verification remains unperformed and must not be represented as complete.

The 18 findings remain open maintenance work. They would block describing the repository as audit-clean or using this runner as a service for arbitrary uploaded collections, external datasets or untrusted authentication inputs. Dev-only status alone is not a guarantee: a compromised runner can affect a developer account or CI job. Keep the runner limited to the reviewed repository collection, local test database and fictional credentials. CI uses a hosted ephemeral runner, read-only repository token permissions and no application secrets; the workflow uses `pull_request`, not `pull_request_target`. The Postman step runs after integration tests against the same isolated test database with separate fixture ownership. Review future collection/script changes as executable code.

Prioritize separately validated same-major fixes for flatted, lodash, jose, node-forge, qs and underscore; plan upstream-supported migrations for Faker, CSV parsing and UUID rather than forcing replacements. Reassess if production dependency paths, runner inputs, CI permissions or advisory severities change. No next-milestone implementation is authorized by this recommendation.

## Executed verification

Windows, Node v26.3.1, real local MongoDB; test data restricted to `mygarb_phasonable_test`.

| Check | Actual result |
| --- | --- |
| Pre-fix full audit | Exit 1; 19 total: 11 high, 7 moderate, 1 critical |
| Scoped `npm install --fetch-retries=0 --fetch-timeout=15000` | Exit 0; one package changed |
| `npm ci --fetch-retries=0 --fetch-timeout=15000` | Exit 0; 327 packages installed in approximately one minute; existing install-script/deprecation warnings remain |
| `npm ls handlebars --all` | 4.7.10, overridden below Newman → Postman Runtime |
| `npm audit --omit=dev --fetch-retries=0 --fetch-timeout=15000` | Exit 0; zero vulnerabilities |
| Full `npm audit --fetch-retries=0 --fetch-timeout=15000` | Exit 1; 18 total: 11 high, 7 moderate, zero critical |
| `npm run lint` | PASS; no lint errors |
| `npm test` | PASS; 33 total, 32 passed, 0 failed, 1 Windows-only POSIX signal skip; 32.141s |
| `npm run test:postman` | PASS; 29 requests, 94 assertions, 0 request/assertion/runner failures; removed only two owned users, no remaining sessions |
| Targeted visualizer smoke check | PASS; patched runtime renders a fictional string template and rejects object input |
| API import-path check | PASS; importing server loads none of Newman/Runtime/Handlebars |

The checks above are local pre-publication evidence. Delivery adds the Postman command to Backend CI; exact pushed SHA and CI run links are recorded on GitHub after execution. PR #2 was verified already merged on 27 October 2026 (merge `e35459d82dcb6539fcfe1c1c3c0b68f9bfef2d3a`); that historical merge does not include this follow-up. Browser GUI verification remains unperformed. No merge or M3 work is included here. Private environment files and temporary scripts are excluded; no credentials, cookies or raw run reports are included in delivery.
