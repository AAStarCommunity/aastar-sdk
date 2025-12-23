# AAStar SDK Usage Demo

This folder contains a comprehensive demonstration of the **AAStar SDK** modular architecture (v0.x - v1.0).

## 📁 Folder Structure
- `usage.ts`: The main demo script with detailed comments for each module.
- `DEVELOPER_GUIDE.md`: **[New]** Comprehensive "How-To" patterns for 72+ business scenarios (Bilingual).

## 🚀 How to Use
This demo assumes you are in a TypeScript environment with the AAStar SDK installed (or referenced via workspace).

### Prerequisites
- Node.js (v18+)
- `pnpm` (Workspace managed)

### Usage Patterns
The demo covers:
1. **Core Layer**: Using standard Clients and ABIs.
2. **Identity & Roles**: Verifying roles via Registry and SBTs.
3. **Smart Account Middleware**: Integrating SuperPaymaster for gasless transactions.
4. **Asset Management**: Handling xPNTs and MySBT tokens.
5. **Finance & Staking**: Managing collateral and paymaster deposits.

## 📝 Key Concepts
- **Modular Imports**: Each feature is isolated in its own package (e.g., `@aastar/registry`).
- **One-Stop Helpers**: High-level static methods for complex flows like Community Registration.
- **Viem Powered**: Built on top of the performant and type-safe Viem library.

---
*助力 Stage 2 结算与 Phase 1-3 顺利推进。*
