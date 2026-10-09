# Frontend agent guide

All visible application text, validation feedback, accessibility labels and empty states must be English. Conversation with the user may be Hungarian. Keep documentation in English.

Read `README.md`, `docs/ARCHITECTURE.md`, and `docs/STATUS.md` before edits. Update these documents whenever behavior, setup, contracts or limitations change. Always update STATUS with actual verification evidence.

- React + TypeScript + Vite; organize business code under `src/features`, composition under `src/app`, shared primitives under `src/shared`.
- The backend at `../backend` owns authorization and business rules. Its API is `/api/v1`; Vite proxies `/api` to loopback port 8080 in development. The container uses Caddy to proxy `/api/*` to `backend:8080` on the same origin.
- Use cookie sessions with credentials and CSRF headers. Never store authentication credentials in localStorage.
- Build an accessible, responsive English community portal for BME Professional Pilot 2026. Clearly label it unofficial. Planned domain bmepilots2026.com is informational only.
- Show real loading, empty and error states. Never substitute mock mail or fake success for disconnected services.
- The admin area is part of this app. Reuse feature editors rather than duplicating business functionality.
- Never render unsanitized email or Markdown HTML. Email uses the backend-sanitized document inside a restricted iframe.
- Keep secrets out of VITE\_\* variables and all frontend build inputs. The authorized Ubuntu deployment is maintained in `../db/deploy`; its base has no published ports, and the temporary HTTP preview uses VM loopback plus SSH forwarding. Cloudflare/public HTTPS and automatic VM updates are maintained there; consult its status for actual activation.
- The sibling db repository owns Docker MariaDB and the canonical full-stack deployment; backend owns Flyway migrations. Read `../db/deploy/README.md` before deployment changes. Current document creation stages one file per request, then publishes JSON; preserve this flow to fit Cloudflare's 100 MB request ceiling. The gateway retains its 251 MiB limit for older clients. Proxy trust must remain restricted to the dedicated cloudflared IP; never accept visitor-IP headers from arbitrary callers.
- Verify with `npm run lint`, `npm run test`, and `npm run build`. Document browser verification separately.
- The Docker runtime label `io.bmepilots.api.requires="3"` requires staged uploads plus admin password reset and last-sign-in metadata. Maintain it with the backend's `io.bmepilots.api.contracts` label when changing cross-repository APIs; the VM updater uses these labels to prevent incompatible image pairs.
- Admin password resets use the selected user's ID and version, require confirmation, and never store the password in query/mutation caches or persistent browser storage. Preserve session revocation/self-reset routing and require reopening the form after a stale-version conflict. Last-sign-in values are UTC, shown explicitly in Europe/Budapest; a missing value means no recorded sign-in, not proof the member has never signed in.
