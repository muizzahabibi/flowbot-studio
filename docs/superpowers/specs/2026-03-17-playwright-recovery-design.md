# Playwright Recovery Design

## Summary
Add a Playwright-based recovery path in the server layer so the system can recover from GoogleFlow auth/session expiry and reCAPTCHA reload scenarios without embedding browser automation inside the core SDK. The recovery flow should support hybrid operation: automatic browser startup and state restoration, with manual user intervention only when a Google challenge requires it.

## Goals
- Detect GoogleFlow auth/session refresh failures and reCAPTCHA reload-required failures.
- Trigger a Playwright recovery flow automatically from the server layer.
- Support both local headed mode and deployed headless mode.
- Bootstrap recovery from a raw Google cookie string and persist the recovered browser state for reuse.
- Retry the failed generate request once after successful recovery.

## Non-goals
- Fully guarantee automatic completion of every Google challenge or reCAPTCHA flow.
- Move Playwright into `packages/core`.
- Add unlimited retries or background worker orchestration for this first version.
- Persist sensitive auth material in source control or logs.

## Current State
- Auth refresh currently happens in `packages/core/src/auth/flow-auth-session.ts` by calling `https://labs.google/fx/api/auth/session` with the configured cookie.
- If Google returns `ACCESS_TOKEN_REFRESH_NEEDED`, the core layer throws an auth error immediately.
- The server route in `packages/server/src/routes/flow.ts` accepts a caller-supplied `recaptcha_token` and forwards it directly into the core generate call.
- There is currently no browser automation fallback, state persistence, or recovery retry path.

## Recommended Approach
Implement the recovery flow in the server layer using a dedicated recovery orchestrator and a Playwright service.

### Why this approach
- Keeps `packages/core` focused on HTTP/auth responsibilities.
- Allows Playwright to remain optional and environment-aware.
- Makes it easier to support both headed local recovery and headless deployment behavior.
- Centralizes retry policy and sensitive state handling in one place.

## Architecture

### Core SDK
Responsibilities:
- Continue performing auth refresh and API requests.
- Throw structured errors that the server layer can classify.
- Remain unaware of Playwright.

#### Recoverable error contract
The server layer must not depend on brittle message matching. The core/server contract should expose stable error metadata such as:
- `code`: canonical machine-readable error code
- `source`: `auth_session | generate_request | recovery`
- `retryable`: boolean
- `details`: optional provider-specific payload for logging/redaction

For the first version, `code` is the single source of truth used by the orchestrator, logs, and API responses. Human-readable categories may exist in code comments or internal helpers, but they must map directly to the canonical codes below.

Initial canonical codes required for recovery:
- `FLOW_AUTH_REFRESH_NEEDED` for `ACCESS_TOKEN_REFRESH_NEEDED`
- `FLOW_AUTH_INVALID_COOKIE` for malformed, rejected, or otherwise unusable cookie/session refresh input
- `FLOW_CAPTCHA_RELOAD_REQUIRED` for generate failures that explicitly indicate challenge reload is required
- `FLOW_MANUAL_BROWSER_ACTION_REQUIRED` for recoveries that require local human action and cannot complete automatically
- `FLOW_PLAYWRIGHT_RECOVERY_FAILED` for recovery startup, navigation, parsing, or timeout failures

The orchestrator should only trigger recovery from these codes, not from free-form text.

### Server Recovery Orchestrator
Suggested location: `packages/server/src/services/flow-recovery-orchestrator.ts`

Responsibilities:
- Inspect errors from the core SDK.
- Decide whether recovery should run.
- Invoke Playwright recovery.
- Refresh in-memory/session state as needed.
- Retry the failed request once.

Suggested surface:
- `shouldRecover(error): boolean`
- `recover(context): Promise<RecoveryResult>`
- `retryGenerateAfterRecovery(input): Promise<Result>`

### Playwright Recovery Service
Suggested location: `packages/server/src/services/playwright-recovery-service.ts`

Responsibilities:
- Launch browser in headed, headless, or auto mode.
- Load persisted Playwright storage state when available.
- Fallback to raw cookie injection when persisted state is missing or invalid.
- Open the relevant GoogleFlow page.
- Wait for session restoration or challenge completion.
- Save refreshed storage state for reuse.
- Return structured recovery metadata.

Example recovery metadata:
- `sessionRecovered`
- `captchaReloaded`
- `needsManualAction`
- `storageStateUpdated`

### Recovery State Store
Suggested location: `packages/server/src/services/recovery-state-store.ts`

Responsibilities:
- Read/write Playwright storage state files.
- Optionally store lightweight metadata such as last successful recovery time and last failure reason.
- Treat all stored state as sensitive.
- Quarantine or replace invalid persisted state so poisoned state is not retried indefinitely.

#### State scope and concurrency
For the first version, recovery state should be keyed by a configured profile name or environment-specific identifier rather than by request.

Supported scope for v1:
- single logical runtime per state key;
- no shared mutable storage between multiple server instances unless operators provide external coordination themselves.

This means the first version should be treated as single-process-safe, not multi-instance-safe, when multiple processes or containers point at the same profile key and storage path.

Within one process, the implementation must:
- serialize recovery attempts per state key;
- reuse an in-flight recovery attempt instead of launching multiple browsers for the same key;
- prevent concurrent writes from corrupting the storage-state file;
- ensure one request cannot overwrite unrelated recovery state.

If the project later supports multiple Google accounts, the state key must become account-specific before parallel multi-account usage is enabled.

## Data Flow
1. Request hits `POST /flow/projects/:projectId/generate`.
2. Server calls core generate logic as it does today.
3. If the request succeeds, no recovery is involved.
4. If the request fails with a recoverable auth or captcha error, the orchestrator starts recovery.
5. Recovery service attempts to restore session in this order:
   - load saved Playwright storage state;
   - if that is absent or invalid, inject the raw Google cookie string.
6. Playwright opens the configured GoogleFlow recovery page.
7. If the flow can restore state automatically, it does so and saves new storage state.
8. If a challenge needs human action in headed mode, the browser stays open while the service waits for a valid session state.
9. Successful recovery must produce retry-consumable auth state. For the first version, the authoritative output should be a refreshed cookie jar and persisted Playwright storage state that can be converted back into the cookie/header input expected by the existing core auth flow. The retry path must not assume that browser-only state is enough unless the request itself is rerouted through Playwright, which is out of scope for this version.
10. The recovery layer must define one extraction contract: collect the subset of cookies required by the existing `https://labs.google/fx/api/auth/session` bootstrap and serialize them back into a standard `Cookie` header string for the retry path. If recovery yields a browser session that cannot be converted back into that cookie-based contract, the attempt must be treated as `FLOW_PLAYWRIGHT_RECOVERY_FAILED` rather than as success.
11. After successful recovery, the orchestrator rebuilds the request context using the refreshed cookie/session source and retries the original generate request once.
12. If retry still fails, return the error with recovery context attached.

### Invalid state handling
Persisted state should be treated as invalid when the recovery bootstrap cannot establish an authenticated session from it within the configured timeout or when the target page clearly shows a signed-out/challenge-reset state. Invalid state should be quarantined or replaced before cookie bootstrap is attempted so the same bad state is not reused forever.

## Recovery Triggers
Initial trigger set:
- Google auth/session refresh failure that maps to `ACCESS_TOKEN_REFRESH_NEEDED`.
- Invalid cookie/session errors from auth refresh.
- Generate failures that indicate reCAPTCHA must be reloaded.

For the first version, recovery should only trigger on these narrow conditions.

## Recovery Outputs
After a successful recovery attempt, the system should aim to:
- refresh internal session/auth state;
- update persisted browser storage state;
- refresh challenge-related browser state needed for generation;
- produce a retry-consumable cookie/session representation for the existing core request path;
- retry the original request once.

### CAPTCHA/retry boundary
The existing route currently accepts a caller-supplied `recaptcha_token`. For the first version, the retry path should follow one of two explicit rules only:
- if recovery can produce a fresh token or equivalent request input in a deterministic way, replace the original challenge input for the retry;
- otherwise, the system should fail with a structured recovery result rather than silently retrying with a stale caller token.

The implementation must not assume that browser-visible challenge completion automatically makes the original caller token reusable.

## Configuration
Suggested configuration keys:
- `FLOW_PLAYWRIGHT_ENABLED`
- `FLOW_PLAYWRIGHT_MODE` = `headed | headless | auto`
- `FLOW_PLAYWRIGHT_STORAGE_STATE_PATH`
- `FLOW_GOOGLE_COOKIE`
- `FLOW_PLAYWRIGHT_TIMEOUT_MS`
- `FLOW_PLAYWRIGHT_RECOVERY_URL`
- `FLOW_PLAYWRIGHT_MANUAL_WAIT_MS`
- `FLOW_PLAYWRIGHT_PROFILE_KEY`

### Bootstrap cookie rules
The raw bootstrap cookie must be provided as a standard HTTP `Cookie` header string. The recovery layer is responsible for parsing it into individual cookies before calling Playwright. For the first version:
- only cookies for the configured Google/Flow domains should be imported;
- imported cookies should default to secure settings that match the target HTTPS domains;
- malformed cookie segments should fail fast with `FLOW_AUTH_INVALID_COOKIE`;
- ambiguous multi-account cookie strings should be rejected unless the configured profile key makes the target account unambiguous.

### Mode behavior
- `auto`: resolve to `headless` when `CI=true` or when an explicit no-UI server flag is set; otherwise resolve to `headed`. If neither condition is reliable in an environment, operators should set the mode explicitly.
- `headed`: open a visible browser for hybrid/manual intervention.
- `headless`: attempt passive restoration only; if manual action is required, fail with a structured `FLOW_MANUAL_BROWSER_ACTION_REQUIRED` error instead of hanging.

### Recovery URL and success criteria
`FLOW_PLAYWRIGHT_RECOVERY_URL` must point to the GoogleFlow page that best exposes authenticated state needed for recovery. Recovery success must be determined by explicit signals, not just page load, such as:
- expected authenticated cookies becoming present or changing value;
- a known signed-in UI marker on the recovery page;
- a successful follow-up session check using the existing auth/session endpoint.

A generic page render without those signals must not be treated as success.

## Error Model
Use canonical recovery-relevant codes only:
- `FLOW_AUTH_REFRESH_NEEDED`
- `FLOW_AUTH_INVALID_COOKIE`
- `FLOW_CAPTCHA_RELOAD_REQUIRED`
- `FLOW_MANUAL_BROWSER_ACTION_REQUIRED`
- `FLOW_PLAYWRIGHT_RECOVERY_FAILED`

Behavior:
- recoverable auth/captcha errors trigger recovery;
- Playwright startup or navigation failure returns `FLOW_PLAYWRIGHT_RECOVERY_FAILED`;
- headless mode that reaches a human-only challenge returns `FLOW_MANUAL_BROWSER_ACTION_REQUIRED`;
- original request retry failure stops after one retry and returns the resulting error.

### Recovery response contract
When recovery does not end in a successful retry, the server should return a structured error payload with at least:
- `code`: canonical code such as `FLOW_MANUAL_BROWSER_ACTION_REQUIRED` or `FLOW_PLAYWRIGHT_RECOVERY_FAILED`
- `message`: safe human-readable summary
- `retryable`: boolean
- `recoveryAttempted`: boolean
- `manualActionRequired`: boolean
- `recoveryInProgress`: boolean, always `false` for the first version once the HTTP response is sent

This gives callers enough information to decide whether to ask the user to intervene locally, retry later, or surface a hard failure.

## Retry Policy
To prevent loops:
- at most one Playwright recovery attempt per request;
- at most one retry of the original request after recovery.

No recursive recovery and no unbounded retrying.

## Manual-action UX and timeout behavior
In headed mode, the first version may keep the HTTP request open while the browser waits for recovery completion, but this wait must be bounded by `FLOW_PLAYWRIGHT_MANUAL_WAIT_MS`. On timeout, the server should return a structured `FLOW_MANUAL_BROWSER_ACTION_REQUIRED` or `FLOW_PLAYWRIGHT_RECOVERY_FAILED` response that tells the caller recovery did not complete in time.

Timeout semantics must be explicit:
- if recovery completes before timeout, continue to retry once;
- if recovery times out, do not retry automatically;
- if the browser is still useful for user completion, it may remain open locally, but the request must still fail cleanly;
- headless mode must never wait for manual completion.

## Logging and Secrets Handling
Log:
- recovery trigger type;
- selected execution mode;
- whether storage state or raw cookie bootstrap was used;
- whether manual intervention was required;
- retry success/failure.

Do not log:
- raw cookie strings;
- full storage state payloads;
- bearer tokens or similarly sensitive session material;
- user-identifying storage-state paths or filenames.

Persisted state requirements:
- storage-state files must live outside source-controlled paths;
- writes should be atomic where possible;
- failed or invalid state should be cleaned up or quarantined;
- operators should store bootstrap cookies in secrets management, not plain config checked into the repo;
- if the deployment environment supports filesystem permission hardening or encryption at rest, the recovery files should use it.

Reuse existing redaction utilities where possible.

## Testing Strategy

### Unit tests
Mock the orchestrator dependencies and verify:
- recoverable errors trigger recovery;
- non-recoverable errors do not;
- recovery runs only once;
- retry runs only once;
- headless manual-only flows return `FLOW_MANUAL_BROWSER_ACTION_REQUIRED`;
- malformed cookie bootstrap fails with the expected code;
- corrupted persisted state is quarantined and replaced;
- concurrent requests against the same state key share one recovery attempt;
- logs redact cookies, tokens, and state references.

### Integration tests
Verify:
- server routes call the orchestrator correctly;
- successful recovery feeds into a successful retry path;
- invalid config produces clear failures;
- timeout during headed manual flow returns the expected structured response;
- recovery failure after state save does not leave retry logic in an inconsistent loop.

These tests should not depend on live Google login.

### Manual verification
Validate:
- valid cookie/state path skips browser recovery;
- expired cookie opens recovery;
- successful manual challenge completion persists new state;
- subsequent requests reuse persisted state;
- poisoned saved state falls back to cookie bootstrap instead of failing forever;
- headless deploy mode fails clearly when manual intervention is required;
- reCAPTCHA reload scenarios trigger recovery instead of looping.

## Constraints and Risks
- Google/reCAPTCHA flows are dynamic and may require user interaction.
- Headless deployment cannot guarantee completion of manual-only challenges.
- Raw Google cookies and Playwright storage state are highly sensitive and must be stored only in secure config/file locations.
- Recovery should be implemented narrowly to avoid accidental retries on unrelated failures.

## Implementation Notes
The first implementation should focus on the generate route and the existing auth refresh path before expanding to other endpoints. It should prefer narrow, explicit error matching and avoid broad catch-all recovery behavior.

## Open Assumptions
- The application will run in environments where Playwright can be installed and launched when enabled.
- The user will provide a valid Google cookie string through configuration for bootstrap.
- The target GoogleFlow page provides observable signals that allow the recovery service to detect when session recovery has succeeded.
