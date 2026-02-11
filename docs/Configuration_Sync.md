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

### 4. Canonical Address Solidification (V0.16.16+)
To support NPM distribution where root JSON files are unavailable, the SDK now includes a built-in address registry.
*   **File**: `packages/core/src/addresses.ts`
*   **Mechanism**:
    *   Hardcoded defaults for Sepolia (Chain ID 11155111) and OP Sepolia (Chain ID 11155420).
    *   `constants.ts` use these as a third-level fallback after ENV and Local JSON.
*   **Benefit**: Users installing via `@aastar/sdk` get a "plug-and-play" experience on supported networks.

## SDK Release Integrity Lifecycle
To ensure verifiable releases, the SDK uses an automated SHA-256 integrity hash system.

### 1. Generation (`update-version.sh`)
When upgrading the version, the script automatically:
*   Calculates a stable hash of all source files (excluding `.md`).
*   Synchronizes this hash into `README.md`, `CHANGELOG.md`, and this document.
*   The hash is also included in the Git Tag metadata.

### 2. Guarding (`publish.sh`)
Before publishing to NPM, the script:
*   Re-calculates the actual code hash.
*   Compares it with the "Official" hash recorded in `README.md`.
*   Blocks the release if any code was modified after the last version update.

**Current Code Integrity Hash (v0.16.21)**: `8d5b71dda17e2cb746e4a70a98020b9c7a4f2b390a82804f7e5924b0bf5a51d5`
*(Excludes metadata/markdown to ensure stability)*

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
