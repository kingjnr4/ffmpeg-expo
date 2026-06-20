# Releasing

This repository uses `main` as the only permanent development branch. Normal work should happen on short-lived branches and merge through pull requests.

## Package Model

- Public npm package: `ffmpeg-expo` in `packages/expo-ffmpeg`
- Private example app: `example`
- Auxiliary FFmpeg binary builders: `packages/ffmpeg-build`

Only `ffmpeg-expo` is published to npm. The example app and binary builder scripts are never published as npm packages.

## Changesets

Add a Changeset for changes that affect published package behaviour:

- JavaScript API or exported types
- Expo config plugin behaviour
- Android or iOS native source included in the package
- `postinstall` behaviour
- package metadata, package output, or runtime assets
- FFmpeg binary builder changes that alter binaries consumed by `ffmpeg-expo`

You usually do not need a Changeset for:

- root CI-only maintenance
- tests with no shipped behaviour change
- documentation outside the packed package
- example-app-only changes
- private tooling changes that do not affect package output

Create a Changeset locally with:

```bash
pnpm run changesets:add
```

The Changeset should target `ffmpeg-expo`.

Maintainers can exempt a PR with the `no-changeset-required` label when the change is release-irrelevant.

## Stable npm Releases

Stable package releases are automatic after the generated `Version Packages` PR is merged.

The `.github/workflows/release.yml` workflow runs on pushes to `main`:

1. Validates the repository.
2. If pending Changesets exist, `changesets/action` runs `pnpm run changesets:version` and creates or updates one `Version Packages` PR.
3. If no pending Changesets exist, `changesets/action` runs the publish command.
4. The publish command validates the package contents and publishes unpublished package versions to npm.
5. `changesets/action` creates the corresponding GitHub releases after publication.

The workflow is safe to rerun because `changeset publish` publishes only package versions that are not already present on npm.

## npm Trusted Publishing Setup

Configure trusted publishing for the existing npm package `ffmpeg-expo`:

1. Open the npm package settings for `ffmpeg-expo`.
2. Add a trusted publisher for GitHub Actions.
3. Repository owner/name: `kingjnr4/ffmpeg-expo`.
4. Workflow filename: `release.yml`.
5. Environment name: leave empty unless you later add a GitHub Environment gate.
6. Save the trusted publisher.

No `NPM_TOKEN` is required for stable releases. The publish job uses GitHub Actions OIDC with `id-token: write` only in the npm publish job.

## Changesets Bot Token Setup

The `Version Packages` PR is created and updated with `REPOBOT_TOKEN` so its workflow runs are treated as trusted repository automation instead of default `GITHUB_TOKEN` automation.

Create a bot account and a fine-grained personal access token for `kingjnr4/ffmpeg-expo` with these repository permissions:

- Contents: read and write
- Pull requests: read and write

Add the token as this repository secret:

- `REPOBOT_TOKEN`

The workflow exposes `REPOBOT_TOKEN` to `changesets/action` as `GITHUB_TOKEN`. Do not store a secret named `GITHUB_TOKEN`; GitHub provides that name automatically for the default Actions token.

## Preview Package Releases

This repository uses `pkg.pr.new` to publish temporary package previews for pull requests without publishing to npm.

Install the `pkg.pr.new` GitHub App on `kingjnr4/ffmpeg-expo`. Normal same-repository pull requests publish previews automatically. Fork pull requests publish previews only after a maintainer approves the PR.

Preview workflows intentionally avoid repository secrets and dependency caches. They run with read-only repository permissions and execute untrusted fork code only from the `pull_request_review` approval flow.

The generated `Version Packages` PR is intentionally excluded from preview publishing because normal feature and fix PRs are the useful test surface.

## FFmpeg Binary Releases

FFmpeg binaries are decoupled from npm package releases.

Use `.github/workflows/ffmpeg-binaries.yml` manually when you intentionally need new binary assets, for example when adopting a new FFmpeg version or rebuilding with changed codec flags.

Recommended binary tag format:

```text
ffmpeg-<ffmpeg-version>-r<n>
```

Example:

```text
ffmpeg-6.1.1-r1
```

The binary workflow:

- builds Android binaries on Ubuntu
- builds iOS binaries on macOS
- uploads `ffmpeg-android.tar.gz`, `ffmpeg-ios.zip`, and `checksums.txt`
- creates or updates the specified GitHub Release
- does not publish npm

To make `ffmpeg-expo` consume a new binary release, update `packages/expo-ffmpeg/package.json`:

```json
"ffmpegExpo": {
  "binaryReleaseTag": "ffmpeg-6.1.1-r1"
}
```

That package change should include a Changeset if it affects users.

## Release Notes

Changesets writes package release notes to `packages/expo-ffmpeg/CHANGELOG.md` in the `Version Packages` PR.

Maintainers can edit that changelog section in the `Version Packages` PR to add migration notes, compatibility warnings, or release introductions. GitHub releases are created by `changesets/action` after npm publication succeeds.

## Branch Protection Recommendations

Require these checks before merging to `main`:

- `CI / Lint & Typecheck`
- `CI / Example App Typecheck`
- `CI / Android Build Check`
- `CI / iOS Podspec Check`
- `CI / Expo Plugin Check`
- `Pull Request Checks / Changeset check`

Also enable:

- Require pull requests before merging.
- Require branches to be up to date before merging if practical.
- Restrict direct pushes to `main`.
- Do not require or use permanent `dev`, `develop`, `release`, `next`, `beta`, or `canary` branches.

The existing `dev` branch can be deleted after this release system is merged and confirmed:

```bash
git push origin --delete dev
git switch main
git branch -d dev
```

## Event Behaviour

1. Normal internal pull request: CI and the Changeset check run with read-only permissions.
2. Fork pull request: CI and the Changeset check run without npm credentials, OIDC, write tokens, environment secrets, signing credentials, or dependency caches.
3. Documentation-only pull request: no Changeset is required unless packed package docs change user-visible package output.
4. Public package change with a Changeset: the PR passes the Changeset check and merges normally.
5. Public package change without a Changeset: the Changeset check fails until a Changeset is added or `no-changeset-required` is applied.
6. Private package change that does not affect public output: no Changeset is required.
7. Private or auxiliary change that affects public output: add a Changeset targeting `ffmpeg-expo`.
8. Application-only changes: no npm release is created.
9. Merging a normal pull request: does not publish a stable release.
10. Creation or update of the Version Packages PR: happens on `main` when pending Changesets exist.
11. Merging the Version Packages PR: publishes prepared package versions automatically if the npm version is unpublished.
12. Successful npm publication: `changesets/action` creates the package GitHub release after npm succeeds.
13. Failed npm publication: no package GitHub Release is created.
14. Accidental workflow reruns: `changeset publish` skips already-published versions.
15. Adding another public package later: remove it from Changesets ignore rules if needed and use safe non-conflicting tags such as `package-name@version` for multiple public packages.
16. Adding another private package later: keep it private and ignored unless it contributes to `ffmpeg-expo` output.
17. Transitioning from one package to multiple packages: keep using Changesets package releases; package-qualified release tags avoid conflicts.
18. Transitioning from multiple public packages to one assembled public package: keep internal packages private and target Changesets only at the assembled public package.
