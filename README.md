# BME Pilots 2026 · Frontend

English React/TypeScript community portal for the unofficial BME Professional Pilot class of 2026. Future domain: bmepilots2026.com. Designed for desktop and mobile, with an integrated admin area. No university systems are integrated and no cloud deployment is configured.

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
- Shared Documents: every active member can publish a description and 1–5 files (up to 50 MiB each, displayed as 50 MB), download files and discuss posts in comments. Authors are shown; authors and admins can edit/delete their entries. Admins can moderate all entries.
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

## Documentation discipline

Read `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/COMMUNITY.md` and `docs/TESTING.md`. Update `docs/STATUS.md` on every change with features, actual checks and limitations. Update this README for setup changes, architecture for cross-cutting choices and backend API docs for contract changes. All three sibling repositories have independent histories; do not add a parent Git repository.
