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
- Private VM deployment verified. Public HTTPS/Cloudflare, compatible upload flow and automatic rollout remain pending. Hosted CI/GHCR publication is not yet verified.

## Handoff

Use README for startup, ARCHITECTURE for route/data/security rules, backend/docs/API.md for the API. Keep the documentation synchronized when adding routes, changing payloads or running verification.

## Private VM deployment — 2026-10-05

- Canonical configuration is versioned in db/deploy; the old \_deployment-draft is superseded. Backend and frontend images were built on the Ubuntu 22.04.5 VM with Docker Engine 29.8.2 and Compose 5.6.0.
- MariaDB 11.8.8, backend and frontend are healthy. Caddy serves the SPA and proxies /api from 127.0.0.1:8088; access is through SSH forwarding. No public tunnel is configured.
- Persistent ext4 disk mounted at /srv/bmepilots contains MariaDB, documents, attachments and rolling logs. Docker has a RequiresMountsFor dependency; startup checks mount presence. Existing development DB3307 was not touched.
- VM gateway checks passed: SPA/deep links, anonymous rejection, CSRF/login, authenticated dashboard/community/admin routes, upload/comment creation, logout rejection. Database metadata, comments and exact file bytes survived forced recreation of all three containers; only the test post was then removed.
- Fresh per-VM random secrets were generated without printing passwords. Non-root backend storage ownership and group-readable secret permissions were verified by successful startup/upload. VM Gmail is disabled; local development Gmail settings were not copied.
- A coordinated local backup stopped backend writes, captured MariaDB plus both file stores and image references, and restarted the existing backend. SHA256, gzip and tar integrity passed. Full restore rehearsal, scheduling and encrypted offsite copies are not yet implemented.
- CI workflows passed actionlint 1.7.12/ShellCheck locally. GitHub-hosted execution and image publication remain unverified; the VM currently runs source-built images tagged vm-20261005, not registry images.
- Frontend verification rerun: 38 tests passed and ESLint passed; production bundle built successfully inside the VM image. No browser visual QA was performed.
