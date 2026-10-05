# Frontend verification

Updated: 2026-10-05. These are coverage and verification instructions; consult `STATUS.md` for checks actually executed.

Run `npm ci`, `npm run test`, `npm run lint`, `npm run build`, and `npm run format:check` from this repository. Tests use Vitest with mocked transport boundaries; component tests use a DOM test environment. They do not require browser control or Gmail credentials.

## Automated coverage

- Session-bound CSRF headers on mutations.
- Fresh CSRF acquisition after an expired session.
- Structured HTTP errors preserved for the UI.
- Empty 204 responses.
- Network failures translated into actionable English feedback.
- Six rendered real-App/route-guard tests under React StrictMode cover successful login, existing-session redirect, failed-login feedback, delayed stale session lookup cancellation, secondary CSRF-refresh independence and expiry/repeat-sign-in/logout behavior with private-cache handling.
- Multipart file validation and document contribution/comment component interactions: one request per file followed by JSON publication, retry reuse, cancellation cleanup and safe handling of an ambiguous publication response.
- Calendar civil-date calculations, exclusive all-day ranges and calendar editor interactions.
- Successful-open mail read marking, manual unread, important flag preservation and failure behavior.

Consult `src/features/**/*.test.ts(x)` and `src/shared/api/client.test.ts` for exact assertions. Component tests provide reproducible interaction checks but are not a rendered desktop/mobile browser pass. Backend permission, file-storage and calendar validation tests run in the sibling backend against a separate real MariaDB.

TypeScript checks all feature DTO usage, route components and mutation handlers. ESLint checks hooks and unused values. Build produces split route bundles under ignored dist/. Build success is not a substitute for a browser check.

## Manual checklist for a future authorized browser session

1. Login at http://127.0.0.1:5173 using the backend's local bootstrap file; never put the password in screenshots/logs. Check successful sign-in redirects to the dashboard, an already authenticated `/login` visit redirects, and wrong credentials leave a visible English error. Use the same host consistently.
2. Check all UI labels and error messages are English.
3. Open each member route; confirm real empty states and no console errors.
4. As a member, upload a document post with up to five harmless fixture files, verify author names, edit its description, download a file and add/edit a comment. Check that another member can comment but cannot edit the original post; verify admin moderation separately. Check oversized/six-file feedback and migrated text-only posts if present. On a disposable environment, interrupt a later file transfer, retry and confirm previously completed files are not uploaded again. Cancel after a failure and verify staged cleanup; a lost publication response must never trigger an automatic second copy. Through Cloudflare, check a post containing several 50 MiB files and confirm every individual request remains below 100 MB.
5. On a disposable environment, open registration, register a member, approve it, verify member admin denial and session revocation after suspension.
6. Check keyboard navigation, native modal focus, skip link, screen reader labels and narrow/mobile layouts.
7. Search/open an imported mail and confirm unread styling/count update after successful loading. Mark unread while it remains open, then reopen it and check read marking resumes. Toggle important without changing read state and download a harmless fixture attachment. The local backend Gmail connection and initial import are verified; these browser interactions remain pending. Keep real message content out of screenshots and logs.
8. Add a calendar exam, event and homework deadline; check month/agenda navigation, date/type filters, a multi-day all-day range, an event spanning a month boundary and owner/admin editing. Confirm Europe/Budapest times remain unchanged under a different computer timezone.
9. Add a useful link as a member and verify attribution and owner/admin controls. In Admin, manage a link category and an announcement; confirm member pages and dashboard refresh. Review separate named activity and API request views without logging fixture passwords or content bodies.
10. Sign out; verify private cached content disappears and private URLs redirect to login. Repeat sign-in without reloading to check the observed session query survives the transition.

## Current limitation

An attempted in-app browser visit was denied by the browser permission policy in this session. No alternate browser or indirect automation was used to bypass it. Desktop/mobile screenshots, DOM interaction and visual QA are therefore unverified; do not report them as passing. See STATUS for actual automated results.
