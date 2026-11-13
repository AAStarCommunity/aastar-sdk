/**
 * Signer identity for the price keeper (DSR B1, DSR on #446).
 * Every read is at one block hash. A failed read is not "ok".
 * Against SuperPaymaster 5.4.2 the refuse-start set is the deployer, SP.owner(), and Registry.owner().
 * `sp-mismatch` stays on the result type so the shared gate can name an rc.8 deployment mismatch;
 * this price keeper never returns that kind.
 */
import superPaymasterArtifact from '../../packages/core/src/abis/SuperPaymaster.json' with { type: 'json' };
import registryArtifact from '../../packages/core/src/abis/Registry.json' with { type: 'json' };
import {
    encodeFunctionData,
    isAddress,
    type Abi,
    type AbiFunction,
    type Address,
    type Hex,
} from 'viem';

export const DEPLOYER_ADDRESS: Address = '0xb5600060e6de5E11D3636731964218E53caadf0E';

export interface IdentityChain {
    call(tx: { to: Address; data: Hex; blockHash: Hex }): Promise<Hex>;
}

export type IdentityFailureKind = 'privileged' | 'read-failed' | 'sp-mismatch';

export type IdentityResult = { ok: true } | { ok: false; kind: IdentityFailureKind; problems: string[] };

function ownerAbi(artifact: { abi?: Abi }, label: string): Abi {
    const abi = artifact.abi;
    if (!abi) throw new Error(`signer identity: ${label} owner fragment missing`);
    const found = abi.filter((item): item is AbiFunction =>
        item.type === 'function' && item.name === 'owner' && item.inputs.length === 0);
    if (found.length !== 1) throw new Error(`signer identity: ${label} owner fragment missing`);
    return found;
}

/** SuperPaymaster.json is the 5.4.2 ABI (see packages/core/src/abis/index.ts). owner() is the same selector on Registry. */
const SP_OWNER_ABI = ownerAbi(superPaymasterArtifact as { abi?: Abi }, 'superpaymaster');
const REGISTRY_OWNER_ABI = ownerAbi(registryArtifact as { abi?: Abi }, 'registry');

function bad(problems: string[]): IdentityResult {
    const copied = [...problems];
    const privileged = copied.some((problem) => problem.startsWith('signer equals '));
    return { ok: false, kind: privileged ? 'privileged' : 'read-failed', problems: copied };
}

function norm(addr: string): string {
    return addr.toLowerCase();
}

function isBytes32(value: unknown): value is Hex {
    return typeof value === 'string' && value.length === 66 && value.startsWith('0x');
}

function decodeAddress(data: Hex): Address | null {
    if (data.length !== 66) return null;
    const body = data.slice(2);
    for (let i = 0; i < 24; i++) if (body[i] !== '0') return null;
    const addr = `0x${body.slice(24)}`;
    if (!isAddress(addr)) return null;
    return addr;
}

async function readRaw(chain: IdentityChain, to: Address, data: Hex, blockHash: Hex, label: string, problems: string[]): Promise<Hex | null> {
    try {
        const out = await chain.call({ to, data, blockHash });
        if (typeof out !== 'string' || out.length < 2 || out.length > 20_000 || !out.startsWith('0x')) {
            problems.push(`read failed: ${label}`);
            return null;
        }
        return out;
    } catch {
        problems.push(`read failed: ${label}`);
        return null;
    }
}

async function readOwner(chain: IdentityChain, to: Address, abi: Abi, blockHash: Hex, label: string, problems: string[]): Promise<Address | null> {
    const data = encodeFunctionData({ abi, functionName: 'owner' });
    const raw = await readRaw(chain, to, data, blockHash, label, problems);
    if (!raw) return null;
    const addr = decodeAddress(raw);
    if (!addr) {
        problems.push(`read failed: ${label}`);
        return null;
    }
    return addr;
}

function same(signer: Address, other: Address | null, problem: string, problems: string[]): void {
    if (other && norm(signer) === norm(other)) problems.push(problem);
}

export async function checkSignerIdentity(input: {
    chain: IdentityChain;
    blockHash: Hex;
    signer: Address;
    sp: Address;
    registry: Address;
    deployers?: readonly Address[];
}): Promise<IdentityResult> {
    if (!isBytes32(input.blockHash) || !isAddress(input.signer) || !isAddress(input.sp) || !isAddress(input.registry)) {
        return bad(['signer identity: bad parameters']);
    }
    const deployers: string[] = [norm(DEPLOYER_ADDRESS)];
    const extra = input.deployers ?? [];
    if (extra.length > 32) return bad(['signer identity: bad parameters']);
    for (const item of extra) {
        if (!isAddress(item)) return bad(['signer identity: bad parameters']);
        const n = norm(item);
        if (!deployers.includes(n)) deployers.push(n);
    }
    const signer = input.signer;
    const blockHash = input.blockHash;
    const problems: string[] = [];
    if (deployers.includes(norm(signer))) problems.push('signer equals deployer');

    const spOwner = await readOwner(input.chain, input.sp, SP_OWNER_ABI, blockHash, 'SP.owner', problems);
    same(signer, spOwner, 'signer equals superpaymaster owner', problems);
    const registryOwner = await readOwner(input.chain, input.registry, REGISTRY_OWNER_ABI, blockHash, 'Registry.owner', problems);
    same(signer, registryOwner, 'signer equals registry owner', problems);

    if (problems.length) return bad(problems);
    if (!spOwner || !registryOwner) return bad(problems.length ? problems : ['read failed: owner']);
    return { ok: true };
}
