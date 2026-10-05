# Frontend continuous integration and container publication

Updated: 2026-10-05.

## Workflow and checks

`.github/workflows/ci.yml` runs on every pull request and push to `main`, using GitHub-hosted Ubuntu 24.04 runners. Actions are pinned to full upstream commits, with release comments. No runner, VM SSH key or application credential is needed.

The `verify` job installs Node 24.15.0, matching the Dockerfile build stage, caches npm downloads and executes:

```bash
npm ci
npm run test
npm run lint
npm run format:check
npm run build
```

The production build includes strict TypeScript checking. Tests use isolated fixtures and do not contact the VM, database or Gmail. On pull requests, verification also builds the Dockerfile for `linux/amd64` without publishing it. On `main`, a separate `publish` job depends on successful verification and builds the verified commit. A failed check prevents publication. Both jobs have 30-minute timeouts.

New commits cancel older runs on the same pull request. `main` runs are serialized so a slower earlier run cannot move the branch image tag backwards after a later publication. GitHub can replace an older pending run with the most recent pending run.

## GHCR identity and permissions

Only the publication job has `packages: write`. It uses the automatically issued, short-lived `GITHUB_TOKEN` to push these tags:

```text
ghcr.io/bmepilots/frontend:<full-40-character-source-commit>
ghcr.io/bmepilots/frontend:main
```

The namespace is derived from the lowercase repository identity, so forks use their own package names. OCI source/revision labels identify the repository and source commit. Checkouts do not persist their token in Git configuration. Pull requests never run the publication job or receive a registry login.

Enable GitHub Actions and allow package publishing under repository/organization policy. CI needs no manually configured PAT. If an existing package is not associated with this repository, grant repository Actions access in the package settings. Keep the package private for this private portal. A VM pulling private images needs a separate read-only package credential. See GitHub's [Publishing Docker images](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images) for the official token and registry setup.

## Deployment references and boundaries

The commit tag identifies source; `main` moves after a successful publication. All registry tags can be reassigned, including on a rerun, so exact deployment immutability comes from the digest. The workflow summary records `ghcr.io/bmepilots/frontend@sha256:...`. Use that digest in the deployment release manifest, paired with a compatible backend digest. Keep old registry versions required for rollback.

The image contains the built SPA and Caddy gateway. The workflow does not SSH to the VM, update Compose, configure DNS/Tunnel or publish a public website. VM rollout and rollback belong to the deployment tooling. Images have no environment-specific frontend secrets: browser traffic uses same-origin `/api`, with runtime routing controlled by Caddy. Never put passwords, tokens or Gmail settings in `VITE_*` values.

The runtime Docker image declares `io.bmepilots.api.requires="2"`: this frontend requires the staged document upload API. Compatible backend images declare `io.bmepilots.api.contracts` containing `2`. The VM updater must inspect these labels and defer an incompatible pair, including when the frontend workflow finishes before its backend counterpart. Update both contract labels with any cross-repository breaking API change; do not infer compatibility from independently moving `main` tags or successful healthchecks alone.

## Maintenance and verification

On 2026-10-05 both repository workflows passed actionlint 1.7.12, including ShellCheck validation. This workflow and this document also passed the repository's Prettier check. This local validation was followed by a successful GitHub verification/publication run on 2026-10-05; see STATUS.md for the run link.

- Upgrade Node in this workflow and the Dockerfile together; keep the npm lockfile committed and use `npm ci`.
- Update action pins from official release tags and keep version comments accurate. Current pins were resolved against the official GitHub repositories on 2026-10-05.
- BuildKit uses a GitHub Actions cache scoped to `frontend`; cached build layers are not deployment artifacts.
- Formatting verification includes workflow YAML and documentation, so format these files with the repository's Prettier configuration.
- Local workflow linting does not prove a hosted CI run, registry push or browser deployment succeeded. Record actual run URLs and image digests in `STATUS.md` after those operations occur.
