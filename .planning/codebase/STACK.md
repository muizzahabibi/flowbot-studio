# Stack

## Summary
- Monorepo JavaScript/TypeScript project managed with `pnpm` workspaces.
- Runtime target is modern Node.js (`ES2022`, `NodeNext` module system).
- Code is split into 3 packages: SDK (`core`), CLI (`cli`), HTTP server (`server`).

## Languages And Runtime
- TypeScript is primary language across `packages/core/src`, `packages/cli/src`, and `packages/server/src`.
- Output artifacts are ESM in `dist` directories (`packages/*/dist/*.js`).
- Node.js 22+ is required (documented in `README.md`).

## Package And Build Tooling
- Workspace config: `pnpm-workspace.yaml`.
- Root scripts in `package.json`: `build`, `lint`, `typecheck`, `test` run recursively with `pnpm -r`.
- Package build uses `tsup`:
  - `packages/core/package.json`
  - `packages/cli/package.json`
  - `packages/server/package.json`

## Compiler, Lint, Format
- Base TS config: `tsconfig.base.json` with strict settings:
  - `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`.
- Linting with ESLint + TypeScript plugin in `.eslintrc.cjs`.
- Formatting with Prettier in `.prettierrc.json`.

## Key Dependencies
- Runtime dependencies:
  - `fastify` in `packages/server/package.json`.
  - `dotenv-safe` in all runtime packages.
  - local workspace dependency `@google-flow-suite/core` used by CLI and server.
- Dev dependencies:
  - `typescript`, `tsup`, `vitest`, `eslint`, `@typescript-eslint/*`, `prettier` in root `package.json`.

## Environment And Config
- Main config file is `.env` (template `.env.example`).
- Important env variables documented in `README.md`:
  - `FLOW_COOKIE`, `FLOW_BEARER_TOKEN`, `FLOW_GOOGLE_API_KEY`
  - `FLOW_API_BASE_URL`, `FLOW_TRPC_BASE_URL`
  - `FLOW_LOCAL_API_KEY`, `PORT`, `FLOW_TELEMETRY_MODE`

## Operational Artifacts
- Network capture/reference artifacts are present at root:
  - `curl_request_flow.txt`
  - `url_request_flow.txt`
  - `labs.google.har`
- Generated image/output samples are stored under `output/` and root `.png` files.

