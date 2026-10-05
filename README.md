# BME Pilots 2026 · Frontend

English React/TypeScript community portal for the unofficial BME Professional Pilot class of 2026. Future domain: bmepilots2026.com. Designed for desktop and mobile, with an integrated admin area. No university systems are integrated. The static container deployment targets a private Ubuntu VM; canonical configuration lives in `../db/deploy`. See `docs/STATUS.md` for actual deployment and verification evidence.

## Local start

Prerequisites: Node 22.12+, sibling backend at 127.0.0.1:8080, Docker MariaDB started from `../db`.

```
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Vite binds loopback only and proxies `/api` to the backend, preserving same-origin cookies. Use this exact host consistently (do not mix localhost and 127.0.0.1 cookies). If port 5173 is occupied, Vite fails rather than silently changing ports.

Start the backend with `pwsh -File scripts/dev.ps1 -Bootstrap` on first run; read its local `.local-admin.env` for the random admin credentials. They must never enter frontend source or VITE variables. Registration is initially closed and can be opened in Admin → Settings.

## Available screens

- Login/registration and approval acknowledgement.
- Dashboard with announcements, recent shared documents, upcoming calendar entries, useful links and your unread mail count.
- Shared Documents: every active member can publish a description and 1–5 files (up to 50 MiB each, displayed as 50 MB), download files and discuss posts in comments. Files upload one at a time with progress by file and retry support before the post is published. Authors are shown; authors and admins can edit/delete their entries. Admins can moderate all entries.
- Calendar: member-created exams, events and homework deadlines with month/agenda views, date selection, type filters, all-day entries and author attribution. Times use Europe/Budapest.
- Useful links: every active member can add links; owners/admins can edit/delete. Category management remains admin-only, with General available as an initial category.
- Shared inbox with search, unread filter, message view, attachment downloads and personal read/important state. Successfully opening a message marks it read; manually marking it unread persists until it is opened again.
- Admin overview, registrations, users, announcements, documents, calendar, links, mail connection, settings and separate activity/API request log views.
- `/account` for password changes (successful change revokes sessions).

No fake messages, dates, schedules or external account connections are seeded. Empty states are intentional until members contribute content or mail is configured. Source defaults leave Gmail disabled; the current workspace has a configured backend-only connection, documented in the backend. The Gmail-disabled state is explained in the admin screen.

Knowledge base navigation has been replaced by Shared Documents. Old `/knowledge/*` and `/admin/knowledge/*` URLs redirect to the corresponding document area. Backend migration V5 preserves existing articles as text-only posts; only newly created posts require files. Neither legacy knowledge data nor existing development data is reset.

## Commands

- `npm run dev`: local Vite server.
- `npm run build`: strict TypeScript check and production bundle (does not deploy).
- `npm run lint`: ESLint/React hook checks.
- `npm run test`: unit tests.
- `npm run format`: apply the committed Prettier style; `npm run format:check`: verify it.
- `npm run preview`: locally serve a built bundle; API proxy is a development-server feature, so normal full-stack use is `npm run dev`.

## Ubuntu VM container deployment

`Dockerfile` builds the Vite bundle with Node 24.15.0 and serves the compiled files through Caddy 2.10.2. No Vite development server runs in the runtime image. `Caddyfile` preserves same-origin sessions by proxying `/api/*` to the internal `backend:8080` service without stripping the path. Other routes fall back to `index.html`, allowing direct navigation to React routes. Static responses use `Cache-Control: no-cache` so browsers revalidate after application updates; API responses retain backend cache controls. Baseline response headers disable content sniffing and unused browser capabilities.

The gateway request limit remains exactly `263192576` bytes (251 MiB) for compatible older clients. The current frontend sends a separate multipart request for each file (at most 50 MiB plus overhead), then publishes a small JSON payload referencing the staged uploads. This fits Cloudflare's 100 MB request ceiling even when a post contains five files. A failed file transfer can be retried without resending completed files; cancellation discards completed stages on a best-effort basis, with backend expiry as a fallback. See `docs/COMMUNITY.md` for retry and ambiguous-publication handling.

`CADDY_TRUSTED_PROXY` names the single trusted tunnel connector IP/CIDR; it defaults to loopback, not every private network. The Cloudflare deployment override sets the connector's fixed Docker address. Caddy accepts `CF-Connecting-IP` only from this peer and overwrites the backend's `X-Forwarded-For` with the validated client IP while removing alternative client-IP headers. The backend must trust only Caddy's fixed internal address. Never expose the gateway directly on a public host port or broaden proxy trust to all callers. The canonical deployment guide documents the exact network assignments.

The canonical [`../db/deploy`](../db/deploy/README.md) stack replaces the earlier unversioned deployment draft. Its base publishes no host ports. `compose.loopback.yml` exposes only VM `127.0.0.1:8088` for an SSH-forwarded HTTP preview and sets the backend's `COOKIE_SECURE=false` for this mode. Database and backend ports remain unpublished. Public HTTPS through Cloudflare must use Secure cookies and omit the HTTP preview override. Cloudflare configuration, automatic updates, storage preparation, startup health checks and persistent data under `/srv/bmepilots` are owned by the db deployment scripts; consult their status for actual activation.

## Continuous integration and image publication

`.github/workflows/ci.yml` is configured to run `npm ci`, tests, lint, formatting verification and the production build on pull requests and pushes to `main`, then build the Docker image. A successful `main` run is configured to publish `ghcr.io/<owner>/frontend:<commit-sha>` plus the moving `:main` tag using the workflow's short-lived `GITHUB_TOKEN`. Use the published digest as the immutable deployment reference; tags can move. See `docs/CI.md` for workflow and registry details. Workflow configuration is not proof of a completed GitHub run or published image; consult `docs/STATUS.md` for verified results. The workflow does not deploy to the VM.

## Documentation discipline

Read `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/COMMUNITY.md` and `docs/TESTING.md`. Update `docs/STATUS.md` on every change with features, actual checks and limitations. Update this README for setup changes, architecture for cross-cutting choices and backend API docs for contract changes. All three sibling repositories have independent histories; do not add a parent Git repository.
