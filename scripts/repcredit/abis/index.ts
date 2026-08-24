/**
 * RepCredit experiment ABI fixtures — runner-internal, NOT a published surface.
 *
 * These two contracts are local test mocks used only by `scripts/repcredit-e2e.ts`:
 *   - MockAgentIdentityRegistry (SuperPaymaster) — ERC-8004 agent-identity stand-in
 *   - RepCreditCounter (airaccount-contract)     — trivial UserOperation application target
 *
 * They deliberately do NOT live in `packages/core/src/abis`, because anything there is exported
 * from `@aastar/core`, bundled into `@aastar/sdk/dist`, and published to npm (CC-50 H2) — and is
 * drift-checked against production upstream tags as if it were a real interface (CC-50 B1).
 *
 * The JSON files are GENERATED from the sibling foundry artifacts and pinned by sha256; see
 * `scripts/repcredit/sync-fixture-abis.ts` and `abis/provenance.json`.
 */
import type { Abi } from 'viem';

import MockAgentIdentityRegistryFixture from './MockAgentIdentityRegistry.json' with { type: 'json' };
import RepCreditCounterFixture from './RepCreditCounter.json' with { type: 'json' };

export const MockAgentIdentityRegistryABI = MockAgentIdentityRegistryFixture.abi as unknown as Abi;
export const RepCreditCounterABI = RepCreditCounterFixture.abi as unknown as Abi;
