# Architecture

## High-Level Design
- The system is organized as a layered monorepo:
  - `@google-flow-suite/core`: domain SDK and HTTP integration layer.
  - `@google-flow-suite/cli`: command handlers that orchestrate SDK calls.
  - `@google-flow-suite/server`: Fastify API facade exposing OpenAI-compatible and native routes.

## Layering
- Domain layer (`core/domain`) holds intent-level actions:
  - `Project`, `Media`, `Prompt`, `Account`.
- Transport layer (`core/client`) handles HTTP details:
  - `FlowHttpClient` sets headers, retries, timeout behavior.
  - `FlowEndpoints` maps typed methods to upstream endpoints.
- Auth layer (`core/auth`) refreshes/serves access tokens from cookie+session endpoint.
- Adapter layer (`core/adapters`) translates between OpenAI request/response and Flow schema.

## Main Data Flow
1. Entry comes from CLI command in `packages/cli/src/index.ts` or HTTP route in `packages/server/src/main.ts`.
2. Entrypoint calls `createFlowClient()` from `packages/core/src/index.ts`.
3. Client composes `Account -> FlowAuthSession -> FlowHttpClient -> FlowEndpoints`.
4. Domain method (for example `Project.generateImageWithReferences`) builds typed payload.
5. `FlowEndpoints` executes upstream call and returns structured response.
6. Adapter/route maps response into CLI JSON output or API response.

## Request Lifecycle Details
- Retry policy uses exponential backoff + jitter in `packages/core/src/utils/retry.ts`.
- Retry decision is based on status in `isRetryableStatus` (`429` and `5xx`).
- Timeout classing (`default`, `upload`, `generate`, `fetch`) is resolved in `FlowHttpClient`.
- Error taxonomy comes from `packages/core/src/utils/errors.ts` and is mapped by server error handler.

## Server Architecture
- Fastify app assembly in `packages/server/src/main.ts`:
  - sets request-id header
  - registers route modules
  - installs centralized error handler
- OpenAI-compatible routes and native Flow routes are separated into:
  - `packages/server/src/routes/openai.ts`
  - `packages/server/src/routes/flow.ts`

## CLI Architecture
- Single binary entrypoint in `packages/cli/src/index.ts`.
- Subcommand dispatch via switch statement to `packages/cli/src/commands/*`.
- Argument parsing and config mapping in `packages/cli/src/utils/args.ts`.

## Boundaries And Coupling
- `cli` and `server` both depend on `core` as shared business/integration layer.
- `core` is independent from Fastify/CLI concerns, which keeps transport/domain logic reusable.
- Some transport details (browser-like headers and validation constants) are tightly coupled to current upstream behavior and may drift.

