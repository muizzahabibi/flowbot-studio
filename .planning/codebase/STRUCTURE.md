# Structure

## Top-Level Layout
- `packages/` contains all source packages.
- `.planning/codebase/` stores generated mapping docs.
- `output/` stores generated output artifacts (images/downloads).
- Root config and docs:
  - `package.json`
  - `pnpm-workspace.yaml`
  - `tsconfig.base.json`
  - `.eslintrc.cjs`
  - `.prettierrc.json`
  - `README.md`

## Package Layout

### `packages/core`
- `src/index.ts` public SDK factory and exports.
- `src/auth/flow-auth-session.ts` auth session refresh and token lifecycle.
- `src/client/flow-http-client.ts` HTTP abstraction (headers, retry, timeout, JSON handling).
- `src/client/flow-endpoints.ts` endpoint-specific request methods.
- `src/domain/*.ts` intent-level models (`account`, `project`, `media`, `prompt`).
- `src/adapters/openai-image-adapter.ts` OpenAI compatibility mapping.
- `src/telemetry/flow-telemetry.ts` telemetry dispatch abstraction.
- `src/types/flow.ts` shared type surface.
- `src/utils/*.ts` errors, logger, redaction, retry, ids, object helpers.
- `test/*.test.ts` unit tests for retry/redaction/prompt/telemetry/adapter.

### `packages/cli`
- `src/index.ts` command router.
- `src/commands/*.ts` command implementations (`generate`, `upload`, `fetch`, etc).
- `src/utils/args.ts` parser and config builder.
- `src/utils/output.ts` output/error helpers + mime guessing.
- `src/types/dotenv-safe.d.ts` local type shim.
- `test/*.test.ts` args and output tests.

### `packages/server`
- `src/main.ts` Fastify app factory + bootstrap.
- `src/routes/openai.ts` OpenAI-style API routes.
- `src/routes/flow.ts` native flow routes.
- `src/middleware/auth.ts` local API key gate.
- `src/middleware/error-handler.ts` centralized exception mapping.
- `src/types.ts` route-local shared types.
- `test/*.test.ts` route smoke tests with Fastify inject.

## Build Output Layout
- Each package emits ESM and declarations into `dist/`:
  - `packages/core/dist`
  - `packages/cli/dist`
  - `packages/server/dist`

## Naming And Organization Patterns
- File names are kebab-case for most modules (`flow-http-client.ts`, `error-handler.ts`).
- Domain classes are PascalCase exports in lower/kebab files.
- Tests mirror source concerns and end with `.test.ts`.

