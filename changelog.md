# Changelog

## 2026-03-07

### Fixed
- Preserve explicit `content-type` in `FlowHttpClient.post/patch` so `application/json` is not overwritten by `text/plain`.
- Add regression tests for HTTP header behavior in `packages/core/test/http-client.test.ts`.
- Improve `scripts/generate-20-kolam-renang.ps1` reliability:
  - rebuild core/cli when dist is missing or stale,
  - robust CLI process execution and output capture,
  - fallback loading `FLOW_COOKIE` from `.env`,
  - preflight cookie/session check,
  - force bearer-token refresh from cookie to avoid stale token issues.

### Verified
- Core tests pass (`pnpm --filter @flowbot-studio/core test`).
- End-to-end script smoke test (`Count=1`) successfully created a project and saved generated image output.
