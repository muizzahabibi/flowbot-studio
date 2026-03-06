# Conventions

## Language And Module Conventions
- TypeScript everywhere; `type: "module"` is used in all package manifests.
- Import paths use explicit `.js` extensions for ESM compatibility in source:
  - example in `packages/core/src/index.ts`.
- Strict typing is enabled through `tsconfig.base.json` with additional strict flags.

## Style Conventions
- Prettier config:
  - single quotes
  - semicolons
  - trailing commas
  - print width 100
- ESLint config extends:
  - `eslint:recommended`
  - `plugin:@typescript-eslint/recommended`
- `dist` and `coverage` are ignored in linting (`.eslintrc.cjs`).

## API And Domain Conventions
- Validation-first methods throw typed errors (`FlowValidationError`, `FlowAuthError`) from `packages/core/src/utils/errors.ts`.
- Domain methods prefer explicit guards for required values before network calls:
  - `packages/core/src/domain/project.ts`
  - `packages/core/src/domain/media.ts`
- Request payloads are built with narrow object literals and conditional property assignment to avoid undefined clutter.

## Error Handling Conventions
- Core throws `FlowError` family; server maps them to JSON error envelopes in `packages/server/src/middleware/error-handler.ts`.
- Server route handlers call `requireApiKey` early and return when `reply.sent` is true.
- CLI wraps main with top-level try/catch and sets `process.exitCode = 1` on failure (`packages/cli/src/index.ts`).

## Configuration Conventions
- `.env` loading is opportunistic via `dotenv-safe` and wrapped in `try/catch`.
- Core/CLI/Server all support runtime override from CLI flags or function config.
- Timeout and retry configs are centralized in `FlowClientConfig`.

## Logging And Redaction
- Logger abstraction in `packages/core/src/utils/logger.ts`.
- Sensitive headers and bearer/cookie-like strings are redacted by `packages/core/src/utils/redaction.ts`.
- Signed URL query params are sanitized for log output.

## Testing Conventions
- `vitest` with Node environment in each package.
- Tests are colocated in package `test/` directories and named `*.test.ts`.
- Unit tests assert behavior-level outcomes, especially:
  - retry behavior
  - arg parser behavior
  - adapter mapping
  - route health/model list responses

