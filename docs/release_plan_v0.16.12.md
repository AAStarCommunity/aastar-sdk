# Release Plan v0.16.12: NPM Publishing Fixes

## 1. Overview
This plan addresses the issues encountered during the v0.16.11 release, specifically the accidental publishing of the root repository files and the inclusion of unnecessary development files (tests, `node_modules`) in certain packages.

## 2. Package Structure & Strategy

We follow a **Monorepo** structure where:
1.  **Root (`@aastar/monorepo`)**: The development workspace. **PRIVATE**. Never published.
2.  **Umbrella (`@aastar/sdk`)**: The main entry point for users. Installs all other packages as dependencies.
3.  **Modules (`@aastar/core`, etc.)**: Individual functional units. Can be installed separately if needed.

### Why this strategy?
-   **Developer Experience**: Users only need to install `@aastar/sdk` to get everything.
-   **Modularity**: Advanced users can pick and choose (e.g., only `@aastar/paymaster`).
-   **Efficiency**: Shared logic (like `@aastar/core`) is reused without duplication.

## 3. Current Issues & Proposed Fixes

| Package | Status | Issue | Proposed Fix |
| :--- | :--- | :--- | :--- |
| **ROOT** | ❌ **CRITICAL** | Named `@aastar/sdk`, `private: false`. Publishes entire repo! | Rename to `@aastar/monorepo`, set `private: true`. |
| `@aastar/sdk` | ✅ OK | Correctly configured as public umbrella. | No change (ensure `files: ["dist"]`). |
| `@aastar/core` | ✅ OK | Correctly whitelist `dist`. | No change. |
| `@aastar/tokens` | ✅ OK | Correctly whitelist `dist`. | Fix `tsconfig` to prevent deep nesting (optional polish). |
| `@aastar/community` | ❌ Bloated | Missing `files` whitelist. Publishes src/tests. | Add `"files": ["dist"]`. |
| `@aastar/operator` | ❌ Bloated | Missing `files` whitelist. | Add `"files": ["dist"]`. |
| `@aastar/analytics` | ❌ Bloated | Missing `files` whitelist. | Add `"files": ["dist"]`. |
| `@aastar/enduser` | ❌ Bloated | Missing `files` whitelist. | Add `"files": ["dist"]`. |
| `@aastar/paymaster` | ✅ OK | Correctly whitelist `dist`. | No change. |
| `@aastar/account` | ✅ OK | Correctly whitelist `dist`. | No change. |
| `@aastar/dapp` | ✅ OK | Correctly whitelist `dist`. | No change. |
| `@aastar/identity` | ✅ OK | Correctly whitelist `dist`. | No change. |

## 4. Execution Plan

1.  **Root Fix**: Rename `package.json` -> `@aastar/monorepo`, `private: true`.
2.  **Cleanup**: Add `"files": ["dist"]` to `community`, `operator`, `analytics`, `enduser` package.jsons.
3.  **Version Bump**: Update all packages to `0.16.12` using `update-version.sh`.
4.  **Verify**: Dry-run publish or inspect tarball content.
5.  **Publish**: execute `pnpm publish -r --no-git-checks --access public`.

## 5. Benefits
-   **Fixes "Root Publish"**: Prevents the root folder (with all scripts and config) from overwriting `@aastar/sdk` on NPM.
-   **Small Install Size**: Users only download compiled JS/DTS files, not your tests or source code.
-   **Professional**: Clean packages without `node_modules` or `.test.ts` garbage.

## 6. User Action
Please review and confirm this plan. Upon approval, I will apply the fixes and perform the formatting.
