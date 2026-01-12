# SDK & Contract Repository Configuration Sync

This document outlines the synchronization mechanism between the `SuperPaymaster` (Contracts) repository and the `aastar-sdk`.

## Overview

The SDK relies on two artifacts from the contract repository:
1.  **ABIs**: JSON files defining the contract interfaces.
2.  **Configuration**: JSON files defining deployed contract addresses and source code verification hashes.

## Sync Workflow

The synchronization is automated via the `run_sdk_complete_regression.sh` script (and standalone `sync_to_sdk.sh` in SuperPaymaster).

### 1. Artifact Generation (SuperPaymaster Side)
*   **ABIs**: `forge build` generates artifacts. `extract_v3_abis.sh` extracts verified ABIs to `abis/*.json`.
*   **Config**: Deployment scripts (e.g., `DeployAnvil.s.sol`) generate `deployments/config.{network}.json`. This file includes:
    *   Contract Addresses (Registry, SuperPaymaster, etc.)
    *   `srcHash`: SHA-256 hash of the `contracts/src` directory for integrity checks.

### 2. Synchronization Bridge
Artifacts are copied to the SDK:
*   `abis/*.json` -> `packages/core/src/abis/`
*   `deployments/config.{network}.json` -> `config.{network}.json` (SDK Root)

### 3. SDK Abstraction Layer (`constants.ts`)
The SDK avoids hardcoding addresses or reading JSON files directly in business logic.
*   **File**: `packages/core/src/constants.ts`
*   **Mechanism**:
    *   Reads `process.env.NETWORK` (default: 'anvil').
    *   Dynamically loads `config.{network}.json`.
    *   Exports constants like `REGISTRY_ADDRESS`, `SUPER_PAYMASTER_ADDRESS`.
*   **Legacy Support**: `contract-addresses.ts` has been refactored to consume `constants.ts`, ensuring backward compatibility.

## Verification (`verify_onchain_milestone.ts`)

A verification script (`scripts/verify_onchain_milestone.ts`) ensures the SDK is in sync with the chain:
1.  Loads `config.{network}.json` via `constants.ts`.
2.  Verifies `srcHash` existence.
3.  Checks on-chain code presence for all critical contracts using `viem`.

## Usage

To run the full regression with sync and verification:
```bash
./run_sdk_complete_regression.sh --env anvil
```
