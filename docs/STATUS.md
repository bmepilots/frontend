# Frontend status and handoff

Updated: 2026-10-05. Update on every code/contract change.

## Implemented

- React/TypeScript/Vite foundation, feature directories and typed API client.
- Session/CSRF handling, login/register, protected member/admin routes.
- Responsive navy/neutral BME Pilots 2026 interface with authentic empty states.
- Dashboard, announcements, Shared Documents with uploads/discussion, calendar month/agenda views, member-contributed links, shared inbox and integrated admin screens.
- Native dialogs, Markdown editors, category management, optimistic-version payloads and authenticated multipart uploads.
- Documentation and AGENTS rules; Caddy static frontend/gateway image deployed to the private Ubuntu VM via ../db/deploy. CI workflows are configured to verify and publish GHCR images.
- All UI, accessibility labels, empty states and client errors are English; dates use en-GB formatting. User-provided content is not translated.
- Lazy feature routes, Prettier formatting, account avatar link and CSRF refresh after session expiration.

## Verification

- npm install complete, dependency audit reported no vulnerabilities.
- TypeScript and Vite build passed; route chunks split successfully without the earlier bundle-size warning.
- ESLint passed with no errors or warnings after separating the auth hook/context.
- 14 transport/auth tests passed, including CSRF renewal, FormData boundaries and rendered login route-guard transitions.
- Final build, lint and Prettier format checks passed after the English conversion and session-state fixes.
- In-app browser access was denied. No DOM/visual/mobile QA or screenshot was obtained; no alternative browser route was attempted.
- The sibling backend's live Gmail scheduler was verified on 2026-10-03: 3 messages imported, no account error and zero durable failures. This verifies ingestion, not browser rendering; credentials remain backend-only.
- Prettier checks passed for the documentation update recording Gmail availability; no frontend application code changed in this configuration step.
- Fixed post-login routing: private query data is cleared without removing the observed session query, so a successful sign-in now updates the route guard and redirects to the dashboard.
- 20 community interaction/date/file tests passed for documents, comments, calendar and member link controls. Targeted ESLint and Prettier checks passed.
- Auth hardening now cancels stale session lookups, discards old CSRF responses after session changes and keeps successful login independent of a secondary token refresh. The local HTTP smoke check verified login 200, authenticated dashboard/community/audit routes 200, logout 204 and post-logout 401.

## Limitations

- Real Gmail is configured in this workspace; visual verification of the populated inbox is still pending.
- Password reset/recovery screen is not yet implemented; password change is available at /account.
- A browser visual pass remains pending; backend and component tests cover mail read-state behavior.
- A real calendar is available; no external calendar synchronization is implemented.
- Private VM deployment verified. The per-file upload flow and restricted proxy trust for Cloudflare are implemented; public activation and automatic rollout are tracked by the sibling db deployment. Hosted CI and GHCR publication succeeded on 2026-10-05.

## Handoff

Use README for startup, ARCHITECTURE for route/data/security rules, backend/docs/API.md for the API. Keep the documentation synchronized when adding routes, changing payloads or running verification.

## Private VM deployment — 2026-10-05

- Canonical configuration is versioned in db/deploy; the old \_deployment-draft is superseded. Backend and frontend images were built on the Ubuntu 22.04.5 VM with Docker Engine 29.8.2 and Compose 5.6.0.
- MariaDB 11.8.8, backend and frontend are healthy. Caddy serves the SPA and proxies /api from 127.0.0.1:8088; access is through SSH forwarding. No public tunnel is configured.
- Persistent ext4 disk mounted at /srv/bmepilots contains MariaDB, documents, attachments and rolling logs. Docker has a RequiresMountsFor dependency; startup checks mount presence. Existing development DB3307 was not touched.
- VM gateway checks passed: SPA/deep links, anonymous rejection, CSRF/login, authenticated dashboard/community/admin routes, upload/comment creation, logout rejection. Database metadata, comments and exact file bytes survived forced recreation of all three containers; only the test post was then removed.
- Fresh per-VM random secrets were generated without printing passwords. Non-root backend storage ownership and group-readable secret permissions were verified by successful startup/upload. VM Gmail is disabled; local development Gmail settings were not copied.
- A coordinated local backup stopped backend writes, captured MariaDB plus both file stores and image references, and restarted the existing backend. SHA256, gzip and tar integrity passed. Full restore rehearsal, scheduling and encrypted offsite copies are not yet implemented.
- CI workflows passed actionlint 1.7.12/ShellCheck locally. GitHub-hosted execution and image publication subsequently succeeded; the VM currently runs source-built images tagged vm-20261005, not registry images.
- Frontend verification rerun: 38 tests passed and ESLint passed; production bundle built successfully inside the VM image. No browser visual QA was performed.

- Hosted verification and GHCR publication succeeded: [backend run](https://github.com/bmepilots/backend/actions/runs/37312796111), [frontend run](https://github.com/bmepilots/frontend/actions/runs/37312807646). The VM remains on the verified source-built image pair; image publication alone does not roll out a new version. All three repositories were pushed successfully.

## Cloudflare upload and proxy preparation — 2026-10-05

- Document creation now sends one file per request to `/documents/uploads`, then publishes JSON with the staged IDs. The five-file/50 MiB-per-file limits are preserved while each browser request fits below 100 MB.
- The editor shows the file currently uploading, reuses successful stages after a failed transfer, and requests cleanup on removal/cancellation/unmount. Backend expiry handles unreachable or abandoned cleanup. Publication retry preserves the original IDs to avoid duplicate posts after a lost response; unavailable IDs stop retries and direct the member back to the list.
- Caddy trusts only the configured tunnel connector IP for `CF-Connecting-IP`, normalizes `X-Forwarded-For` and strips alternative forwarded visitor-IP headers. Public deployment must also restrict backend proxy trust to Caddy's fixed internal address.
- The runtime image declares API requirement `2` so deployment tooling can defer this frontend until the backend image advertises staged-upload support.
- All 41 frontend tests across eight files passed, including six document interaction tests. ESLint, TypeScript/Vite production build and Prettier checks passed. Caddy 2.10.2 adapted and validated the configuration. A disposable real Docker proxy check passed for both trusted and untrusted callers: spoofed visitor/protocol headers from direct callers were rejected, trusted Cloudflare visitor IP/HTTPS survived, and alternative headers did not reach the origin. Test containers and network were removed afterward.
- This is transport/component verification, not live browser visual QA or proof of public tunnel activation. Consult the deployment status for the running VM revision and Cloudflare state.

## Live VM activation — 2026-10-05 evening

- New backend `7d155fef44438e6da6fab1d0ada46a8a9e02c49b` and frontend `e0c8bdeb94182629bf6f50f54937d6ac7de07b0c` were built and deployed on the VM. Hosted CI and GHCR publication also succeeded: [backend run](https://github.com/bmepilots/backend/actions/runs/37352812488), [frontend run](https://github.com/bmepilots/frontend/actions/runs/37352581856). The running pair currently uses local source-built images recorded in private release.env; registry rollout is not yet activated.
- Flyway V1–V8 are successful. Separate runtime DML and migration connections are active; the runtime account identity/grants were checked. Gmail continues to synchronize successfully with no durable failures after the deployment.
- The staged-upload smoke check passed through the VM gateway: anonymous rejection, CSRF/login, protected routes, per-file upload followed by JSON publication, comment, container recreation, exact downloaded bytes, deletion of only the test post, and logout rejection.
- Public Compose mode is active. MariaDB, backend, Caddy and the pinned cloudflared connector are all healthy; Docker reports no published host ports for any of them. Session cookie flags Secure, HttpOnly and SameSite=Lax were verified. The tunnel is connected, while domain DNS routing and the external HTTPS/login check remain pending user account configuration at this point. A healthy connector alone is not a public-login test.
- Daily local backups are enabled for 03:15 Europe/Budapest plus up to five minutes of jitter. Backup 20261005T175514Z passed an isolated full SQL/application restore, three referenced-file checks and an exact document download check; temporary resources and the production smoke post were removed. Encrypted offsite backup and external alert delivery remain unconfigured.
- Installed update service/timer and 13 operation safety tests passed on Ubuntu, but the update timer stays disabled until GHCR read access is supplied and one registry update succeeds. The root-owned operation directory/lock were hardened. Infrastructure scripts and database engine versions require explicit reviewed installation; only application images follow successful main workflows automatically once enabled.

## Registry rollout and public HTTPS verification — 2026-10-05

- The owner made the backend/frontend GHCR packages public. Anonymous pulls and the updater's immutable-digest, OCI revision and API compatibility checks succeeded; no GitHub credential was installed on the VM.
- Backend dependency patch 7660284d366032c769c2305d0e3481f0cf0f29b3 passed [hosted verification and publication](https://github.com/bmepilots/backend/actions/runs/37354712297). GitHub's authenticated Dependabot query subsequently returned zero open backend dependency alerts. The patch updates Bouncy Castle to 1.85 and jsoup to 1.23.1; this is not a general security-audit claim.
- The actual updater completed a coordinated backup, promoted the compatible registry image pair, and passed health/SPA/proxied-CSRF checks. The update timer is now enabled (five minutes after each run plus up to 30 seconds jitter). The persisted release.env/update-state.json are the running-image authority; source build tags are no longer active.
- Cloudflare routing is active: public HTTPS returned the BME Pilots login page and application configuration, and plain HTTP redirected to HTTPS with 301. Session cookies have Secure, HttpOnly and SameSite=Lax. Public HTTPS authentication, protected APIs, staged upload, JSON publication, comments and logout passed through the real tunnel with certificate validation. This API/transport check is distinct from browser visual testing.
- The workstation router DNS at 192.168.0.1 still cached a negative response temporarily, while Cloudflare/Google public resolvers returned the correct edge addresses. During that cache window the operator test explicitly used a freshly resolved Cloudflare edge IP while preserving the real hostname, HTTPS SNI and certificate verification. No hosts-file or persistent DNS setting was changed. Direct home-router WAN IP access is not the application route.
- Final public persistence check passed after recreating the registry-backed backend: exact staged-document bytes/comments survived, the operator test post was deleted, and logout invalidated the session. A new backup of the patched V8 deployment also passed an isolated restore (SQL/Flyway, login/protected APIs, two referenced mail files; no document remained in that snapshot after test cleanup).
- The router's negative DNS cache expired. A normal HTTPS request from the workstation, using its unchanged system DNS and no address override, returned 200 for /login. Cloudflare configuration and local hostname resolution are both verified. The smoke client identifies itself as BMEPilotsDeploymentCheck/1.0; the generic Python user agent had been rejected by the edge.
