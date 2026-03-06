# Integrations

## External Services
- Google Flow API base:
  - default `https://aisandbox-pa.googleapis.com` in `packages/core/src/client/flow-http-client.ts`.
- Google Labs TRPC base:
  - default `https://labs.google/fx/api/trpc` in `packages/core/src/client/flow-http-client.ts`.
- Google auth session endpoint:
  - `https://labs.google/fx/api/auth/session` in `packages/core/src/auth/flow-auth-session.ts`.
- Google reCAPTCHA Enterprise endpoints:
  - anchor and reload flows in `packages/cli/src/commands/generate.ts`.

## API Surfaces Exposed By This Repo
- OpenAI-style endpoints (`Fastify`):
  - `GET /v1/models`
  - `POST /v1/images/generations`
  - `POST /v1/images/image-edit`
  - defined in `packages/server/src/routes/openai.ts`.
- Native Flow endpoints (`Fastify`):
  - `POST /flow/projects/:projectId/generate`
  - `PATCH /flow/workflows/:workflowId`
  - defined in `packages/server/src/routes/flow.ts`.

## Upstream Endpoint Families Used
- Upload image:
  - `/v1/flow/uploadImage` in `packages/core/src/client/flow-endpoints.ts`.
- Batch image generation:
  - `/v1/projects/{projectId}/flowMedia:batchGenerateImages` in `packages/core/src/client/flow-endpoints.ts`.
- Workflow patch:
  - `/v1/flowWorkflows/{workflowId}` in `packages/core/src/client/flow-endpoints.ts`.
- TRPC calls:
  - `/project.createProject`, `/media.deleteMedia`, `/backbone.captionImage`, `/media.getMediaUrlRedirect`.

## Authentication And Security Integration
- Cookie and bearer token based auth:
  - modeled in `packages/core/src/auth/flow-auth-session.ts` and `packages/core/src/domain/account.ts`.
- Optional local API key protection for server routes:
  - `FLOW_LOCAL_API_KEY` with `Authorization: Bearer` check in `packages/server/src/middleware/auth.ts`.
- Header redaction for logs:
  - `authorization`, `cookie`, `set-cookie` handling in `packages/core/src/utils/redaction.ts`.

## Telemetry Integration
- Telemetry abstraction in `packages/core/src/telemetry/flow-telemetry.ts`.
- Telemetry is runtime configurable via `FLOW_TELEMETRY_MODE` and CLI options parsed in `packages/cli/src/utils/args.ts`.

## Files To Review For Integration Changes
- `packages/core/src/client/flow-http-client.ts`
- `packages/core/src/client/flow-endpoints.ts`
- `packages/core/src/auth/flow-auth-session.ts`
- `packages/server/src/routes/openai.ts`
- `packages/server/src/routes/flow.ts`

