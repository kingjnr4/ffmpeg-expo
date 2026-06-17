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
npm run changeset
```

The Changeset should target `ffmpeg-expo`.

Maintainers can exempt a PR with the `no-changeset-required` label when the change is release-irrelevant.

## Stable npm Releases

Stable package releases are automatic after the generated `Version Packages` PR is merged.

The `.github/workflows/release.yml` workflow runs on pushes to `main`:

1. Validates the repository.
2. If pending Changesets exist, runs `changeset version` and creates or updates one `Version Packages` PR.
3. If no pending Changesets exist, checks whether the current `ffmpeg-expo` version is already on npm.
4. Publishes `packages/expo-ffmpeg` only when the version is absent from npm.
5. Creates the `v<version>` GitHub Release only after npm publication succeeds.

The workflow is safe to rerun. It checks npm, tag, and GitHub Release state before publishing or creating releases.

## npm Trusted Publishing Setup

Configure trusted publishing for the existing npm package `ffmpeg-expo`:

1. Open the npm package settings for `ffmpeg-expo`.
2. Add a trusted publisher for GitHub Actions.
3. Repository owner/name: `kingjnr4/ffmpeg-expo`.
4. Workflow filename: `release.yml`.
5. Environment name: leave empty unless you later add a GitHub Environment gate.
6. Save the trusted publisher.

No `NPM_TOKEN` is required for stable releases. The publish job uses GitHub Actions OIDC with `id-token: write` only in the npm publish job.

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

Maintainers can edit that changelog section in the `Version Packages` PR to add migration notes, compatibility warnings, or release introductions. The GitHub Release body is created from the committed changelog section after npm publish succeeds.

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
2. Fork pull request: CI and the Changeset check run without npm credentials, OIDC, write tokens, environment secrets, or signing credentials.
3. Documentation-only pull request: no Changeset is required unless packed package docs change user-visible package output.
4. Public package change with a Changeset: the PR passes the Changeset check and merges normally.
5. Public package change without a Changeset: the Changeset check fails until a Changeset is added or `no-changeset-required` is applied.
6. Private package change that does not affect public output: no Changeset is required.
7. Private or auxiliary change that affects public output: add a Changeset targeting `ffmpeg-expo`.
8. Application-only changes: no npm release is created.
9. Merging a normal pull request: does not publish a stable release.
10. Creation or update of the Version Packages PR: happens on `main` when pending Changesets exist.
11. Merging the Version Packages PR: publishes prepared package versions automatically if the npm version is unpublished.
12. Successful npm publication: creates the matching `v<version>` GitHub Release after npm succeeds.
13. Failed npm publication: no package GitHub Release is created.
14. Accidental workflow reruns: npm, tag, and release state are checked to avoid duplicate publishes or releases.
15. Adding another public package later: remove it from Changesets ignore rules if needed and use safe non-conflicting tags such as `package-name@version` for multiple public packages.
16. Adding another private package later: keep it private and ignored unless it contributes to `ffmpeg-expo` output.
17. Transitioning from one package to multiple packages: switch from `v<version>` tags to package-qualified tags before publishing the second public package.
18. Transitioning from multiple public packages to one assembled public package: keep internal packages private and target Changesets only at the assembled public package.
