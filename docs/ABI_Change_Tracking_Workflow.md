# ABI Change Tracking Workflow

This guide explains how to use the automated ABI coverage audit tool to maintain alignment between smart contract ABIs and the AAStar SDK.
pnpm exec vitest run --coverage packages/core/src/actions/*.test.ts

## Overview

The `audit:abi` tool detects changes in ABI files and verifies that all critical contract functions are implemented in the SDK Action modules. It uses MD5 hashes to track changes efficiently.

## Running the Audit

To run the audit manually:

```bash
pnpm run audit:abi
```

The tool will output:
- **⚡ CHANGED**: ABI has changed since the last audit.
- **✅ UNCHANGED**: ABI is consistent with the last baseline.
- **Coverage %**: Percentage of ABI functions matched in the SDK.
- **Missing Functions**: A list of ABI functions not yet implemented or mapped.

## Workflow for ABI Changes

When a contract is updated and new ABIs are generated:

1.  **Update ABIs**: Copy the new JSON files into `packages/core/src/abis/`.
2.  **Run Audit**: Execute `pnpm run audit:abi`.
3.  **Analyze Report**:
    -   If a function name changed: Update the corresponding action in `src/actions/`.
    -   If a new critical function was added: Implement it in the action module.
    -   If a function was removed: Remove the dead code from the action module.
4.  **Update Tests**: Review and adjust tests in `src/actions/*.test.ts` to reflect the changes.
5.  **Re-baseline**: Running the audit script again will update the `.abi-hashes.json` baseline.

## Implementation Details

- **Mapping**: The tool maps `ContractName.json` to `contractName.ts` (camelCase).
- **Matching**: It uses case-insensitive matching for function names to accommodate semantic naming in the SDK.
- **Cache**: Pre-calculated hashes are stored in `src/abis/.abi-hashes.json`.
