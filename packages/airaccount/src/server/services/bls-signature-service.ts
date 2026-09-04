import { hexToBytes } from "viem";
import { keccak256 } from "../../migration/viem/hashing";
import axios from "axios";
import {
  BLSManager,
  BLSSignatureData,
  CumulativeT2SignatureData,
  CumulativeT3SignatureData,
} from "../../core/bls";
import {
  packWebAuthnBlob,
  packBlsPayload,
  packCommitteeBlsPayload,
  packCumulativeT2WA,
  packCumulativeT3WA,
  packEcdsaAlgId,
} from "../../migration/viem/bls-packing";
import {
  AAStarAirAccountV7ABI,
  AAStarCommitteeValidatorABI,
  assertCommitteeQuorum,
  encodeEnrollInCommitteeValidator,
  fetchCommitteeSigners,
  getMountedDvtValidator,
  isAccountEnrolled,
  type CommitteeSigner,
  classifyDvtSigner,
  recordDvtSigner,
  newDvtIdentitySeen,
} from "@aastar/core";
import {
  AbiDecodingZeroDataError,
  BaseError,
  ContractFunctionZeroDataError,
  HttpRequestError,
  RpcRequestError,
  TimeoutError,
  type Hex,
} from "viem";
import { TierLevel } from "../../core/tier";
import { EthereumProvider } from "../providers/ethereum-provider";
import { IStorageAdapter } from "../interfaces/storage-adapter";
import { ISignerAdapter, SignerAuthContext } from "../interfaces/signer-adapter";
import { ILogger, ConsoleLogger } from "../interfaces/logger";
import { ServerConfig } from "../config";

/**
 * Minimal guardian signer surface (was `ethers.Signer`): an external signer that
 * performs an EIP-191 personal-sign over raw bytes and returns a 0x-prefixed
 * 65-byte hex signature. Structural — any ethers/viem signer with this method fits.
 */
export interface GuardianSigner {
  signMessage(message: Uint8Array): Promise<string>;
}

/**
 * #257: transport payload the redeployed DVT (v1.7) requires on `/signature/sign`. `userOp` is the
 * PACKED ERC-4337 UserOperation in RPC (hex) form; `ownerAuth` is the owner's EIP-191 signature over
 * `userOpHash` (the DVT validates owner authorization before co-signing). Built by the SUBMIT flow and
 * threaded through the tiered-signature path as a pure transport credential — it is NOT part of the
 * on-chain composite signature.
 */
export interface DvtSignRequest {
  userOp: Record<string, unknown>;
  ownerAuth: string;
}

/**
 * Device WebAuthn assertion (the three `AuthenticatorAssertionResponse` fields the frontend gets
 * from `navigator.credentials.get()` with `challenge = userOpHash`). Used by the WebAuthn cumulative
 * Tier-2/3 path — the SDK derives the on-chain passkey factor (algId 0x09/0x0a) from it.
 */
export interface DeviceWebAuthnAssertion {
  authenticatorData: `0x${string}` | Uint8Array;
  clientDataJSON: `0x${string}` | Uint8Array | string;
  signature: `0x${string}` | Uint8Array; // DER-encoded P-256 signature
}

/**
 * Raised when a DVT node (aNode YetAnotherAA-Validator ≥ v1.3.0, running with
 * `CONFIRM_ENABLED=true`) withholds its co-signature on a high-value op pending
 * out-of-band approval. The node returns `{ status: "pending_confirmation",
 * userOpHash }` instead of a signature; the withheld co-sign is released by
 * `POST /signature/confirm { userOpHash, token }` once the user approves over an
 * independent channel (single-use token, TTL, fail-closed). The SDK surfaces this
 * as a typed error rather than silently dropping the node so callers can drive the
 * confirm flow. Default-off nodes never emit this (behaviour == v1.2.0).
 */
export class DvtPendingConfirmationError extends Error {
  constructor(
    public readonly userOpHash: string,
    public readonly nodeEndpoint: string
  ) {
    super(
      `DVT node ${nodeEndpoint} withheld its co-signature pending out-of-band ` +
        `confirmation for userOpHash ${userOpHash}; release it via POST /signature/confirm.`
    );
    this.name = "DvtPendingConfirmationError";
  }
}

/**
 * Type guard for a DVT v1.3.0 `/signature/sign` response that withheld its
 * co-signature pending out-of-band confirmation (`{ status: "pending_confirmation",
 * userOpHash }`). Used at every sign call site so a high-value-op withhold is
 * surfaced, not mistaken for a signature-less failure. Default-off nodes never
 * return this shape.
 */
export function isPendingConfirmation(
  data: unknown
): data is { status: "pending_confirmation"; userOpHash?: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { status?: unknown }).status === "pending_confirmation"
  );
}

/**
 * Which BLS framing the validator mounted for an account will DECODE (CC-98/CC-103). Resolved from
 * the chain before signing, never guessed from payload shape — the two framings share the leading
 * `[nodeIdsLength]` word and differ only in per-signer stride, which is the shape-collision CC-103
 * names as the flip-order attack root.
 */
type CommitteeFraming =
  | { mode: "legacy" }
  | { mode: "committee"; validator: `0x${string}`; treeDepth: number };

/**
 * BLS signature service — extracted from NestJS BlsService.
 * Uses lazy initialization instead of onModuleInit.
 */
export class BLSSignatureService {
  private blsManager: BLSManager | null = null;
  private readonly logger: ILogger;

  constructor(
    private readonly config: ServerConfig,
    private readonly ethereum: EthereumProvider,
    private readonly storage: IStorageAdapter,
    private readonly signer: ISignerAdapter,
    logger?: ILogger
  ) {
    this.logger = logger ?? new ConsoleLogger("[BLSSignatureService]");
  }

  /**
   * Fail closed when the DVT validator MOUNTED FOR THIS ACCOUNT is in COMMITTEE mode (CC-98/CC-103).
   *
   * The cumulative packers CAN emit committee framing (FU-18), but this service always hands them
   * bare `nodeIds` — it has no committee-signer plumbing (slot + Merkle proof fetch, and the
   * one-time owner-only `enrollInCommitteeValidator()` tx it cannot send on the user's behalf).
   * Under `committeeActive() == true` the account decodes committee framing, so a legacy-framed
   * composite is guaranteed to be REJECTED on-chain. Throwing beats returning those bytes: the
   * whole point of FU-18 was that a wrong-framing payload fails as an opaque `validateUserOp != 0`
   * far from its cause. Full committee support for this path is FU-19.
   *
   * EVERYTHING here is derived from the CHAIN — never from the static address book, never from the
   * storage record (Codex review, rounds 2-3). Two earlier revisions were wrong in the same way,
   * trusting a local copy of state the chain owns:
   *   - `CANONICAL_ADDRESSES` as both the validator to read and a "does this chain have committee
   *     infra" precondition, so a non-canonical deployment WITH committee infra bypassed the guard;
   *   - the persisted `account.validatorAddress`, which `AccountManager.ensureValidatorRouter()`
   *     lets an owner legitimately outdate (it sends `setValidator` without writing back), so a
   *     stale record could name a legacy router while the account really runs on a committee one.
   * The authoritative chain is therefore read end to end:
   *
   *   account.validator()      = the account's own set-once router (on-chain, not the record)
   *     -> getAlgorithm(0x01)  = the validator actually mounted for THIS account
   *     -> committeeActive()   = the framing it will decode
   *
   * Fail-closed boundary: allowing legacy signing to proceed is the dangerous direction, so it needs
   * a POSITIVE reason. Exactly one thing earns it — the contract answering, at the ABI level, that it
   * has no `committeeActive()` (a pre-committee validator, which every legacy deployment is, and for
   * which legacy framing is correct) — corroborated by `getCode` so that an empty response from a
   * codeless address, which decodes identically, cannot pass as that answer. Everything else —
   * transport faults, unrecognised errors, a stripped cause chain, an unresolvable router — refuses
   * to sign. Guessing legacy is precisely how a guaranteed-rejected signature gets produced.
   */
  private async resolveCommitteeFraming(context: string, userId: string): Promise<CommitteeFraming> {
    const isUnset = (a?: string | null) => !a || /^0x0+$/i.test(a);
    const provider = this.ethereum.getProvider();

    // Deciding "the contract answered 'no such function'" is the ONLY branch that allows legacy
    // signing to proceed, so it is identified POSITIVELY and everything else fails closed (Codex
    // review r3). An earlier revision asked the inverse — "is this a transport fault?" — and allowed
    // legacy for anything unrecognised; a wrapper/proxy that rethrows as a plain Error, or that
    // drops viem's cause chain, then lands in the allow branch and emits a doomed signature. The
    // provider surface here is an injectable client, so that is not hypothetical.
    //
    // readContract wraps EVERYTHING (transport faults included) in ContractFunctionExecutionError,
    // so the wrapper type alone proves nothing: require a genuine ABI-level outcome in the chain AND
    // the absence of any transport fault.
    const isAbiLevelAnswer = (e: unknown) => {
      if (!(e instanceof BaseError)) return false;
      const transport = e.walk(
        (x) => x instanceof HttpRequestError || x instanceof TimeoutError || x instanceof RpcRequestError
      );
      if (transport) return false;
      // ZERO-DATA ONLY. A revert is NOT evidence the function is absent (Codex review r4, High):
      // viem raises ContractFunctionRevertedError for a genuine `execution reverted`, so a deployed
      // COMMITTEE validator whose committeeActive() reverts — bad state, access control, a proxy
      // quirk, an implementation bug — would be misread as "pre-committee, legacy is fine" and the
      // service would emit doomed legacy framing having never learned the mode. getCode() cannot
      // rescue that: it proves code exists, not what the code does. Only an empty return supports
      // the conclusion "this contract has no such function".
      return !!e.walk(
        (x) => x instanceof ContractFunctionZeroDataError || x instanceof AbiDecodingZeroDataError
      );
    };

    const fatal = (detail: string) =>
      new Error(
        `${context}: cannot confirm the DVT validator's framing mode, refusing to sign. This path only ` +
        `emits LEGACY BLS framing ([nodeIdsLength][nodeIds][blsSig]) — if the account's validator is in ` +
        `committee mode it decodes ([nodeIdsLength][nodeId|slot|proof][blsSig]) and the signature is ` +
        `rejected on-chain. Guessing legacy here would produce exactly that silent failure, so this ` +
        `fails closed. Cause: ${detail}`
      );

    // ── 1. the account's router — read from the ACCOUNT ON-CHAIN, never from storage.
    // The persisted `validatorAddress` is NOT authoritative (Codex review r3, High): the supported
    // `AccountManager.ensureValidatorRouter(..., { router })` path sends `setValidator(router)` and
    // returns WITHOUT writing the new value back to the record. So an owner can legitimately move an
    // account onto another router while storage still names the old one — and if the real router
    // mounts a committee validator while the stale one does not, trusting storage silently emits
    // exactly the doomed legacy signature this guard exists to prevent. No storage compromise
    // required. The account itself is the only authority on its own set-once router.
    let router: string;
    let accountAddress: string;
    try {
      const account = await this.storage.findAccountByUserId(userId);
      if (!account) throw new Error(`no account record for userId ${userId}`);
      if (isUnset(account.address)) throw new Error(`account record for userId ${userId} has no address`);
      accountAddress = account.address;
      router = (await provider.readContract({
        address: account.address as `0x${string}`,
        abi: AAStarAirAccountV7ABI,
        functionName: "validator",
      })) as string;
      if (isUnset(router)) throw new Error(`account ${account.address} has no validator router set on-chain`);
    } catch (e) {
      throw fatal(`could not resolve the account's validator router — ${(e as Error).message}`);
    }

    // ── 2. what is mounted at algId 0x01 on that router
    let validator: string;
    try {
      validator = await getMountedDvtValidator(provider, router as `0x${string}`);
    } catch (e) {
      throw fatal(`could not read getAlgorithm(0x01) from router ${router} — ${(e as Error).message}`);
    }
    // Nothing mounted at all ⇒ no DVT validator ⇒ committee framing is not reachable.
    if (isUnset(validator)) return { mode: "legacy" };

    // ── 3. the framing that validator will decode
    let active: boolean;
    try {
      active = (await provider.readContract({
        address: validator as `0x${string}`,
        abi: AAStarCommitteeValidatorABI,
        functionName: "committeeActive",
      })) as boolean;
    } catch (e) {
      if (!isAbiLevelAnswer(e)) {
        throw fatal(
          `could not read committeeActive() from ${validator}, and the failure is not a recognisable ` +
          `ABI-level answer (so "this validator has no committeeActive()" cannot be concluded from it) ` +
          `— ${(e as Error).message}`
        );
      }
      // A contract-level failure is ambiguous between two very different situations, and only one of
      // them makes legacy framing safe:
      //   (a) a real, deployed, PRE-COMMITTEE validator with no committeeActive() function — legacy
      //       is correct, and every legacy deployment lands here, so this must not throw; versus
      //   (b) an address with NO CODE, where the empty return decodes the same way. That is not an
      //       answer, it means we are reading the wrong thing, and treating it as "legacy" would be
      //       a silent fail-open — exactly the failure class this guard exists to close.
      // So confirm there is a contract there before trusting the empty answer.
      let deployed: boolean;
      try {
        const code = await provider.getCode({ address: validator as `0x${string}` });
        deployed = !!code && code !== "0x";
      } catch (codeErr) {
        throw fatal(
          `committeeActive() on ${validator} failed (${(e as Error).message}) and the follow-up ` +
          `getCode check could not run — ${(codeErr as Error).message}`
        );
      }
      if (!deployed) {
        throw fatal(
          `the router's algId 0x01 points at ${validator}, which has NO CODE — the empty response is not ` +
          `evidence of a pre-committee validator, it means the mounted address is wrong or the RPC is ` +
          `serving a different chain`
        );
      }
      // A deployed contract that has no committeeActive(): pre-committee validator, legacy is correct.
      this.logger.debug?.(
        `[${context}] ${validator} is deployed but has no committeeActive() — pre-committee validator, ` +
        `LEGACY framing is correct`
      );
      return { mode: "legacy" };
    }

    if (!active) return { mode: "legacy" };

    // ── 4. committee mode: the account must have run the one-time owner enrolment, and the
    // validator's TREE_DEPTH must be read (never assumed — CC-103 Q4).
    if (!(await isAccountEnrolled(provider, validator as `0x${string}`, accountAddress as `0x${string}`))) {
      throw new Error(
        `${context}: validator ${validator} is in committee mode, but account ${accountAddress} has not run ` +
        `the one-time enrollInCommitteeValidator(). That is an OWNER transaction, which this service has no ` +
        `signer for, so it cannot be done here. Send this calldata to the account from the owner wallet ` +
        `(or via a UserOp), then retry:\n  to:   ${accountAddress}\n  data: ${encodeEnrollInCommitteeValidator()}`
      );
    }

    let treeDepth: number;
    try {
      treeDepth = Number(
        (await provider.readContract({
          address: validator as `0x${string}`,
          abi: AAStarCommitteeValidatorABI,
          functionName: "TREE_DEPTH",
        })) as bigint
      );
    } catch (e) {
      throw fatal(`could not read TREE_DEPTH() from ${validator} — ${(e as Error).message}`);
    }
    if (!Number.isInteger(treeDepth) || treeDepth <= 0) {
      throw fatal(`validator ${validator} reported a nonsensical TREE_DEPTH of ${treeDepth}`);
    }

    return { mode: "committee", validator: validator as `0x${string}`, treeDepth };
  }

  /**
   * Fetch each contributing node's `slot` + Merkle proof so the aggregate can be committee-framed
   * (FU-19). Kept separate from {@link resolveCommitteeFraming} because it needs the nodeIds, which
   * only exist AFTER the DVT round-trip — whereas the framing decision must happen BEFORE it, so an
   * unenrolled account or an unreadable validator fails without burning three node calls.
   */
  private async fetchCommitteeSignersFor(
    context: string,
    framing: Extract<CommitteeFraming, { mode: "committee" }>,
    nodeIds: string[]
  ): Promise<CommitteeSigner[]> {
    const provider = this.ethereum.getProvider();
    const validator = framing.validator;
    const read = (functionName: string, args: readonly unknown[] = []) =>
      provider.readContract({ address: validator, abi: AAStarCommitteeValidatorABI, functionName, args: args as never });

    const { signers } = await fetchCommitteeSigners(provider, validator, nodeIds as `0x${string}`[]);

    // ── proof shape ────────────────────────────────────────────────────────────────────────────
    const badLen = signers.find((s) => s.merkleProof.length !== framing.treeDepth);
    if (badLen) {
      throw new Error(
        `${context}: validator ${validator} returned a ${badLen.merkleProof.length}-element Merkle proof ` +
        `for node ${badLen.nodeId} but reports TREE_DEPTH ${framing.treeDepth} — the on-chain _verifyMerkle ` +
        `would reject this payload, refusing to pack it`
      );
    }

    // ── membership ─────────────────────────────────────────────────────────────────────────────
    // Length alone proves nothing about WHO the proof is for. `getMerkleProof` on a NON-member
    // returns slot 0, whose bytes are indistinguishable from a legitimate slot-0 member — so a
    // length-only check happily packs a payload that dies as an opaque `validateUserOp != 0`
    // on-chain, which is the exact failure class FU-18/FU-19 exist to eliminate. `slotPlusOne`
    // is the validator's own membership oracle (0 == not a member) and doubles as an authoritative
    // cross-check on the slot we are about to sign over.
    const slots = (await Promise.all(signers.map((s) => read("slotPlusOne", [s.nodeId])))) as bigint[];
    signers.forEach((s, i) => {
      const plusOne = slots[i];
      if (plusOne === 0n) {
        throw new Error(
          `${context}: node ${s.nodeId} is NOT a member of the committee set on ${validator} ` +
          `(slotPlusOne == 0). getMerkleProof returns slot 0 for non-members, which is byte-identical ` +
          `to a legitimate slot-0 member, so this would have packed and failed opaquely on-chain.`
        );
      }
      if (plusOne - 1n !== BigInt(s.slot)) {
        throw new Error(
          `${context}: slot mismatch for node ${s.nodeId} — getMerkleProof says ${s.slot}, ` +
          `slotPlusOne says ${plusOne - 1n}. The proof would authenticate the wrong leaf.`
        );
      }
    });

    // ── FU-9: are these proofs provably the ones the contract will verify against? ──────────────
    // getMerkleProof proves against runningRoot() (the CURRENT set), while _verifyMerkle checks the
    // FROZEN epochSetRoot(e-1). If those two differ, the set has moved since the snapshot and every
    // proof here is stale.
    //
    // A previous revision compared BLOCK NUMBERS (`lastSetMutationBlock > atBlock`) and was DEAD CODE:
    // `fetchCommitteeSigners` reads lastSetMutationBlock pinned to `atBlock`, and a storage value read
    // at block N can never report a mutation later than N, so the condition was structurally always
    // false. Worse, the unit test's fake ignored the `blockNumber` pin, so a guard that could not fire
    // was reported green — code, comment and a passing test all asserting a protection that did not
    // exist. Roots are compared instead because they are the thing the contract actually checks.
    const [runningRoot, epoch] = (await Promise.all([read("runningRoot"), read("currentEpoch")])) as [Hex, bigint];
    if (epoch === 0n) {
      throw new Error(
        `${context}: validator ${validator} reports currentEpoch() == 0, so there is no frozen e-1 ` +
        `snapshot for _verifyMerkle to check these proofs against. Refusing to pack.`
      );
    }
    const frozenRoot = (await read("epochSetRoot", [epoch - 1n])) as Hex;
    if (runningRoot.toLowerCase() !== frozenRoot.toLowerCase()) {
      throw new Error(
        `${context}: the committee set has moved since the epoch-${epoch - 1n} snapshot — getMerkleProof ` +
        `proves against runningRoot ${runningRoot}, but _verifyMerkle checks epochSetRoot(${epoch - 1n}) ` +
        `= ${frozenRoot}. These proofs would not verify. Refusing to pack (FU-9).`
      );
    }

    // ── quorum ─────────────────────────────────────────────────────────────────────────────────
    // The production signing path was checking only active + enrolled — 2 of the 4 conditions the
    // evidence scripts check via assertCommitteeSubmittable. Packing an under-quorum aggregate, or
    // packing at all while requiredQuorum() returns the COMMITTEE_QUORUM_UNAVAILABLE sentinel (this
    // module's own fail-closed marker meaning committee validation cannot succeed AT ALL), wastes
    // gas on a guaranteed on-chain rejection. assertCommitteeQuorum names both causes.
    assertCommitteeQuorum(signers.length, (await read("requiredQuorum")) as bigint);

    return signers;
  }


  /** Lazy-initialize BLSManager on first use. */
  private async ensureInitialized(): Promise<BLSManager> {
    if (this.blsManager) return this.blsManager;

    const blsConfig = await this.storage.getBlsConfig();
    const seedNodes =
      this.config.blsSeedNodes ?? blsConfig?.discovery?.seedNodes?.map(n => n.endpoint) ?? [];

    this.blsManager = new BLSManager({
      seedNodes,
      discoveryTimeout: this.config.blsDiscoveryTimeout ?? 10000,
    });

    return this.blsManager;
  }

  async getActiveSignerNodes(): Promise<unknown[]> {
    const manager = await this.ensureInitialized();
    const nodes = await manager.getAvailableNodes();

    if (nodes.length > 0) {
      try {
        await this.storage.updateSignerNodesCache(nodes);
      } catch {
        // Non-critical
      }
    }

    return nodes;
  }

  async generateBLSSignature(
    userId: string,
    userOpHash: string,
    ctx?: SignerAuthContext,
    options?: {
      /**
       * Skip the owner ECDSA over `userOpHash` (`aaSignature`). The cumulative
       * Tier-2 (algId 0x04) / Tier-3 (0x05) packings do NOT include it — they
       * carry only `messagePointSignature` (owner intent comes from the P256
       * passkey signature) — so computing it there is a wasted owner signature.
       * Under the WebAuthn-ceremony KMS path that wasted signature is also a
       * wasted user gesture, so tiered callers set this to `true`.
       */
      skipOwnerOpSignature?: boolean;
      /**
       * #257: the redeployed DVT (v1.7) validates OWNER AUTHORIZATION before co-signing, so the sign
       * request is `{ userOp, ownerAuth }` (ownerAuth = the owner's EIP-191 sig over userOpHash).
       * This is a TRANSPORT credential produced by the SUBMIT flow and threaded through — the composite
       * signature (P256 + BLS + guardian) does NOT include it and this method does NOT produce it.
       */
      dvtRequest?: DvtSignRequest;
    }
  ): Promise<BLSSignatureData> {
    const manager = await this.ensureInitialized();

    const activeNodes = await this.getActiveSignerNodes();
    if (activeNodes.length < 1) {
      throw new Error("No active BLS signer nodes available");
    }

    const selectedNodes = activeNodes.slice(0, Math.min(3, activeNodes.length)) as Array<{
      apiEndpoint: string;
    }>;

    // ── COORDINATION SEAM (SDK-coordinator strategy) — #257 / P2P-migration ───────────────────────
    // Gather per-node BLS signatures and aggregate. Today the SDK is the coordinator (discover → fan
    // out → aggregate). A future P2P deployment (nodes self-discover + self-organize) swaps JUST this
    // call for a submit-once-to-the-network transport; everything below (message point, owner ECDSA,
    // the tiered packers, the contract format) is unchanged.
    const { nodeIds: signerNodeIds, signature: aggregatedSignature } =
      await this._coordinateBlsAggregate(selectedNodes, userOpHash, options?.dvtRequest);

    // Generate message point
    const messagePoint = await manager.generateMessagePoint(userOpHash);

    // Get user account and wallet for ECDSA signatures
    const account = await this.storage.findAccountByUserId(userId);
    if (!account) {
      throw new Error(`User account not found for userId: ${userId}`);
    }

    const walletAddress = await this.signer.getAddress(userId);

    if (walletAddress.toLowerCase() !== account.signerAddress.toLowerCase()) {
      throw new Error(
        `Wallet address mismatch! Wallet: ${walletAddress}, Expected: ${account.signerAddress}`
      );
    }

    // `aaSignature` (owner ECDSA over userOpHash) and `messagePointSignature` are only consumed by the
    // legacy non-tiered packSignature format; the Tier-2/3 cumulative packings omit BOTH. Skip them for
    // tiered callers — beyond saving wasted signatures, under the KMS WebAuthn-ceremony path the ceremony
    // assertion is SINGLE-USE, and the submit flow already spends it on the DVT `ownerAuth`
    // (buildDvtRequest); a second ctx sign here would reuse a consumed assertion and fail (#258 review M1).
    // Empty strings are safe: the tiered packers never read either field.
    const aaSignature = options?.skipOwnerOpSignature
      ? "0x"
      : await this.signer.signMessage(userId, hexToBytes(userOpHash as `0x${string}`), ctx);
    const messagePointHash = keccak256(messagePoint as `0x${string}`);
    const messagePointSignature = options?.skipOwnerOpSignature
      ? "0x"
      : await this.signer.signMessage(userId, hexToBytes(messagePointHash as `0x${string}`), ctx);

    return {
      nodeIds: signerNodeIds,
      signature: aggregatedSignature,
      messagePoint,
      aaAddress: account.signerAddress,
      aaSignature,
      messagePointSignature,
    };
  }

  /**
   * COORDINATION SEAM (#257 / P2P-migration). The SDK-coordinator BLS transport: POST the sign request
   * to each selected node, then aggregate. The redeployed DVT (v1.7) rejects the legacy `{ message }`
   * body and validates OWNER AUTHORIZATION before co-signing, so the body is `{ userOp, ownerAuth }`
   * (`ownerAuth` = the owner's EIP-191 sig over userOpHash, produced by the submit flow — this layer
   * only transports it).
   *
   * TWO NODES, ONE KEY: an earlier version of this doc said that case was out of reach here because
   * it "needs the registered public keys". It is not. BLS is deterministic over (key, message), so
   * one key behind two ids returns byte-identical partials, and this loop already holds them — the
   * duplicate-signature check below catches it with no extra data. The claim was corrected in FU-15
   * after the evidence gate turned out to have been doing exactly this for weeks.
   *
   * WHAT REMAINS OUT OF REACH: a node that holds a duplicate key and PERTURBS its partial to evade
   * the byte comparison. That does not buy anything — the aggregate then fails verification — so the
   * check is fail-closed either way; but it means "no duplicate bytes" is evidence of distinct
   * signers, not proof of them.
   *
   * This is the ONLY place that talks to the DVT nodes. A future P2P deployment (nodes self-discover +
   * self-organize) provides an alternative implementation of this single method — a submit-once-to-the-
   * network transport that returns the same `{ nodeIds, signature }` — with NO change to the composite
   * signature assembly, the tiered packers, or the contract format.
   */
  private async _coordinateBlsAggregate(
    selectedNodes: Array<{ apiEndpoint: string }>,
    userOpHash: string,
    dvtRequest?: DvtSignRequest
  ): Promise<{ nodeIds: string[]; signature: string }> {
    if (!dvtRequest) {
      throw new Error(
        "BLS signing requires a dvtRequest { userOp, ownerAuth } — the redeployed DVT (v1.7) validates " +
          "owner authorization before co-signing. Produce ownerAuth (owner EIP-191 over userOpHash) in the " +
          "submit flow and thread it through."
      );
    }
    const body = { userOp: dvtRequest.userOp, ownerAuth: dvtRequest.ownerAuth };

    const signerNodeSignatures: string[] = [];
    const signerNodeIds: string[] = [];
    const seenSigners = newDvtIdentitySeen();
    for (const node of selectedNodes) {
      try {
        const response = await axios.post(`${node.apiEndpoint}/signature/sign`, body);
        // A CONFIRM_ENABLED node withholds its co-sign on a high-value op until out-of-band approval.
        if (isPendingConfirmation(response.data)) {
          throw new DvtPendingConfirmationError(response.data.userOpHash ?? userOpHash, node.apiEndpoint);
        }
        const sig = response.data.signatureCompact || response.data.signature;
        const nodeId = response.data.nodeId;

        // FU-16/FU-15. The id a node reports about ITSELF is checked here rather than taken on trust,
        // and a malformed or repeated answer is treated exactly like an unreachable node: skip it,
        // keep going, let the quorum check downstream decide whether enough honest nodes answered.
        //
        // Timing is the point. These faults were already caught — the encoder rejects a non-bytes32
        // id and a duplicate — but only after this node's SIGNATURE was already inside the aggregate,
        // so one node answering badly killed an operation the remaining nodes could have carried,
        // while the same node simply not answering was survivable. The gradient was backwards.
        //
        // The signature check is the correction FU-15 forced. #343 shipped a comment here saying
        // same-key-two-ids "needs the registered public keys, which this transport does not hold".
        // That was wrong: BLS is deterministic over (key, message), so one key behind two ids
        // produces byte-identical partials, and this loop is already holding them. The evidence
        // script had been catching it that way for weeks. The claim was reasoned about what we know
        // of KEYS when the decisive property belonged to the SIGNATURES already in hand.
        //
        // Classification lives in @aastar/core so this transport and the evidence gates cannot drift
        // apart about what "the same signer twice" means; what they do about it stays different on
        // purpose — a release gate aborts, a live transport skips.
        const normalisedSig = sig?.startsWith("0x") ? sig : `0x${sig}`;
        const fault = classifyDvtSigner({ endpoint: node.apiEndpoint, nodeId, signature: normalisedSig }, seenSigners);
        if (fault) throw new Error(`${fault.message} — dropping this co-signature`);
        recordDvtSigner({ endpoint: node.apiEndpoint, nodeId, signature: normalisedSig }, seenSigners);

        signerNodeSignatures.push(normalisedSig);
        signerNodeIds.push(nodeId as string);
      } catch (err) {
        if (err instanceof DvtPendingConfirmationError) throw err;
        // Node unreachable / rejected / answered incoherently — continue with the others.
      }
    }

    if (signerNodeSignatures.length === 0) {
      throw new Error("Failed to get signatures from any BLS signer nodes");
    }

    if (signerNodeSignatures.length === 1) {
      // Single co-signer: its signature IS the aggregate.
      return { nodeIds: signerNodeIds, signature: signerNodeSignatures[0] };
    }
    const aggregateResponse = await axios.post(
      `${selectedNodes[0].apiEndpoint}/signature/aggregate`,
      { signatures: signerNodeSignatures }
    );
    const agg = aggregateResponse.data.signature;
    return { nodeIds: signerNodeIds, signature: agg.startsWith("0x") ? agg : `0x${agg}` };
  }

  async packSignature(blsData: BLSSignatureData): Promise<string> {
    // The legacy non-tiered format embeds the owner ECDSA over userOpHash. Reject a
    // signature produced with `skipOwnerOpSignature` (aaSignature === "0x"), which is
    // only valid for the Tier-2/3 packers that omit it — otherwise this would silently
    // pack an invalid signature.
    if (!blsData.aaSignature || blsData.aaSignature === "0x") {
      throw new Error(
        "packSignature requires aaSignature; this BLSSignatureData was generated with " +
          "skipOwnerOpSignature (Tier-2/3 only). Use packCumulativeT2/T3Signature instead."
      );
    }
    const manager = await this.ensureInitialized();
    return manager.packSignature(blsData);
  }

  // ── Tiered Signature Support (M4) ─────────────────────────────

  /**
   * Generate a tiered signature based on the required tier level.
   *
   * - Tier 1: algId 0x02 — single ECDSA ([0x02][r][s][v] = 66 bytes). airaccount-contract
   *   v0.25.0 removed the raw-65 fallback, so the leading 0x02 is now REQUIRED (#273). This
   *   matches the Ledger path (auth/hardware/ledger.ts) and the compositeValidator ECDSA path.
   * - Tier 2: algId 0x04 — P256 + BLS aggregate (contract #45: no messagePoint/mpSig)
   * - Tier 3: algId 0x05 — P256 + BLS aggregate + Guardian ECDSA (contract #45: no messagePoint/mpSig)
   *
   * @param tier - Required tier level (1, 2, or 3)
   * @param userId - User ID for account lookup
   * @param userOpHash - The UserOp hash to sign
   * @param p256Signature - P256 passkey signature (64 bytes, required for tier 2/3)
   * @param guardianSigner - Guardian signer (required for tier 3)
   * @param ctx - Optional passkey assertion context for KMS signing
   */
  async generateTieredSignature(params: {
    tier: TierLevel;
    userId: string;
    userOpHash: string;
    p256Signature?: string;
    guardianSigner?: GuardianSigner;
    ctx?: SignerAuthContext;
    /** #257 transport: { userOp, ownerAuth } for the DVT — produced by the submit flow, threaded through. */
    dvtRequest?: DvtSignRequest;
  }): Promise<string> {
    const { tier, userId, userOpHash, p256Signature, guardianSigner, ctx, dvtRequest } = params;
    const manager = await this.ensureInitialized();

    if (tier === 1) {
      // Tier 1: single ECDSA, packed as [algId 0x02][r(32)][s(32)][v(1)] = 66 bytes.
      // airaccount-contract v0.25.0 dropped the raw-65 fallback, so the 0x02 algId prefix is
      // mandatory (#273); prior to that we returned the owner sig verbatim. packEcdsaAlgId validates
      // the signer returned a bare 65-byte sig (guards against double-prefixing).
      const account = await this.storage.findAccountByUserId(userId);
      if (!account) throw new Error(`User account not found for userId: ${userId}`);

      const rawEcdsa = await this.signer.signMessage(
        userId,
        hexToBytes(userOpHash as `0x${string}`),
        ctx
      );
      return packEcdsaAlgId(rawEcdsa as `0x${string}`);
    }

    // Tier 2 and 3 both need BLS + P256
    if (!p256Signature) {
      throw new Error(`P256 signature required for Tier ${tier}`);
    }

    // Resolve the framing BEFORE the DVT round-trip: an unenrolled account or an unreadable
    // validator must fail without burning three node calls to produce unusable bytes.
    const framing = await this.resolveCommitteeFraming("generateTieredSignature", userId);

    // Get BLS components (reuse existing generateBLSSignature for node signing + aggregation).
    // Tier-2/3 packings omit the owner ECDSA over userOpHash (aaSignature), so skip it —
    // saves one owner signature (and one WebAuthn ceremony gesture under the KMS ceremony path).
    const blsData = await this.generateBLSSignature(userId, userOpHash, ctx, {
      skipOwnerOpSignature: true,
      dvtRequest,
    });

    // messagePoint / messagePointSignature are intentionally NOT included: contract issue #45 Fix 1
    // removed them from the cumulative format (the account recomputes the message point on-chain), so
    // the packed signature carries only P256 + the BLS [nodeIds][blsSig] block (+ guardian for T3).
    // Committee mode carries each signer's slot + Merkle proof; legacy carries bare nodeIds (FU-19).
    const framedBls: Pick<CumulativeT2SignatureData, "nodeIds" | "committeeSigners" | "treeDepth"> =
      framing.mode === "committee"
        ? {
            committeeSigners: await this.fetchCommitteeSignersFor(
              "generateTieredSignature", framing, blsData.nodeIds
            ),
            treeDepth: framing.treeDepth,
          }
        : { nodeIds: blsData.nodeIds };

    if (tier === 2) {
      const t2Data: CumulativeT2SignatureData = {
        p256Signature,
        ...framedBls,
        blsSignature: blsData.signature,
      };
      return manager.packCumulativeT2Signature(t2Data);
    }

    // Tier 3: also needs guardian signature
    if (!guardianSigner) {
      throw new Error("Guardian signer required for Tier 3");
    }

    const guardianSignature = await guardianSigner.signMessage(
      hexToBytes(userOpHash as `0x${string}`)
    );

    const t3Data: CumulativeT3SignatureData = {
      p256Signature,
      ...framedBls,
      blsSignature: blsData.signature,
      guardianSignature,
    };
    return manager.packCumulativeT3Signature(t3Data);
  }

  /**
   * Generate a WebAuthn cumulative Tier-2/3 signature (algId 0x09 / 0x0a) from a DEVICE passkey
   * assertion — the integrator-zero-packing path (#234). The frontend runs one WebAuthn ceremony
   * with `challenge = userOpHash`; the SDK derives the on-chain passkey factor from the assertion,
   * fetches + aggregates the DVT BLS co-signatures itself, and packs the composite. No KMS owner
   * signature is involved (the device passkey IS the owner factor; cumulative = P256 + BLS [+ guardian]).
   *
   * @param tier 2 or 3 (tier 1 is plain ECDSA — not this path).
   * @param deviceWebAuthn the `navigator.credentials.get()` response fields (challenge MUST be userOpHash).
   * @param guardianSigner required for tier 3.
   */
  async generateWebAuthnTieredSignature(params: {
    tier: TierLevel;
    userId: string;
    userOpHash: string;
    deviceWebAuthn: DeviceWebAuthnAssertion;
    guardianSigner?: GuardianSigner;
    /**
     * #257 transport: { userOp, ownerAuth } for the DVT — the owner authorization the redeployed nodes
     * validate before co-signing. Produced by the SUBMIT flow (where owner authorization belongs) and
     * threaded through; it is NOT part of the on-chain composite (this function stays a pure composite
     * assembler — P256 + BLS + guardian).
     */
    dvtRequest?: DvtSignRequest;
  }): Promise<string> {
    const { tier, userId, userOpHash, deviceWebAuthn, guardianSigner, dvtRequest } = params;
    if (tier !== 2 && tier !== 3) {
      throw new Error(`generateWebAuthnTieredSignature: tier must be 2 or 3, got ${tier}`);
    }
    // Tier-3 needs a guardian — check BEFORE the DVT round-trip so a missing guardian fails fast
    // (no wasted /signature/sign network call). #240 PK finding.
    if (tier === 3 && !guardianSigner) {
      throw new Error("Guardian signer required for Tier 3 (WebAuthn)");
    }
    // Same pre-DVT framing resolution as the raw-P256 path.
    const framing = await this.resolveCommitteeFraming("generateWebAuthnTieredSignature", userId);

    // 1) On-chain passkey factor from the device assertion (verifies challenge == userOpHash,
    //    decodes DER → r/s + low-S; throws in-SDK if the assertion doesn't bind userOpHash).
    const waBlob = packWebAuthnBlob(deviceWebAuthn, userOpHash as `0x${string}`);

    // 2) DVT BLS aggregate — fetched + aggregated by the SDK-coordinator (dvtRequest carries the owner
    //    authorization the nodes require). No owner ECDSA in the cumulative composite itself.
    const blsData = await this.generateBLSSignature(userId, userOpHash, undefined, {
      skipOwnerOpSignature: true,
      dvtRequest,
    });
    // packCumulativeT2WA/T3WA are framing-agnostic — they take a pre-built block — so the choice is
    // made here (FU-19).
    const blsPayload =
      framing.mode === "committee"
        ? packCommitteeBlsPayload(
            await this.fetchCommitteeSignersFor("generateWebAuthnTieredSignature", framing, blsData.nodeIds),
            blsData.signature as `0x${string}`,
            framing.treeDepth
          )
        : packBlsPayload(blsData.nodeIds as `0x${string}`[], blsData.signature as `0x${string}`);

    if (tier === 2) {
      return packCumulativeT2WA(waBlob, blsPayload);
    }

    // 3) Tier 3 — guardian ECDSA over userOpHash (guardianSigner presence already checked above).
    const guardianSignature = await guardianSigner!.signMessage(hexToBytes(userOpHash as `0x${string}`));
    return packCumulativeT3WA(waBlob, blsPayload, guardianSignature as `0x${string}`);
  }
}
