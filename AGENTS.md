# Repository Guidelines

## Project Structure & Module Organization

This is a pnpm TypeScript monorepo. Workspace packages live under `packages/*`, with implementation in `src/` and tests in `__tests__/` or `*.test.ts`. Key packages include `core`, `sdk`, `airaccount`, `paymaster`, `cli`, `channel`, `x402`, and role clients such as `community`, `operator`, `admin`, `enduser`, and `dapp`.

Root-level `tests/` contains regression and scenario tests excluded from default Vitest unit runs. `examples/` contains demos, `scripts/` contains operational utilities, `docs/` contains generated and hand-written documentation, and `config/networks/*.env.example` holds network templates. Data snapshots and reports live in `data/` and `packages/analytics/reports/`.

## Build, Test, and Development Commands

- `pnpm install --frozen-lockfile`: install exact dependencies.
- `pnpm build`: run each package build via `pnpm -r build`.
- `pnpm test`: run package tests with Vitest.
- `pnpm test:coverage`: run root Vitest coverage for `packages/*/src/**/*.ts`.
- `pnpm lint`: run package lint scripts where available.
- `pnpm docs:generate`: regenerate TypeDoc Markdown output.
- `pnpm test:full_sdk` or `pnpm test:full_anvil`: run broader SDK regression flows.
- `pnpm --filter @aastar/sdk run example:local`: run the local SDK example.

Use `tsx` or `ts-node` for one-off scripts, following existing `scripts/*.ts` patterns.

## Coding Style & Naming Conventions

Use TypeScript ES modules with strict type checking. Follow the existing style: two-space indentation, semicolons, single quotes, and named exports. Classes use `PascalCase`, functions and variables use `camelCase`, constants use `UPPER_SNAKE_CASE`, and tests use `*.test.ts`.

ESLint uses `@typescript-eslint/recommended`. Prefix intentionally unused variables with `_`; `any` is currently permitted. Do not hardcode ABIs with `parseAbi` from `viem`; import ABIs from `@aastar/core/abis`.

## Testing Guidelines

Vitest is the default unit test framework. Root config includes `**/*.test.ts` and excludes `tests/**`, `dist/**`, and `ext/**`, so place unit tests beside packages. Use `pnpm --filter <package-name> test` for focused checks and root regression scripts for network or protocol flows.

For network tests, copy `config/networks/sepolia.env.example` to `.env.sepolia` and add local secrets there.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, and `chore: ...`. Keep commits focused and mention affected packages or workflows in the scope, for example `fix(airaccount): validate guardian signatures`.

Pull requests should include a concise description, linked issue or milestone, commands run, and notes about network or contract-address changes. Include screenshots only for UI changes.

## Security & Configuration

Never commit private keys, RPC keys, or `.env.*` files. Keep mainnet and testnet keys separate, prefer hardware or managed signing for mainnet operations, and update example env files instead of sharing local secrets.
