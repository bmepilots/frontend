# Exam prep frontend

Updated: 2026-10-14. Route `/study`, navigation **Exam prep**, backend API contract **5**.

## User flow

Exam prep opens with clickable subject cards. Choose **Basics of (Mechanical) Engineering → First midterm → a topic** to enter the study room. Each selection screen uses full-card links, counts of available material and breadcrumb navigation. Only the real first midterm is offered. Topic cards are derived from the exercise bank; **Full midterm review** opens all topics together.

The study room has Learn, Practice and Mock exam sections. Learn presents the concept cards relevant to the selected topic; Theory and Full midterm review show all eight. Practice shows only the selected topic's exercises, or all 38 original exercises in Full midterm review (26 calculation/equation exercises and 12 theory questions). Mock exam always covers the complete first midterm, explicitly stated on its start screen, selecting three theory questions and one each on resistance, equations and superposition without replacement. It shows no hints or answer feedback until final submission. The reported exam structure is labelled as reported, not an official university specification; AC calculations are additional practice. Saved results remain accessible across topics.

Circuit questions share an interactive SVG with keyboard-selectable components, a connection list and explicit source polarity/current arrows. The question fixes resistor current references, including intentionally reversed directions. The source selector in superposition shows all sources or one active source, replacing inactive ideal voltage sources with shorts and current sources with opens. It illustrates the reduced topology without revealing the numerical solution. Circuit coordinates and electrical connections originate from the same backend catalog.

Each answer field has an accessible label. Numeric answers accept SI values and supported prefixed units; equations require explicit operators and the exact variable names shown. These rules and the 0.5%/absolute tolerance are explained alongside input. Blank answers earn zero points. The backend gives per-field correctness, partial credit and worked steps. Score weighting is one point per field for practice; it is not an official grading scheme.

The history section shows the latest 20 saved attempts with Budapest time. Opening a result uses its saved question/diagram snapshot, not today's catalog. Study history is private to the authenticated member. No leaderboard is shown.

## Implementation map

- `src/features/study/StudyPage.tsx`: subject loading, URL-driven selection hierarchy, learning cards, topic filtering, session state, six-question navigation, submit/retry, result review and history.
- `StudySelection.tsx`: reusable subject/midterm/topic card screen and accessible breadcrumbs.
- `curriculum.ts`: explicit first-midterm mapping, topic descriptions, lesson selection and canonical link construction.
- `CircuitDiagram.tsx`: data-driven vector circuit, component inspection, keyboard actions, source deactivation and text connections.
- `types.ts`: public API types and topic-balanced mock sampling.
- `study.css`: scoped responsive study-room styles; existing portal layout and shared buttons remain in use.
- `StudyPage.test.tsx`: selection hierarchy, browser-back and breadcrumb navigation, direct links, invalid-link recovery, topic/lesson filtering, submit-before-feedback, error/retry payload preservation, full-midterm exam blueprint from a topic and accessible circuit source controls.
- `src/app/App.tsx` lazily loads the protected route; `Layout.tsx` provides the navigation entry.

TanStack Query keys begin with `study`. Existing auth lifecycle clears private cached data. Requests use the shared same-origin cookie/CSRF client. No tokens, answers or solution banks enter localStorage. The subject/midterm/topic selection lives in URL query parameters and supports direct links, reload and browser back/forward. Draft answers, selected workspace tab and in-progress sessions live in React memory only; reloading or leaving a topic discards an unsubmitted session. Submitted attempts survive restarts through MariaDB.

Canonical navigation URLs are `/study`, `/study?subject=basics-of-engineering`, `/study?subject=basics-of-engineering&midterm=1`, and `/study?subject=basics-of-engineering&midterm=1&topic=Resistance`. Topic names are URL-encoded by `URLSearchParams`; `topic=all` means Full midterm review. Unknown subjects, unavailable midterms, unknown topics or child selections without parents show a recovery link, rather than opening unrelated material. An empty catalog shows an explicit empty state.

## Submission and failure behavior

Starting an exercise/exam clears previous local answers. Selecting another question in a mock exam preserves them. There is a single final POST for the complete exam, not one grading call per page. While submitting, fields and duplicate submission are disabled. The request carries a UUID, subject ID and catalog version. The server validates the exam composition and owns all scoring.

After an ambiguous network failure, fields remain locked and **Retry submission** sends exactly the same object/UUID. The backend returns the original saved result if it already committed, without recording another attempt. **Return to exercises** discards local answers but cannot delete a successfully committed server attempt; the UI explains that it may be visible in history. There are no automatic mutation retries. A stale catalog version produces an English 409 explanation requesting a page reload.

Loading, empty history and API errors are explicit. Results are announced through a live region and use textual Correct/Needs another look labels as well as colour. Native inputs/buttons, keyboard component inspection, visible focus, a textual netlist, responsive single-column layouts and a horizontally scrollable diagram preserve access on smaller screens. The SVG retains a minimum width for legible labels; only its local wrapper scrolls.

## Content authoring and architecture

The browser has no private answer key and never evaluates expressions. The backend-generated public catalog supplies all English text, fields and circuit parts. A stored result contains expected answers only after submission. New catalog fields must update these TS interfaces with backend DTOs and tests. Do not silently introduce client-side grading or send input to external AI services.

See sibling backend [`docs/STUDY.md`](../../backend/docs/STUDY.md) for the complete analysis of both PowerPoint decks and all six images, source ambiguities, numerical generation, parser limitations, schema/API contracts and extension checklist. Contract 5 serves one subject with one midterm bank. `midtermsFor` explicitly maps that bank to First midterm; it deliberately does not duplicate it under imaginary later midterms. Adding another subject or midterm requires backend catalog/progress scoping and corresponding DTOs before adding navigation metadata. Preserve historical result snapshots and version checks when extending this contract. Add topic descriptions and lesson-title mappings in `curriculum.ts` when introducing or renaming topics/lessons; the current mapping must match the backend's English lesson titles.

Detailed provenance is documented without publishing the original attachments. The supplied course material determines coverage and difficulty, while the 38 exercises are newly authored. The supplemental Learn link points to MIT OCW on superposition and terminal equivalents.

## Verification and deployment

Run `npm run test`, `npm run lint`, `npm run build` and `npm run format:check`. The frontend tests use controlled transport responses; full-stack testing must also run against isolated Docker MariaDB3308 with Gmail disabled. Browser review must cover desktop/mobile, a negative numeric answer, equation feedback, source switching, complete mock submission and reopening private history. Actual results belong in STATUS, not inferred from test filenames.

The frontend Docker label requires contract `5`, coordinated with the backend's supported list. No Cloudflare, Caddy, Gmail, SQL credential, mount or database-engine change is needed. The existing guarded updater should only select compatible published images. Local completion is not proof of publication or deployment.
