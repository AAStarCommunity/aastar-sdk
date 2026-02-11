# Installation

The AAStar SDK is built with TypeScript and can be used in any Node.js or browser environment. We recommend using `pnpm` for package management.

## Install the Main Package

The `@aastar/sdk` package provides the easiest entry point by grouping all core functionalities.

```bash
pnpm add @aastar/sdk viem@2.x
pnpm add @aastar/sdk viem@2.x
```

### 🛡️ Integrity Verification

> [!IMPORTANT]
> **Security Check**: Before using the SDK, verify that the downloaded source code matches the official release hash.

Run the following command in your project root (verifies code, excludes .md):
```bash
git ls-files -z | grep -zvE '\.md$' | xargs -0 sha256sum | sha256sum
```
**Expected Hash for v0.16.22**: `89da8c80ebe6ad8b06adbd4946a00817b18ae79296550709b20bd9ca3af424f9`

---

## Modular Installation (Optional)

If you only need specific functionalities, you can install individual packages to keep your bundle size small:

```bash
# Core utilities and types
pnpm add @aastar/core

# Account Abstraction and 7702 support
pnpm add @aastar/account

# Paymaster and sponsorship logic
pnpm add @aastar/paymaster

# Finance and GToken utilities
pnpm add @aastar/finance
```

## Prerequisites

- **Node.js**: v18 or higher.
- **TypeScript**: v5.0 or higher (recommended for type safety).
- **Viem**: v2.43 or higher.

## Next Steps

- Choose your role and create a [Client](./quick-start).
- Explore the [Core Concepts](../concepts/account-abstraction).
