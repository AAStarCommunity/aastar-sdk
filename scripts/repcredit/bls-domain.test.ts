/**
 * Pins the BLS consensus preimages against INDEPENDENTLY-derived vectors.
 *
 * The runner already cross-checks these against the deployed contract at startup
 * (`resolveBlsDomain`), but that check only runs when a chain is up. This file makes a silent edit
 * to `bls-domain.ts` a unit-test failure, and — more importantly — proves the new schema is not
 * merely a rename of the old one: the pre-domain preimage and the domain-separated one must differ
 * for the SAME inputs, and each path tag must produce a DIFFERENT hash from every other.
 *
 * Nothing here recomputes a value with the same expression the implementation uses. The tag
 * constants are re-derived from their literal strings, and the encodings are re-derived from the
 * Solidity field lists transcribed out of BLSAggregator.sol.
 */
import { describe, expect, it } from 'vitest';
import { encodeAbiParameters, keccak256, stringToHex } from 'viem';
import type { Address, Hex } from 'viem';
import {
  BLS_DOMAIN_NAME,
  TAG_EXECUTE_SLASH,
  TAG_QUEUE_SLASH,
  TAG_REPUTATION,
  blsDomainSeparator,
  executeSlashMessageHash,
  legacyReputationMessageHash,
  queueSlashMessageHash,
  reputationMessageHash,
} from './bls-domain.js';

const AGGREGATOR = '0x00000000000000000000000000000000000000aa' as Address;
const REGISTRY = '0x00000000000000000000000000000000000000bb' as Address;
const OPERATOR = '0x00000000000000000000000000000000000000cc' as Address;
const USERS = ['0x0000000000000000000000000000000000000001'] as Address[];
const SCORES = [100n];
const EVIDENCE = keccak256(stringToHex('evidence')) as Hex;
const CHAIN_ID = 31337;

describe('BLS domain constants', () => {
  /** Re-derived from the literal strings in BLSAggregator.sol:194-204, not from the module. */
  it('are keccak256 of the versioned domain strings', () => {
    expect(BLS_DOMAIN_NAME).toBe(keccak256(stringToHex('SuperPaymaster.BLSConsensus.v1')));
    expect(TAG_REPUTATION).toBe(keccak256(stringToHex('SuperPaymaster.BLS.Reputation.v1')));
    expect(TAG_EXECUTE_SLASH).toBe(keccak256(stringToHex('SuperPaymaster.BLS.ExecuteSlash.v1')));
    expect(TAG_QUEUE_SLASH).toBe(keccak256(stringToHex('SuperPaymaster.BLS.QueueSlash.v1')));
  });

  it('are all distinct — a shared tag would let one path\'s signature satisfy another', () => {
    const tags = [BLS_DOMAIN_NAME, TAG_REPUTATION, TAG_EXECUTE_SLASH, TAG_QUEUE_SLASH];
    expect(new Set(tags).size).toBe(tags.length);
  });
});

describe('domainSeparator', () => {
  it('binds chain id, the aggregator and its registry', () => {
    const expected = keccak256(
      encodeAbiParameters(
        [{ type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }, { type: 'address' }],
        [BLS_DOMAIN_NAME, BigInt(CHAIN_ID), AGGREGATOR, REGISTRY],
      ),
    );
    expect(blsDomainSeparator(CHAIN_ID, AGGREGATOR, REGISTRY)).toBe(expected);
  });

  /** The whole point of CC-49 HIGH-A: a signature must not travel between deployments. */
  it('changes when ANY of chain id / aggregator / registry changes', () => {
    const base = blsDomainSeparator(CHAIN_ID, AGGREGATOR, REGISTRY);
    expect(blsDomainSeparator(CHAIN_ID + 1, AGGREGATOR, REGISTRY)).not.toBe(base);
    expect(blsDomainSeparator(CHAIN_ID, REGISTRY, REGISTRY)).not.toBe(base);
    expect(blsDomainSeparator(CHAIN_ID, AGGREGATOR, AGGREGATOR)).not.toBe(base);
  });
});

describe('reputation preimage', () => {
  const domain = blsDomainSeparator(CHAIN_ID, AGGREGATOR, REGISTRY);

  it('matches the Solidity field list', () => {
    const expected = keccak256(
      encodeAbiParameters(
        [
          { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' },
          { type: 'address[]' }, { type: 'uint256[]' }, { type: 'uint256' },
        ],
        [domain, TAG_REPUTATION, 7n, USERS, SCORES, 1n],
      ),
    );
    expect(reputationMessageHash(domain, 7n, USERS, SCORES, 1n)).toBe(expected);
  });

  /**
   * THE MIGRATION ASSERTION. If these ever collide, the runner could ship the old preimage and
   * still look "synced" — which is exactly the state the pinned YAAA revision is in today.
   */
  it('is NOT the pre-domain preimage for the same inputs', () => {
    expect(reputationMessageHash(domain, 7n, USERS, SCORES, 1n)).not.toBe(
      legacyReputationMessageHash(7n, USERS, SCORES, 1n, CHAIN_ID),
    );
  });

  it('changes with every field', () => {
    const base = reputationMessageHash(domain, 7n, USERS, SCORES, 1n);
    expect(reputationMessageHash(domain, 8n, USERS, SCORES, 1n)).not.toBe(base);
    expect(reputationMessageHash(domain, 7n, [OPERATOR], SCORES, 1n)).not.toBe(base);
    expect(reputationMessageHash(domain, 7n, USERS, [101n], 1n)).not.toBe(base);
    expect(reputationMessageHash(domain, 7n, USERS, SCORES, 2n)).not.toBe(base);
    expect(reputationMessageHash(keccak256(stringToHex('other')), 7n, USERS, SCORES, 1n)).not.toBe(base);
  });
});

describe('slash preimages', () => {
  const domain = blsDomainSeparator(CHAIN_ID, AGGREGATOR, REGISTRY);

  it('execute-slash matches the Solidity field list', () => {
    const expected = keccak256(
      encodeAbiParameters(
        [
          { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'address' },
          { type: 'uint8' }, { type: 'uint256' }, { type: 'bytes32' },
        ],
        [domain, TAG_EXECUTE_SLASH, 7n, OPERATOR, 2, 1n, EVIDENCE],
      ),
    );
    expect(executeSlashMessageHash(domain, 7n, OPERATOR, 2, 1n, EVIDENCE)).toBe(expected);
  });

  it('queue-slash matches the Solidity field list', () => {
    const expected = keccak256(
      encodeAbiParameters(
        [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'address' }, { type: 'uint8' }, { type: 'uint256' }],
        [domain, TAG_QUEUE_SLASH, OPERATOR, 2, 1n],
      ),
    );
    expect(queueSlashMessageHash(domain, OPERATOR, 2, 1n)).toBe(expected);
  });

  it('execute-slash binds the evidence hash and the severity', () => {
    const base = executeSlashMessageHash(domain, 7n, OPERATOR, 2, 1n, EVIDENCE);
    expect(executeSlashMessageHash(domain, 7n, OPERATOR, 3, 1n, EVIDENCE)).not.toBe(base);
    expect(executeSlashMessageHash(domain, 7n, OPERATOR, 2, 1n, keccak256(stringToHex('other')))).not.toBe(base);
  });

  /** Cross-path: a queue signature must never satisfy an execute, or a reputation. */
  it('no two paths produce the same hash', () => {
    const hashes = new Set([
      reputationMessageHash(domain, 7n, USERS, SCORES, 1n),
      executeSlashMessageHash(domain, 7n, OPERATOR, 2, 1n, EVIDENCE),
      queueSlashMessageHash(domain, OPERATOR, 2, 1n),
    ]);
    expect(hashes.size).toBe(3);
  });
});
