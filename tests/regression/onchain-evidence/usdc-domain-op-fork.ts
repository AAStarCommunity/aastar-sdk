/**
 * Evidence: on an OP Mainnet fork, an EIP-3009 authorization signed by the SDK (domain read from the
 * chain) is accepted by native USDC, and one signed under the old default { name: 'USDC', version: '2' }
 * is rejected by the same contract.
 *
 * Everything runs against a local anvil fork. The fork reads state from a public OP Mainnet RPC; no
 * transaction is sent to any real chain. The signer is a key generated in memory for this run and
 * never printed; value is 0, so no balance is needed. The recipient (msg.sender of
 * receiveWithAuthorization) is impersonated on the fork.
 *
 *   pnpm exec tsx tests/regression/onchain-evidence/usdc-domain-op-fork.ts
 *
 * Output: docs/onchain-evidence/usdc-domain-op-fork.md (no RPC URL, no key).
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
    createPublicClient, createWalletClient, http, encodeFunctionData, parseSignature, decodeErrorResult,
    BaseError, ContractFunctionRevertedError, type Address, type Hex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { optimism } from 'viem/chains';
import { resolveEip712Domain, clearEip712DomainCache } from '@aastar/core';
import { X402Client, EIP3009_TYPES } from '@aastar/x402';

const FORK_SOURCE = process.env.OP_FORK_RPC ?? 'https://mainnet.optimism.io'; // public, read-only; never written out
const OP_USDC = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' as Address;
const OP_USDC_E = '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address;
const OUT = 'docs/onchain-evidence/usdc-domain-op-fork.md';

// FiatTokenV2 receiveWithAuthorization (v, r, s variant), as deployed for native USDC.
const RECEIVE_ABI = [{
    type: 'function', name: 'receiveWithAuthorization', stateMutability: 'nonpayable', outputs: [],
    inputs: [
        { name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' },
        { name: 'v', type: 'uint8' }, { name: 'r', type: 'bytes32' }, { name: 's', type: 'bytes32' },
    ],
}] as const;

// Anvil binds port 0 itself (an OS-assigned loopback port) and prints it only after the bind succeeded,
// so the port read from its own stdout is one this child owns. Its stdout is parsed, never written out.
function startAnvil(bin: string, args: string[]): Promise<{ child: ReturnType<typeof spawn>; port: number }> {
    return new Promise((resolve, reject) => {
        const child = spawn(bin, [...args, '--host', '127.0.0.1', '--port', '0'], { stdio: ['ignore', 'pipe', 'ignore'] });
        let buf = '';
        const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('anvil did not report a listening port')); }, 120_000);
        child.stdout!.on('data', (d) => {
            buf += String(d);
            const m = buf.match(/Listening on 127\.0\.0\.1:(\d+)/);
            if (m) { clearTimeout(timer); child.stdout!.removeAllListeners('data'); child.stdout!.resume(); resolve({ child, port: Number(m[1]) }); }
        });
        child.once('exit', () => { clearTimeout(timer); reject(new Error('anvil exited before it was listening')); });
        child.once('error', (e) => { clearTimeout(timer); reject(e); });
    });
}

// A contract-level revert, as opposed to a transport failure: viem only builds
// ContractFunctionRevertedError when the node answered with a revert.
const isRevert = (e: unknown) => e instanceof BaseError && Boolean(e.walk((x) => x instanceof ContractFunctionRevertedError));

// The Error(string) reason of a reverted eth_call, decoded from its return data (undefined if there is none).
function revertReason(e: unknown): string | undefined {
    if (!(e instanceof BaseError)) return undefined;
    const raw = e.walk((x: any) => typeof x?.data === 'string' && x.data.startsWith('0x08c379a0')) as any;
    if (!raw) return undefined;
    const decoded = decodeErrorResult({ abi: [{ type: 'error', name: 'Error', inputs: [{ name: 'message', type: 'string' }] }], data: raw.data });
    return decoded.args[0] as string;
}

// Error text for the report: first line only, with any URL removed.
const clean = (e: unknown) => String((e as any)?.shortMessage ?? (e as any)?.message ?? e).split('\n')[0].replace(/https?:\/\/\S+/g, '<url>');



async function main() {
    const anvilBin = process.env.ANVIL_BIN ?? join(homedir(), '.foundry/bin/anvil');
    const { child: anvil, port } = await startAnvil(anvilBin, ['--fork-url', FORK_SOURCE, '--chain-id', '10']);
    const LOCAL = `http://127.0.0.1:${port}`;
    const lines: string[] = [];
    try {
        const client = createPublicClient({ chain: optimism, transport: http(LOCAL) });
        // Before any state change: the endpoint (the port this child reported) must be a fork of chain 10.
        const info = await client.request({ method: 'anvil_nodeInfo' as any }) as any;
        if (!info?.forkConfig?.forkBlockNumber || (await client.getChainId()) !== 10) throw new Error('the endpoint is not the OP Mainnet fork this script started');
        const forkBlock = BigInt(info.forkConfig.forkBlockNumber);

        const payer = privateKeyToAccount(generatePrivateKey()); // in-memory, this run only
        const recipient = privateKeyToAccount(generatePrivateKey()).address; // impersonated msg.sender
        await client.request({ method: 'anvil_setBalance' as any, params: [recipient, '0xde0b6b3a7640000'] as any });
        await client.request({ method: 'anvil_impersonateAccount' as any, params: [recipient] as any });

        clearEip712DomainCache();
        const resolved = await resolveEip712Domain(client as any, OP_USDC);

        const walletClient = createWalletClient({ account: payer, chain: optimism, transport: http(LOCAL) });
        const x402 = new X402Client({
            publicClient: client as any, walletClient, superPaymasterAddress: recipient, chainId: 10, facilitatorContract: recipient,
        });
        const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);
        const calldata = (nonce: Hex, signature: Hex) => {
            const { v, r, s } = parseSignature(signature);
            return encodeFunctionData({
                abi: RECEIVE_ABI, functionName: 'receiveWithAuthorization',
                args: [payer.address, recipient, 0n, 0n, validBefore, nonce, Number(v), r, s],
            });
        };
        const simulate = async (data: Hex) => {
            try { await client.call({ account: recipient, to: OP_USDC, data }); return { ok: true as const }; }
            catch (e) { return { ok: false as const, reason: clean(e), decoded: revertReason(e) }; }
        };

        // One authorization (the SDK's, nonce unused), signed under two domains; only the domain differs.
        const { payload, nonce } = await x402.createPayment({
            from: payer.address, to: recipient, asset: OP_USDC, amount: 0n, maxFee: 0n,
            settlement: 'eip-3009', validAfter: 0n, validBefore,
        });
        const oldSig = await walletClient.signTypedData({
            account: payer, domain: { name: 'USDC', version: '2', chainId: 10, verifyingContract: OP_USDC },
            types: EIP3009_TYPES, primaryType: 'ReceiveWithAuthorization',
            message: { from: payer.address, to: recipient, value: 0n, validAfter: 0n, validBefore, nonce },
        });
        // Old first: a rejection must be the contract's signature check, nothing else.
        const old = await simulate(calldata(nonce, oldSig));
        // Exactly FiatTokenV2's signature check, decoded from the revert data; any other failure is not evidence.
        const oldRejectedForSignature = !old.ok && old.decoded === 'FiatTokenV2: invalid signature';
        const sdkSim = await simulate(calldata(nonce, payload.payload.signature as Hex));
        let sdk: { ok: boolean; detail: string } = { ok: false, detail: sdkSim.ok ? '' : `simulation rejected: ${sdkSim.reason}` };
        if (sdkSim.ok) {
            const hash = await client.request({ method: 'eth_sendTransaction' as any, params: [{ from: recipient, to: OP_USDC, data: calldata(nonce, payload.payload.signature as Hex) }] as any }) as Hex;
            const receipt = await client.waitForTransactionReceipt({ hash });
            sdk = { ok: receipt.status === 'success', detail: `fork tx ${hash} status ${receipt.status}` };
        }

        // Bridged USDC.e: the resolver must refuse, and the reason must be missing getters, not the transport.
        // Control read: name() answers, so the fork can read this contract. Then version() and
        // DOMAIN_SEPARATOR() must each fail as contract-level reverts.
        const ERC20_META = [
            { type: 'function', name: 'name', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
            { type: 'function', name: 'version', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
            { type: 'function', name: 'DOMAIN_SEPARATOR', inputs: [], outputs: [{ type: 'bytes32' }], stateMutability: 'view' },
        ] as const;
        const probe = async (functionName: 'name' | 'version' | 'DOMAIN_SEPARATOR') => {
            try { return { value: await client.readContract({ address: OP_USDC_E, abi: ERC20_META, functionName }) as string }; }
            catch (e) { return { revert: isRevert(e), reason: clean(e) }; }
        };
        const [eName, eVersion, eSeparator] = [await probe('name'), await probe('version'), await probe('DOMAIN_SEPARATOR')];
        const gettersMissing = 'value' in eName && (eVersion as any).revert === true && (eSeparator as any).revert === true;
        let usdcE: string;
        let usdcERefused = false;
        try {
            await resolveEip712Domain(client as any, OP_USDC_E);
            usdcE = 'RESOLVED (unexpected)';
        } catch (e) {
            usdcE = `refused: ${clean(e)}`;
            usdcERefused = true;
        }
        const usdcERefusedForGetters = gettersMissing && usdcERefused;
        usdcE += ` — control name() = ${JSON.stringify((eName as any).value ?? null)}; version() ${(eVersion as any).revert ? 'reverts' : 'did NOT revert'}; DOMAIN_SEPARATOR() ${(eSeparator as any).revert ? 'reverts' : 'did NOT revert'}`;

        const pass = sdk.ok && oldRejectedForSignature && usdcERefusedForGetters;
        lines.push(
            '# USDC EIP-712 domain on an OP Mainnet fork',
            '',
            `Generated by \`tests/regression/onchain-evidence/usdc-domain-op-fork.ts\` on ${new Date().toISOString()}.`,
            `Local anvil fork of OP Mainnet (chainId ${await client.getChainId()}) at block ${forkBlock}, forked from a public RPC (URL not recorded).`,
            'No transaction was sent to any real chain; the signer key was generated in memory for this run and is not recorded.',
            '',
            '| Check | Result |',
            '|---|---|',
            `| Domain read by \`resolveEip712Domain\` for native USDC ${OP_USDC} | \`${JSON.stringify(resolved.domain)}\` (source: ${resolved.source}) |`,
            `| Its separator equals the contract's \`DOMAIN_SEPARATOR()\` | ${resolved.separator} (checked inside the resolver) |`,
            `| Same authorization (same nonce) under the old default \`{ name: 'USDC', version: '2' }\`, simulated first | ${old.ok ? 'ACCEPTED (unexpected)' : `rejected: ${old.reason}`}${oldRejectedForSignature ? '' : ' (NOT the expected invalid-signature revert)'} |`,
            `| \`X402Client.createPayment\` → \`receiveWithAuthorization\` on the fork | ${sdk.ok ? `accepted, ${sdk.detail}` : `REJECTED: ${sdk.detail}`} |`,
            `| Bridged USDC.e ${OP_USDC_E} | ${usdcE} |`,
            '',
            `Verdict: ${pass ? 'PASS' : 'FAIL'}`,
            '',
        );
        writeFileSync(OUT, lines.join('\n'));
        console.log(lines.join('\n'));
        if (!pass) process.exitCode = 1;
    } finally {
        anvil.kill('SIGTERM');
    }
}

main().catch((e) => {
    console.error(`usdc-domain-op-fork: ${(e as Error).message.split('\n')[0]}`);
    process.exitCode = 1;
});
