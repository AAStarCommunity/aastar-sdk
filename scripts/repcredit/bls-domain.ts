/**
 * BLS consensus preimages — byte-identical to BLSAggregator 4.6.0
 * (SuperPaymaster `03713feb`, pinned in scripts/upstream-abi-pin.json).
 *
 * WHAT CHANGED AND WHY IT MATTERS (CC-49 HIGH-A, landed in SP 03713feb)
 * ---------------------------------------------------------------------
 * Until 03713feb every signed preimage was a bare field tuple:
 *
 *     keccak256(abi.encode(proposalId, address(0), 0, users, scores, epoch, chainId))
 *
 * Nothing in it named the AGGREGATOR, so a quorum signature gathered for one deployment was
 * replayable against any other BLSAggregator on the same chain, and the reputation and slash paths
 * were distinguished only by their field arity. Every path now hashes `domainSeparator()` — which
 * binds the chain id, the aggregator's own address and its Registry — plus a per-path TAG:
 *
 *     domainSeparator() = keccak256(abi.encode(DOMAIN_NAME, chainId, aggregator, registry))
 *     reputation        = keccak256(abi.encode(domain, TAG_REPUTATION, proposalId, users, scores, epoch))
 *     execute-slash     = keccak256(abi.encode(domain, TAG_EXECUTE_SLASH, proposalId, operator,
 *                                              slashLevel, epoch, evidenceHash))
 *     queue-slash       = keccak256(abi.encode(domain, TAG_QUEUE_SLASH, operator, slashLevel, epoch))
 *
 * Transcribed from `contracts/src/modules/monitoring/BLSAggregator.sol:194-235, 769, 820, 1160`.
 * A transcription slip cannot survive startup: `resolveBlsDomain` in the runner cross-checks every
 * constant AND round-trips a real proposal through the deployed contract's own
 * `reputationMessageHash`. `bls-domain.test.ts` pins the values against independently-derived
 * vectors so a silent edit here is also a unit-test failure.
 */
import { encodeAbiParameters, keccak256, stringToHex } from 'viem';
import type { Address, Hex } from 'viem';

export const BLS_DOMAIN_NAME = keccak256(stringToHex('SuperPaymaster.BLSConsensus.v1'));
export const TAG_QUEUE_SLASH = keccak256(stringToHex('SuperPaymaster.BLS.QueueSlash.v1'));
export const TAG_EXECUTE_SLASH = keccak256(stringToHex('SuperPaymaster.BLS.ExecuteSlash.v1'));
export const TAG_REPUTATION = keccak256(stringToHex('SuperPaymaster.BLS.Reputation.v1'));

/** `BLSAggregator.domainSeparator()` — chain id, the aggregator itself, and its Registry. */
export function blsDomainSeparator(chainId: number | bigint, aggregator: Address, registry: Address): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }, { type: 'address' }],
      [BLS_DOMAIN_NAME, BigInt(chainId), aggregator, registry],
    ),
  );
}

/** `BLSAggregator._reputationMessageHash` / `Registry`'s independent re-verification. */
export function reputationMessageHash(
  domain: Hex,
  proposalId: bigint,
  users: readonly Address[],
  scores: readonly bigint[],
  epoch: bigint,
): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' },
        { type: 'address[]' }, { type: 'uint256[]' }, { type: 'uint256' },
      ],
      [domain, TAG_REPUTATION, proposalId, users as Address[], scores as bigint[], epoch],
    ),
  );
}

/** `BLSAggregator.verifyAndExecute`, slash branch (operator != 0). */
export function executeSlashMessageHash(
  domain: Hex,
  proposalId: bigint,
  operator: Address,
  slashLevel: number,
  epoch: bigint,
  evidenceHash: Hex,
): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'address' },
        { type: 'uint8' }, { type: 'uint256' }, { type: 'bytes32' },
      ],
      [domain, TAG_EXECUTE_SLASH, proposalId, operator, slashLevel, epoch, evidenceHash],
    ),
  );
}

/**
 * `BLSAggregator.queueSlashWithProof`.
 *
 * The evidence runner reaches the queue through `queueGuardianSlash` (no BLS proof), so it does not
 * build this preimage today. It is kept and unit-pinned anyway: `resolveBlsDomain` cross-checks
 * TAG_QUEUE_SLASH against the deployed contract, and the cross-path test below is what proves a
 * queue signature can never satisfy an execute or a reputation.
 */
export function queueSlashMessageHash(
  domain: Hex,
  operator: Address,
  slashLevel: number,
  epoch: bigint,
): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'address' }, { type: 'uint8' }, { type: 'uint256' }],
      [domain, TAG_QUEUE_SLASH, operator, slashLevel, epoch],
    ),
  );
}

/**
 * The PRE-domain reputation preimage, kept ONLY as a mutation baseline for the tests.
 *
 * It is the shape the pinned YAAA revision still builds, and the shape the deployed contract now
 * rejects. Nothing in the runner may call it.
 */
export function legacyReputationMessageHash(
  proposalId: bigint,
  users: readonly Address[],
  scores: readonly bigint[],
  epoch: bigint,
  chainId: number | bigint,
): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'uint256' }, { type: 'address' }, { type: 'uint8' },
        { type: 'address[]' }, { type: 'uint256[]' }, { type: 'uint256' }, { type: 'uint256' },
      ],
      [
        proposalId,
        '0x0000000000000000000000000000000000000000',
        0,
        users as Address[],
        scores as bigint[],
        epoch,
        BigInt(chainId),
      ],
    ),
  );
}
