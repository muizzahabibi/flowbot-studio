# Changelog

## 2026-03-17

### Added
- Prefer `FLOW_GOOGLE_COOKIE` over `FLOW_COOKIE` when bootstrapping the core client.
- Document local-server auth bootstrap, bulk generation flow, and troubleshooting updates for the new release.

### Fixed
- Refresh auth from Google Flow cookie when bootstrap bearer tokens are stale or session refresh is required.
- Keep local-server generation working after server restarts by relying on the refreshed cookie-backed auth path.
- Normalize PowerShell OpenAI-style `data` responses in `scripts/generate-20-kolam-renang.ps1` so single-item responses do not crash on `.Count` access.

### Verified
- Focused core/server regression tests pass for bootstrap priority, auth-session refresh, and route behavior.
- Real local-server generation succeeded for `Count=1` and `Count=20`, with all images saved and `manifest.csv` marked `ok`.

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
