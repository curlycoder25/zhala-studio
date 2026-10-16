# Postiz planning

Zhala Studio uses the owner's existing Postiz connection through the Sites connector runtime. It does not deploy a self-hosted Postiz instance or purchase a subscription. No provider API keys or native connector credentials are stored in the repository, browser, or database.

Only the original studio workspace owner can list Postiz accounts, read provider publishing rules, create schedules, inspect receipts, or reconcile an uncertain operation. Other studio members retain the existing brief/design/comment workflow. Postiz data is not added to the shared studio-data response.

## User flow

Set the brief to **Hazır**, upload final designs, and click **Paylaşımı planla**. The brief's current edits are saved first. Choose an account explicitly, select final JPG/PNG designs in order, enter the caption and a local date/time, review, then click **Postiz’de planla**. Supported: Instagram/Facebook image posts, carousels with 2–10 images, and one-image Stories. Reels/video and TikTok are not supported by this first version.

Dates use Asia/Famagusta, including daylight-saving changes. Nonexistent or ambiguous wall times are rejected. The server independently checks the current post, owner, selected asset scope, live account list and provider rules. Only the caption and selected final designs are transferred; reference images, brief notes and comments are not.

Selected originals are exposed through 256-bit random transfer URLs for up to 15 minutes during the transfer. The database stores only their SHA-256 hashes. The public route checks the live asset, parent post, workspace, job stage, and expiry. It returns no-store originals without other workspace data. URLs are removed after transfer completion/failure. The Site currently has a public audience; making it private later would prevent an external provider from fetching these media URLs and requires another supported upload path.

## Runtime and recovery

Canonical allowed plugin: `plugin_asdk_app_6aaaf1a529808191a2a15fde824bb013`.
Connector: `asdk_app_6aaaf1a529808191a2a15fde824bb013`.
Fixed server-owned actions: `integrationList`, `integrationSchema`, `uploadFromUrlTool`, `integrationSchedulePostTool`, `postsListTool`.

Every schedule requires an explicit visitor submission and the platform's visitor connection/write consent. Only a confirmed runtime `status=success` is accepted; provider validation errors are kept as errors. The native provider content and diagnostics are retained in API responses. Only reauthentication-required responses offer the trusted top-level Sites sign-in path. No automatic write replay follows sign-in or a failed response.

A durable job is reserved before media writes. Each request has a fingerprint and UUID; a conditional SQL insert also prevents concurrent active jobs for the same studio post and Postiz account. Up to three media uploads run concurrently while preserving selection order. Only one external schedule call is made for each accepted job. Uncertain results block another plan until checked against Postiz. Explicit recovery requires the owner to confirm they checked that the plan is absent/cancelled. Recovery does not cancel a remote plan.

The owner-only **Paylaşım planı** view shows the last 100 locally submitted jobs. **Durumu kontrol et** reads Postiz and updates the last confirmed state. Posting is performed by Postiz while this Site/chat is closed; no ChatGPT recurring task is needed. Deleting a studio brief does not cancel a Postiz plan, and the receipt survives brief deletion. The UI explains this at deletion and in publishing history.

## Verification

TypeScript, a full Site build, and isolated SQLite/Worker-route tests cover identity/origin gates, assets, DST, caption escaping, provider limits, transfer expiry, duplicate submissions and concurrent requests, uncertain outcomes, explicit recovery, result preservation and history visibility. Existing brand/calendar/image regression checks also pass. Browser QA and real hosted visitor consent/reads/writes must be distinguished from these local checks. No real social post is created to test this integration without a specifically authorized target, content and time.

## Public Site transport (version 11)

The deployed public Site returned `binding_unavailable` before reaching Postiz. Current official Sites guidance requires workspace-private Sites for visitor plugin access. The existing audience is intentionally preserved. An explicitly configured `POSTIZ_API_KEY` runtime secret selects the Postiz Public API transport before any connector invocation. The owner's existing secret named `postiz` is also accepted; a non-empty `POSTIZ_API_KEY` always takes precedence, including when invalid, so rejected credentials never cause a retry with another key. Both names remain server-only. This is a separate owner-authorized provider connection, not a fallback for a denied connector call. Existing plugin declarations remain intact.

The API key must be entered by the Site owner in Sites > Zhala Studio > Settings as a secret. Do not ask for the value in chat or persist it in the repository/database. Redeploy after the environment revision changes. Missing/invalid setup displays an owner-only setup guide instead of a raw runtime error or an empty error banner. No API key is sent to browsers or logs.

The planner loads accounts and brief assets independently. A failed Postiz read does not discard successful private asset data or claim that designs are missing. Connection and asset errors stay at the top of the dialog across caption/time edits; preview is disabled until both resources are loaded. HTTP 401 with Postiz's exact `No subscription found` response is identified separately from rejected credentials. Failed provider calls log only the operation category, HTTP status and curated Turkish message, never raw bodies, authorization headers or keys.

The actual transport is also checked in workerd. The production account-read failure was reproduced there: `redirect: 'error'` throws during request construction, before contacting Postiz. Use `redirect: 'manual'` and reject all 3xx responses explicitly. This preserves the fixed-origin credential boundary without relying on an unsupported runtime option. The runtime regression check verifies a successful account read, a rejected redirect with no request to its target, and a provider 401 response using only a fake key and mocked upstreams.

The direct transport uses only the fixed official `https://api.postiz.com/public/v1/` origin and fixed integrations, integration-settings, upload, and posts endpoints. Redirects are rejected to avoid forwarding Authorization to another origin. Each operation still requires the original studio owner and existing Origin/input/idempotency checks. It never switches from a denied connector operation to API access; selection is made by explicit runtime configuration. The server fetches live channel rules by integration ID and passes the provider-specific `__type` settings. Media IDs returned by multipart uploads are used in the post payload. Provider list/receipt formats are validated and normalized; raw successful response bodies are preserved in result diagnostics.

In API mode final designs are uploaded directly as multipart files from private R2 storage, up to two at a time. Temporary public media links are not used. The existing connector-mode transfer path is retained for compatibility. No external create/schedule calls are retried automatically. API 401/403/429 and uncertain transport results have distinct errors, and existing receipt/recovery checks remain active. A configured secret is not proof of a working provider connection; verify owner account reads after deployment and perform a social write only when that exact post/channel/time has been authorized.
