# Frontend architecture

Updated: 2026-10-09.

## Stack and composition

React 19, TypeScript strict mode, Vite, React Router, TanStack Query, Lucide icons, react-markdown + remark-gfm. Lockfile pins the dependency graph. No global Redux-style state is needed. `src/main.tsx` composes QueryClient, BrowserRouter and AuthProvider. `src/app` owns routes/layout/styles; `src/features` owns screens and domain behavior; `src/shared` owns transport, DTO types, formatting and small UI primitives. Feature routes are lazy-loaded with Suspense; the public login stays eager. Prettier and ESLint define a repeatable source style.

## Container and gateway boundary

The image builds with Node 24.15.0 and runs Caddy 2.10.2 serving only the compiled bundle. Caddy proxies `/api/*` to the internal backend without changing the URI; no API hostname or credential is embedded in browser assets. This keeps cookie sessions, CSRF and downloads on the same origin. Non-API routes use the SPA fallback; static responses request revalidation with `Cache-Control: no-cache` to avoid retaining an old entry document after deployment. Backend API cache/security headers continue to apply, with gateway-wide baseline headers for content sniffing, referrers and browser capabilities.

The runtime image requires API contract `3` through `io.bmepilots.api.requires`; the backend advertises that contract through `io.bmepilots.api.contracts`. Contract 3 includes staged uploads, administrator password resets and last-successful-sign-in metadata. The updater must match these labels before replacing either image, because independent successful CI runs do not guarantee the same API contract. See `docs/CI.md` for maintenance rules.

The request-body ceiling is `263192576` bytes, exactly 251 MiB, retained for older direct clients. Current document creation uses up to five separate multipart requests, each carrying one file of at most 50 MiB, followed by JSON publication. Thus each upload stays below Cloudflare's 100 MB request limit without reducing the total size of a post. The backend independently enforces count, size, ownership and expiry.

The Caddy global `trusted_proxies` setting accepts only `CADDY_TRUSTED_PROXY` (loopback by default; the public override selects the fixed cloudflared address). `client_ip_headers CF-Connecting-IP` resolves a visitor address only from that peer. The API proxy replaces `X-Forwarded-For` with `{client_ip}` and removes `Forwarded`, `X-Real-IP` and `CF-Connecting-IP` before forwarding. Untrusted callers therefore cannot forge a visitor address using these headers. The backend must independently restrict its proxy trust to Caddy's fixed internal address. Cloudflared and Caddy addressing is owned by the db deployment, and the gateway has no public port. Preserve both boundaries together when changing networks.

Canonical deployment is in `../db/deploy`, replacing the unversioned deployment draft. The base publishes no ports, and MariaDB/backend remain private to Docker networks. `compose.loopback.yml` publishes only the gateway at VM `127.0.0.1:8088` for SSH-forwarded HTTP verification and temporarily disables Secure cookies. Public HTTPS must restore Secure cookies and omit that preview override. The db preparation/start scripts own the `/srv/bmepilots` mount check, persistent storage permissions and service health ordering. See STATUS for actual run evidence; container or workflow files alone do not prove deployment or image publication.

## Feature map

- auth: session provider, public login/registration, password change.
- dashboard: aggregate API and overview cards for announcements, documents, upcoming events, links and personal unread count.
- announcements: list and admin Markdown editor.
- documents: shared post list/detail, per-file staged uploads with retry and cleanup, JSON publication, file download, comments and author/admin actions. `PostEditor.tsx` owns the temporary upload lifecycle.
- calendar: month/agenda views, date/type filtering and event editor; `calendar-dates.ts` owns civil-date calculations.
- links: categorized external links, member contribution and owner/admin editor.
- mail: local inbox, filtering, sandboxed message view, downloads and personal flags; successful opening marks read once per opening.
- admin: shared admin navigation, user/approval/settings/audit/mail operations, reusable category manager, member sign-in timestamps and the dedicated `PasswordResetDialog.tsx`.

Admin content routes reuse feature pages. Documents/calendar are community screens with author/admin actions; links additionally exposes admin category management. Backend authorization is authoritative. The route guard hides private views for anonymous/pending users and admin views for ordinary members; it is not the security boundary. Legacy `/knowledge/*` and `/admin/knowledge/*` routes redirect to documents; the old knowledge component is no longer routed. The backend preserves the archive and rejects legacy writes with 410.

## API/session contract

All requests go to /api/v1 via shared/api/client.ts. Fetch uses same-origin cookies, no-store caching, structured errors and a lazily initialized CSRF token. Mutation headers use the backend's reported headerName. Login/logout and 401/403 responses reset the cached token; the next mutation obtains a fresh one. CSRF refresh is not a prerequisite for publishing a successful login to the route guard. A generation marker prevents an earlier in-flight token response from restoring a previous session's token. On an expired private API session, an event removes private page queries and sets the observed session query to null. Credentials and mail bodies are never persisted to localStorage.

Preserve the observed `['session']` query when clearing private cached data. Removing that query disconnects the provider from subsequent login updates and can leave the login screen visible after the server accepts the credentials. Session lookup receives an AbortSignal, and login/logout cancels an older lookup before publishing the new user/null value so a stale response cannot undo that transition. Successful login puts the returned user into the session query and the login route redirects to the dashboard. Six rendered tests use the real App/route guards under React StrictMode to cover that transition, delayed stale lookup, an existing session, failed credentials, expiry/repeat sign-in/logout, and an unavailable secondary CSRF refresh. Check STATUS for actual results.

The backend clears a revoked session cookie while still allowing public authentication/configuration routes; protected routes remain 401. This lets a member sign in again directly after expiration or password/session revocation without a failed first attempt caused by the obsolete session. A 401 from a private request clears frontend session state and private query data.

### Administrator password reset

`PUT /admin/users/{id}/password` accepts `{newPassword, version}` and returns the updated `User`. The ordinary API client supplies same-origin cookies and CSRF; the backend enforces admin authorization, nonblank 12–128-character passwords and optimistic concurrency. The Members screen captures the target object when the dialog opens. It does not silently substitute a refreshed version into a submitted reset. A 409 refreshes the member list, disables resubmission and requires reopening to review current details. Resetting does not change account status, role or lastLoginAt.

The dialog uses uncontrolled password inputs with `autocomplete="new-password"` and a transient async submit handler, deliberately avoiding a TanStack Query mutation whose variables could retain a plaintext password. Client validation preserves exact password characters and checks confirmation; whitespace-only input is rejected. Inputs are cleared immediately before the request, on cancellation through unmount, and after a successful dialog close. React state contains only pending/error/conflict flags, not the password. The UI locks duplicate submissions and native-dialog Close/Escape while pending. A failed request requires password re-entry. No password appears in a notification or gets sent by email.

Successful resets for another member invalidate admin queries and display a name/email-only status notice. Self-reset dispatches the existing `session-expired` event as a CustomEvent with the non-secret reason `password-reset`. The provider cancels an obsolete session lookup, clears CSRF and private cached data and publishes a null session without deleting its observed query. It also holds a boolean `passwordReset` notice flag in memory; `AuthPage` reads that flag for the fixed English sign-in-again notice. The explicit navigation and Protected route guard both lead to `/login`, so the notice must not rely on navigation state, which competing redirects can replace. A late ordinary session-expired event retains the notice; successful sign-in or explicit logout clears it. A full page reload also discards this memory-only notice. No logout request is required after the backend has revoked the session. Backend tests remain authoritative for revocation, permissions and audit redaction.

The transport accepts FormData for uploads and leaves Content-Type unset so the browser generates a matching multipart boundary. It still attaches CSRF. `POST /documents/uploads` receives a single `file`; `POST /documents` then receives `{title, description, uploadIds}`. Successful stages are reused after a failed transfer. A publication attempt freezes the file selection and reuses the same IDs on retry, because a lost response may mean the post already exists. A 404 on publication disables retry and asks the member to check the list; it never automatically reuploads consumed IDs. Removal, cancel and editor unmount request best-effort deletion of unconsumed stages, while backend expiry handles unreachable cleanup and abandoned tabs. Client state is memory-only. Downloads use authenticated relative API URLs and forced attachment headers. Client-side file count/size validation is feedback only; the backend independently enforces 1–5 nonempty files of at most 50 MiB each.

TanStack Query keys start with the domain (announcements/documents/calendar/links/mail/admin/session). Mutations invalidate domain data and dashboard aggregates where appropriate. Version values travel back on content writes and deletes; 409 errors require reloading, not blind overwrite. Forms preserve error messages and disable duplicate submission while pending. Mail PATCH sends only the changed read/important field; this avoids overwriting another flag from stale list data. Manual unread is not immediately undone by the open-message effect; it is marked read only after another opening.

## Time and attribution

Activity timestamps, including document/comment creation and calendar createdAt/updatedAt, are UTC values from the backend. Calendar startsAt/endsAt are Europe/Budapest wall times and must not pass through the generic UTC date formatter. The same entered classroom time is displayed regardless of the viewer's machine timezone. All-day ends are exclusive in the API; the date editor presents the corresponding human-readable date range. Null-end deadlines are valid point-in-time entries. See `docs/COMMUNITY.md` and backend `docs/COMMUNITY.md` for date examples and limitations.

The backend returns authorId/authorName and owns creation attribution. Controls depend on the current user being the author or an admin, but all mutations repeat those checks server-side. Moderator edits preserve original authorship. Legacy links with no recorded author display Original content; migration does not invent an author.

Admin audit has separate named activity and API request views. The latter shows method, route template, response status and duration. Full timestamps display in Europe/Budapest. Credentials, cookies, raw query strings and content bodies are excluded by backend logging, not merely hidden by the UI.

The `User` DTO also has nullable `lastLoginAt`, a UTC ISO timestamp (the backend can omit the `Z`). Members and Applications display it with `Intl.DateTimeFormat('en-GB', {dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Europe/Budapest'})` and a semantic `<time>` element. The column explicitly names the timezone. Null displays `No sign-in recorded`, which does not claim that a historical sign-in never occurred. It records successful authentication, not activity, refreshes or password resets. The backend handles historical backfill and success-only persistence.

## UI decisions

Navy shell, warm neutral content area, muted orange accents, system fonts, compact aviation instrument illustration in CSS. No paid assets, external fonts, tracking, stock photos or official university logos. Brand is text-based BME PILOTS / CLASS OF 2026 and clearly labeled unofficial. English aviation micro-labels complement English controls/content. Navigation collapses below 720px, tables scroll horizontally, content grids stack. Reduced-motion preference is respected. Dialogs use native dialog focus management, forms have visible labels, icon-only controls have accessible names, and the layout provides a skip link.

## Content security

Markdown does not allow raw HTML; remote images are blocked and links use noopener/noreferrer. Document descriptions/comments are untrusted member content and never rendered as raw HTML. Email HTML is backend-sanitized and rendered only in a sandbox iframe without scripts/same-origin access. The iframe adds CSP forbidding network resources, forms and images. Document files and mail attachments download through a cookie-authenticated API, never a public filesystem URL. Uploaded files are not previewed or executed by the app. No remote image/avatar trackers are loaded.

## Extension recipe

Create a new feature directory and typed DTOs; use the shared API client; add a route to app/App and, when appropriate, navigation. Prefer domain query hooks once repeated calls justify extraction. Do not put feature code in shared just to avoid a local file. Any API change must be documented in backend/docs/API.md and mirrored in frontend DTOs. Add loading/empty/error states and meaningful tests; update STATUS and README.

## Current tradeoffs

Feature screens initially co-locate their query/form logic; extract components/hooks as screens grow. One stylesheet contains grouped tokens, shell and component styles to make the initial design coherent. No dedicated UI component framework or rich text editor. Offset pagination mirrors current backend limits. PortalName is currently persisted/configured, while the brand wordmark stays fixed to the BME Pilots identity.

Public HTTPS/Cloudflare and automatic VM updates are configured in the sibling deployment repository; consult its status for actual activation. The per-file upload flow and restricted proxy trust are implemented here. Separate backend runtime/migration database credentials, coordinated encrypted offsite backups and restore rehearsals are operational concerns; the frontend image does not provide them.
