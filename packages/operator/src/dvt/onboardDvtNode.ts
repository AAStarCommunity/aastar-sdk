import {
    type Account,
    type Address,
    type Hash,
    type Hex,
    type PublicClient,
    type WalletClient,
    formatEther,
    parseEther,
} from 'viem';
import {
    CANONICAL_ADDRESSES,
    ROLE_DVT,
    buildDvtPop,
    dvtOperatorActions,
    registryActions,
    tokenActions,
    type DvtPop,
    AAStarBLSAlgorithmABI,
} from '@aastar/core';

/**
 * L2 workflow — one-click "stake + register" onboarding for a DVT node (CC-36).
 *
 * The staked DVT registration path (`AAStarBLSAlgorithm.registerWithProof`, YetAnotherAA-Validator #165)
 * requires the operator EOA to first hold **ROLE_DVT** stake (>= `minStake` GToken, locked in the linked
 * GTokenStaking registry) before it may bind a node. On-chain that is a 4-step dance the DVT
 * `register-node.mjs` script cannot fully perform on its own — it lacks the privilege to stake an unstaked
 * operator. This workflow composes the existing L1 actions (`tokenActions` / `registryActions` /
 * `dvtOperatorActions`) into a single idempotent call that the SDK, holding both keys, CAN complete:
 *
 *   0. Resolve the PoP tuple (local BLS key → {@link buildDvtPop}, a pre-built tuple, or a `popSigner`
 *      callback — the seam for a future KMS-TEE `/pop` endpoint) and derive `nodeId = keccak256(publicKey)`.
 *   1. Idempotency: if the operator already owns this node and it is registered, short-circuit success.
 *   2. Read `minStake` + ROLE_DVT `ticketPrice` → the GToken the operator must hold to register.
 *   3. (optional) `funderWallet` tops up the operator's ETH (gas) and GToken (stake) when either is low —
 *      this is the "owner 代付" model. Without a funder, an under-funded operator throws a clear error.
 *   4. Operator approves GToken → GTokenStaking, then `registerRole(ROLE_DVT)` (locks the stake). Verify
 *      `getEffectiveStake >= minStake`.
 *   5. Preflight `simulateContract(registerWithProof)` to catch any revert before spending gas.
 *   6. `registerWithProof(publicKey, popPoint, popSig)`; assert `isRegistered && nodeOperator == operator`.
 *
 * This mirrors, step-for-step, the on-chain-proven `tests/regression/onchain-evidence/dvt-register-e2e.ts`.
 *
 * SCOPE (CC-36 v1): covers nodes whose BLS secret key is held locally / in an HSM (the `blsSecretKey` or
 * pre-built `pop` inputs). A KMS-TEE **key-less** node cannot build its PoP here — the secret never leaves
 * the TEE — so it needs a KMS `/pop` endpoint that does not yet exist (cross-repo gap). The `popSigner`
 * callback is the forward seam for that: once KMS ships `/pop`, wire it as `popSigner` with no other change.
 */
export interface OnboardDvtNodeParams {
    /** Read client. Its chain id selects the canonical address book when addresses are omitted. */
    publicClient: PublicClient;
    /**
     * The operator EOA that stakes and registers (the on-chain `msg.sender` for `registerRole` and
     * `registerWithProof`). Must be a WalletClient with an account bound.
     */
    operatorWallet: WalletClient;
    /**
     * Optional owner/funder wallet ("owner 代付"). When provided, tops up the operator's ETH and GToken
     * if either falls short of what registration needs. When omitted, an under-funded operator aborts
     * with a descriptive error instead of a mid-flow on-chain revert.
     */
    funderWallet?: WalletClient;

    // ---- PoP input: provide exactly one ----
    /** Local/HSM BLS secret key (32-byte hex). The PoP is built via {@link buildDvtPop}. */
    blsSecretKey?: Hex;
    /** A pre-built PoP tuple (e.g. produced by an external signer). */
    pop?: DvtPop;
    /** Async PoP provider — the seam for a future KMS-TEE `/pop` endpoint. */
    popSigner?: () => Promise<DvtPop>;

    // ---- addresses (default to CANONICAL_ADDRESSES[chainId]) ----
    /** DVT validator (`AAStarBLSAlgorithm`). Default: canonical `aaStarBLSAlgorithm`. */
    validator?: Address;
    /** SuperPaymaster role Registry. Default: canonical `registry`. */
    registry?: Address;
    /** GToken (stake asset). Default: canonical `gToken`. */
    gToken?: Address;
    /** GTokenStaking (approval spender). Default: canonical `staking`. */
    staking?: Address;

    // ---- funding knobs ----
    /** Fund the operator's ETH when its balance is below this. Default: 0.015 ETH. */
    minOperatorEth?: bigint;
    /** ETH amount the funder sends when topping up gas. Default: 0.03 ETH. */
    topUpEth?: bigint;
    /** Extra GToken headroom above `minStake + ticketPrice` when topping up stake. Default: 2 GToken. */
    gTokenHeadroom?: bigint;

    /**
     * Perform NO on-chain writes: run the reads, compute the funding/stake plan, simulate
     * `registerWithProof` when the operator is already staked, and return the {@link OnboardDvtNodeResult.plan}.
     * No ETH/GToken is sent, no stake is locked, no node is bound.
     */
    dryRun?: boolean;
}

/** What a {@link onboardDvtNode} call WOULD do — populated only on a `dryRun`. All amounts in wei. */
export interface OnboardDvtNodePlan {
    /** Whether the validator's staked-registration path is enabled. */
    requireStake: boolean;
    /** GToken the operator must hold before `registerRole` (`max(validator, registry minStake) + ticket + headroom`). */
    needGToken: bigint;
    /** ETH the funder would send to the operator (0 if already funded / no funder needed). */
    wouldFundEth: bigint;
    /** GToken the funder would transfer to the operator (0 if already funded). */
    wouldFundGToken: bigint;
    /** Whether a GToken→GTokenStaking approval would be submitted. */
    wouldApprove: boolean;
    /** Whether `registerRole(ROLE_DVT)` would be submitted (false when the operator already holds it). */
    wouldRegisterRole: boolean;
    /** Whether `registerWithProof` was simulated OK (only attempted when already staked; false otherwise). */
    registerSimulated: boolean;
}

export interface OnboardDvtNodeResult {
    /** `keccak256(publicKey)` — the node bound (or that would be bound in a dry run). */
    nodeId: Hex;
    /** The node's 128-byte EIP-2537 G1 public key. */
    publicKey: Hex;
    /** The operator EOA. */
    operator: Address;
    /** True when the operator already owned this registered node — the flow short-circuited. */
    alreadyRegistered: boolean;
    /** True when this call newly registered the node (false on idempotent short-circuit or dry run). */
    registered: boolean;
    /** True when this call newly staked ROLE_DVT (false when the operator already held it). */
    staked: boolean;
    /** `getEffectiveStake(operator, ROLE_DVT)` after staking. */
    effectiveStake: bigint;
    /** `minStake()` the contract enforces. */
    minStake: bigint;
    /** Tx hashes for each step actually performed. */
    hashes: {
        fundEth?: Hash;
        fundGToken?: Hash;
        approve?: Hash;
        registerRole?: Hash;
        register?: Hash;
    };
    /** The dry-run plan — present ONLY when `dryRun` was set. */
    plan?: OnboardDvtNodePlan;
}

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

/** Resolve the PoP tuple from whichever of the three mutually-exclusive inputs was supplied. */
async function resolvePop(params: OnboardDvtNodeParams): Promise<DvtPop> {
    const supplied = [params.blsSecretKey, params.pop, params.popSigner].filter((v) => v !== undefined);
    if (supplied.length !== 1) {
        throw new Error(
            'onboardDvtNode: provide exactly one PoP input — blsSecretKey, pop, or popSigner',
        );
    }
    if (params.popSigner) return params.popSigner();
    if (params.pop) return params.pop;
    return buildDvtPop(params.blsSecretKey as Hex);
}

/**
 * Onboard a DVT node in one idempotent call: stake ROLE_DVT (funding the operator if a funder is given)
 * then bind the node via `registerWithProof`. See {@link OnboardDvtNodeParams} for the key model and scope.
 */
export async function onboardDvtNode(params: OnboardDvtNodeParams): Promise<OnboardDvtNodeResult> {
    const { publicClient, operatorWallet, funderWallet, dryRun } = params;

    const operator = operatorWallet.account?.address;
    if (!operator) throw new Error('onboardDvtNode: operatorWallet must have an account bound');

    // Resolve chain + canonical address book.
    const chainId = operatorWallet.chain?.id ?? publicClient.chain?.id ?? (await publicClient.getChainId());
    const canonical = CANONICAL_ADDRESSES[chainId as keyof typeof CANONICAL_ADDRESSES];
    if (!canonical) throw new Error(`onboardDvtNode: no canonical address book for chain ${chainId}`);

    const validator = params.validator ?? (canonical.aaStarBLSAlgorithm as Address);
    const registry = params.registry ?? (canonical.registry as Address);
    const gToken = params.gToken ?? (canonical.gToken as Address);
    const staking = params.staking ?? (canonical.staking as Address);
    if (!validator || BigInt(validator) === 0n) {
        throw new Error(`onboardDvtNode: DVT validator address is unset/zero on chain ${chainId}`);
    }

    const minOperatorEth = params.minOperatorEth ?? parseEther('0.015');
    const topUpEth = params.topUpEth ?? parseEther('0.03');
    const gTokenHeadroom = params.gTokenHeadroom ?? parseEther('2');

    // L1 action bindings.
    const dvtRead = dvtOperatorActions(validator)(publicClient);
    const dvtOp = dvtOperatorActions(validator)(operatorWallet);
    const regRead = registryActions(registry)(publicClient);
    const regOp = registryActions(registry)(operatorWallet);
    const gtRead = tokenActions()(publicClient);
    const gtOp = tokenActions()(operatorWallet);

    // Wait for a receipt AND assert the tx did not revert — waitForTransactionReceipt resolves even for
    // mined-but-reverted writes, so a bare await would silently treat a revert as success.
    const waitSuccess = async (step: string, hash: Hash): Promise<Hash> => {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') {
            throw new Error(`onboardDvtNode: ${step} tx ${hash} reverted on-chain (status=${receipt.status}).`);
        }
        return hash;
    };
    const maxBig = (a: bigint, b: bigint) => (a > b ? a : b);
    const hashes: OnboardDvtNodeResult['hashes'] = {};

    // --- 0. resolve PoP + nodeId ---
    const pop = await resolvePop(params);
    const { nodeId, publicKey } = pop;

    // --- 1. idempotency (reads only) ---
    const existingNode = await dvtRead.operatorNode({ operator });
    if (existingNode && existingNode !== ZERO_BYTES32) {
        if (existingNode.toLowerCase() === nodeId.toLowerCase()) {
            // Operator already owns THIS node. If it is registered → idempotent success. If it owns the
            // slot but is not registered (a partial/interrupted prior run), fall through and resume the
            // registration — this is the same operator + same nodeId, so it is not a conflict.
            if (await dvtRead.isRegistered({ nodeId })) {
                const eff = await regRead.getEffectiveStake({ user: operator, roleId: ROLE_DVT });
                const min = await dvtRead.minStake();
                return {
                    nodeId, publicKey, operator,
                    alreadyRegistered: true, registered: false, staked: false,
                    effectiveStake: eff, minStake: min, hashes,
                };
            }
        } else {
            // The contract binds one node per operator; a different existing node is a hard conflict.
            throw new Error(
                `onboardDvtNode: operator ${operator} already owns node ${existingNode}, ` +
                `cannot bind a second node ${nodeId}. Use a different operator EOA.`,
            );
        }
    }
    // Guard against a nodeId already owned by someone else.
    const nodeOwner = await dvtRead.nodeOperator({ nodeId });
    if (nodeOwner && BigInt(nodeOwner) !== 0n && nodeOwner.toLowerCase() !== operator.toLowerCase()) {
        throw new Error(`onboardDvtNode: nodeId ${nodeId} is already registered to ${nodeOwner}`);
    }

    // --- 2. stake requirements (reads only) ---
    const minStake = await dvtRead.minStake(); // validator floor enforced at registerWithProof
    const requireStake = await dvtRead.requireStake();
    let needGToken = 0n;
    if (requireStake) {
        const cfg = await regRead.getRoleConfig({ roleId: ROLE_DVT });
        const ticket = BigInt(cfg.ticketPrice ?? 0n);
        // registerRole locks the REGISTRY's ROLE_DVT minStake; registerWithProof requires the VALIDATOR's
        // minStake. If the registry floor is below the validator floor, staking can never satisfy the
        // validator — fail fast BEFORE locking any GToken rather than lock-then-abort.
        const registryMinStake = BigInt(cfg.minStake ?? 0n);
        if (registryMinStake < minStake) {
            throw new Error(
                `onboardDvtNode: registry ROLE_DVT minStake ${formatEther(registryMinStake)} < validator ` +
                `minStake ${formatEther(minStake)} — registerRole cannot lock enough to pass the validator ` +
                `(contract misconfig). Aborting before staking.`,
            );
        }
        // Hold enough GToken to cover the larger of the two floors, plus the ticket fee and headroom.
        needGToken = maxBig(minStake, registryMinStake) + ticket + gTokenHeadroom;
    }

    // --- 3. compute the funding / staking plan (reads only) ---
    // ETH gas is needed by ANY path that submits an operator tx (register, and the stake txs), so it is
    // planned independently of requireStake. Top up to the threshold: max(topUpEth, deficit) guarantees a
    // low custom topUpEth still reaches minOperatorEth.
    const opEth = await publicClient.getBalance({ address: operator });
    const wouldFundEth = opEth < minOperatorEth ? maxBig(topUpEth, minOperatorEth - opEth) : 0n;

    let opGt = 0n;
    let wouldApprove = false;
    let hasRole = false;
    let wouldFundGToken = 0n;
    if (requireStake) {
        opGt = (await gtRead.balanceOf({ token: gToken, account: operator })) as bigint;
        wouldFundGToken = opGt < needGToken ? needGToken - opGt : 0n;
        const allowance = (await gtRead.allowance({ token: gToken, owner: operator, spender: staking })) as bigint;
        wouldApprove = allowance < needGToken;
        hasRole = await regRead.hasRole({ roleId: ROLE_DVT, user: operator });
    }
    const wouldRegisterRole = requireStake && !hasRole;

    // --- dryRun: perform NO writes. Simulate registerWithProof only if already staked (else it reverts
    // on the missing stake, which is expected and not an error in a dry run). ---
    if (dryRun) {
        const effNow = requireStake ? await regRead.getEffectiveStake({ user: operator, roleId: ROLE_DVT }) : 0n;
        let registerSimulated = false;
        if (!requireStake || (hasRole && effNow >= minStake)) {
            try {
                await publicClient.simulateContract({
                    address: validator,
                    abi: AAStarBLSAlgorithmABI as any,
                    functionName: 'registerWithProof',
                    args: [pop.publicKey, pop.popPoint, pop.popSig],
                    account: operatorWallet.account as Account,
                });
                registerSimulated = true;
            } catch {
                registerSimulated = false;
            }
        }
        return {
            nodeId, publicKey, operator,
            alreadyRegistered: false, registered: false, staked: false,
            effectiveStake: effNow, minStake, hashes,
            plan: {
                requireStake, needGToken, wouldFundEth, wouldFundGToken,
                wouldApprove, wouldRegisterRole, registerSimulated,
            },
        };
    }

    // --- 4. fund operator gas (owner 代付) — before any operator-signed tx ---
    if (wouldFundEth > 0n) {
        if (!funderWallet?.account) {
            throw new Error(
                `onboardDvtNode: operator ETH ${formatEther(opEth)} < required ${formatEther(minOperatorEth)} ` +
                `and no funderWallet was provided — fund the operator or pass funderWallet.`,
            );
        }
        const h = await funderWallet.sendTransaction({
            account: funderWallet.account,
            chain: funderWallet.chain ?? null,
            to: operator,
            value: wouldFundEth,
        });
        await waitSuccess('fundEth', h);
        hashes.fundEth = h;
    }

    // --- 5. stake ROLE_DVT (fund GToken → approve → registerRole) ---
    let staked = false;
    let effectiveStake = 0n;
    if (requireStake) {
        if (wouldFundGToken > 0n) {
            if (!funderWallet?.account) {
                throw new Error(
                    `onboardDvtNode: operator GToken ${formatEther(opGt)} < required ${formatEther(needGToken)} ` +
                    `and no funderWallet was provided — fund the operator or pass funderWallet.`,
                );
            }
            const gtFunder = tokenActions()(funderWallet);
            const h = await gtFunder.transfer({ token: gToken, to: operator, amount: wouldFundGToken });
            await waitSuccess('fundGToken', h);
            hashes.fundGToken = h;
        }

        if (wouldApprove) {
            // Approve 2x headroom so a later top-up does not force a re-approve.
            const h = await gtOp.approve({ token: gToken, spender: staking, amount: needGToken * 2n });
            await waitSuccess('approve', h);
            hashes.approve = h;
        }

        if (wouldRegisterRole) {
            const h = await regOp.registerRole({ roleId: ROLE_DVT, user: operator, data: '0x' });
            await waitSuccess('registerRole', h);
            hashes.registerRole = h;
            staked = true;
        }

        effectiveStake = await regRead.getEffectiveStake({ user: operator, roleId: ROLE_DVT });
        if (effectiveStake < minStake) {
            throw new Error(
                `onboardDvtNode: effectiveStake ${formatEther(effectiveStake)} < minStake ${formatEther(minStake)} ` +
                `after registerRole — aborting before registerWithProof.`,
            );
        }
    }

    // --- 6. preflight simulate (throws on any revert before spending register gas) ---
    await publicClient.simulateContract({
        address: validator,
        abi: AAStarBLSAlgorithmABI as any,
        functionName: 'registerWithProof',
        args: [pop.publicKey, pop.popPoint, pop.popSig],
        account: operatorWallet.account as Account,
    });

    // --- 7. registerWithProof + assert ---
    const registerHash = await dvtOp.registerWithProof({
        publicKey: pop.publicKey,
        popPoint: pop.popPoint,
        popSig: pop.popSig,
    });
    await waitSuccess('register', registerHash);
    hashes.register = registerHash;

    const isReg = await dvtRead.isRegistered({ nodeId });
    const owner = await dvtRead.nodeOperator({ nodeId });
    if (!isReg || owner.toLowerCase() !== operator.toLowerCase()) {
        throw new Error(
            `onboardDvtNode: post-condition failed — isRegistered=${isReg}, nodeOperator=${owner} (expected ${operator}).`,
        );
    }

    return {
        nodeId, publicKey, operator,
        alreadyRegistered: false, registered: true, staked,
        effectiveStake, minStake, hashes,
    };
}
