import { describe, it, expect } from 'vitest';
import { decodeAbiParameters } from 'viem';
import { encodeCommunityRoleData } from './registry.js';

// Mirror of Registry.sol CommunityRoleData (what the contract decodes roleData into).
const PARAMS = [{
  type: 'tuple',
  components: [
    { name: 'name', type: 'string' },
    { name: 'ensName', type: 'string' },
    { name: 'website', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'logoURI', type: 'string' },
    { name: 'stakeAmount', type: 'uint256' },
  ],
}] as const;

describe('encodeCommunityRoleData (#169 — roleData must not be 0x)', () => {
  it('produces non-empty bytes the Registry can decode (vs the bare-revert 0x)', () => {
    const bytes = encodeCommunityRoleData({ name: 'MyDAO', logoURI: 'ipfs://x', stakeAmount: 30_000000000000000000n });
    expect(bytes).not.toBe('0x');
    expect(bytes.length).toBeGreaterThan(2);
    const d = decodeAbiParameters(PARAMS, bytes)[0] as any;
    expect(d.name).toBe('MyDAO');
    expect(d.logoURI).toBe('ipfs://x');
    expect(d.stakeAmount).toBe(30_000000000000000000n);
  });

  it('defaults the optional string fields to empty (not undefined → still decodable)', () => {
    const bytes = encodeCommunityRoleData({ name: 'Bare', stakeAmount: 1n });
    const d = decodeAbiParameters(PARAMS, bytes)[0] as any;
    expect([d.ensName, d.website, d.description, d.logoURI]).toEqual(['', '', '', '']);
    expect(d.name).toBe('Bare');
  });
});
