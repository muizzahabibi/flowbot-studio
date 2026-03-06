# Concerns

## High-Risk Drift Points
- Hard-coded browser-like header fingerprints in `packages/core/src/client/flow-http-client.ts`:
  - `x-browser-validation`
  - `x-client-data`
  - fixed user-agent/browser hints
- These values can drift when upstream anti-abuse rules change, causing sudden request failures.

## Upstream Contract Fragility
- Response parsing in `packages/core/src/client/flow-endpoints.ts` and `packages/core/src/adapters/openai-image-adapter.ts` handles several shapes, but still depends on undocumented fields.
- `createWorkflow` parses nested TRPC response manually and throws if field path changes.
- `getMediaUrlRedirect` relies on several fallback keys that may change or move.

## Placeholder/Incomplete Features
- `media.refine()` currently returns placeholder data in `packages/core/src/domain/media.ts`.
- `media.animate()` is explicitly disabled/feature-gated and throws validation error.
- `/flow/jobs/:jobId/status` returns static `unknown` in `packages/server/src/main.ts`.
- README acknowledges these are not fully implemented.

## Security And Secret Handling Risks
- `.env` exists in repo root and can contain live credentials if mishandled.
- Project includes request capture artifacts (`labs.google.har`, flow text dumps) that may include sensitive material.
- Mapping and docs processes should always avoid copying real tokens into markdown or commits.

## Test Coverage Risks
- Current tests validate core units but do not provide strong end-to-end coverage against live integration behavior.
- No automated detection of upstream schema/behavior changes besides runtime failures.
- Missing dedicated regression tests for server error mapping and all route permutations.

## Operational Risks
- Dependence on reCAPTCHA flow in `packages/cli/src/commands/generate.ts` is brittle; token generation may break without code changes.
- Auth refresh is cookie-dependent; expired cookie path can interrupt all operations.
- Default retry/timeout policy may be insufficient or too aggressive under API throttling spikes.

## Maintainability Concerns
- `dist/` artifacts are committed and can drift from `src/` if manual build hygiene slips.
- A few type ignores and local type shims are used for `dotenv-safe`, indicating typing debt.
- Mixed language in docs/comments (English and Indonesian) may reduce onboarding consistency across contributors.

## Mitigation Priorities
1. Add contract tests with recorded fixtures for key upstream response variants.
2. Add integration smoke tests (mocked and optionally live-gated) for critical routes.
3. Isolate and version header/reCAPTCHA strategy behind configurable providers.
4. Define a policy for large capture artifacts and sensitive-data scanning before commit.

