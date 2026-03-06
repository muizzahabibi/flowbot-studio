# Testing

## Test Framework And Execution
- Framework: `vitest` in all packages.
- Root command: `pnpm -r test` from root `package.json`.
- Per-package configs:
  - `packages/core/vitest.config.ts`
  - `packages/cli/vitest.config.ts`
  - `packages/server/vitest.config.ts`
- All are configured with Node test environment and `test/**/*.test.ts` includes.

## Test Coverage By Package

### Core Package
- `packages/core/test/retry.test.ts`
  - validates retry success path and retry exhaustion behavior.
- `packages/core/test/openai-adapter.test.ts`
  - validates OpenAI adapter field mapping and required `project_id`.
- `packages/core/test/prompt.test.ts`
  - prompt validation and shape constraints.
- `packages/core/test/redaction.test.ts`
  - confirms secret/header redaction behavior.
- `packages/core/test/telemetry.test.ts`
  - confirms telemetry disabled/enabled behavior.

### CLI Package
- `packages/cli/test/args.test.ts`
  - option parsing semantics (flags, repeated options, comma-separated arrays).
- `packages/cli/test/output.test.ts`
  - output helper and MIME fallback behavior.

### Server Package
- `packages/server/test/server.test.ts`
  - Fastify inject smoke checks for `/health` and `/v1/models`.
- `packages/server/test/auth.test.ts`
  - API key middleware behavior.

## Current Test Style
- Mostly unit and lightweight integration tests.
- External network calls are mocked/stubbed where needed in unit tests.
- Server tests use in-memory `app.inject()` patterns.

## Notable Gaps
- No deep end-to-end tests across CLI -> core -> live upstream APIs.
- Limited assertions for server error envelopes and failure paths.
- No contract tests to detect upstream schema drift for Flow API/TRPC payloads.
- No explicit coverage reporting setup found (`coverage` output is lint-ignored, but not enforced).

## Suggested Next Additions
- Add route-level negative tests for validation/auth/error handler behavior.
- Add fixture-driven tests for parsing multiple real upstream response variants.
- Add smoke test script to run built CLI commands against a mocked HTTP layer.
- Add CI coverage threshold once contract tests are in place.

