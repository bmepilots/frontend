# Frontend agent guide

All visible application text, validation feedback, accessibility labels and empty states must be English. Conversation with the user may be Hungarian. Keep documentation in English.

Read `README.md`, `docs/ARCHITECTURE.md`, and `docs/STATUS.md` before edits. Update these documents whenever behavior, setup, contracts or limitations change. Always update STATUS with actual verification evidence.

- React + TypeScript + Vite; organize business code under `src/features`, composition under `src/app`, shared primitives under `src/shared`.
- The backend at `../backend` owns authorization and business rules. Its API is `/api/v1`; Vite proxies `/api` to loopback port 8080.
- Use cookie sessions with credentials and CSRF headers. Never store authentication credentials in localStorage.
- Build an accessible, responsive English community portal for BME Professional Pilot 2026. Clearly label it unofficial. Planned domain bmepilots2026.com is informational only.
- Show real loading, empty and error states. Never substitute mock mail or fake success for disconnected services.
- The admin area is part of this app. Reuse feature editors rather than duplicating business functionality.
- Never render unsanitized email or Markdown HTML. Email uses the backend-sanitized document inside a restricted iframe.
- Keep secrets out of VITE\_\* variables. No deploy or Cloudflare setup in this phase.
- The sibling db repository owns Docker MariaDB; backend owns Flyway migrations.
- Verify with `npm run lint`, `npm run test`, and `npm run build`. Document browser verification separately.
