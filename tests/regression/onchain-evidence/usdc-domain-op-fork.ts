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
import { createServer } from 'node:net';
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
    createPublicClient, createWalletClient, http, encodeFunctionData, parseSignature, type Address, type Hex,
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

// A port the OS just handed out on loopback, so the anvil we start is the only thing listening there.
function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const srv = createServer();
        srv.once('error', reject);
        srv.listen(0, '127.0.0.1', () => { const { port } = srv.address() as any; srv.close(() => resolve(port)); });
    });
}

// Error text for the report: first line only, with any URL removed.
const clean = (e: unknown) => String((e as any)?.shortMessage ?? (e as any)?.message ?? e).split('\n')[0].replace(/https?:\/\/\S+/g, '<url>');

async function waitForRpc(client: { getChainId: () => Promise<number> }, exited: () => boolean): Promise<void> {
    for (let i = 0; i < 120; i++) {
        if (exited()) throw new Error('anvil exited before it was ready');
        try { await client.getChainId(); return; } catch { await new Promise((r) => setTimeout(r, 500)); }
    }
    throw new Error('anvil fork did not come up');
}

async function main() {
    const anvilBin = process.env.ANVIL_BIN ?? join(homedir(), '.foundry/bin/anvil');
    const port = await freePort();
    const LOCAL = `http://127.0.0.1:${port}`;
    const anvil = spawn(anvilBin, ['--fork-url', FORK_SOURCE, '--host', '127.0.0.1', '--port', String(port), '--chain-id', '10', '--silent'], { stdio: 'ignore' });
    let exited = false;
    anvil.once('exit', () => { exited = true; });
    anvil.once('error', () => { exited = true; });
    const lines: string[] = [];
    try {
        const client = createPublicClient({ chain: optimism, transport: http(LOCAL) });
        await waitForRpc(client, () => exited);
        // Before any state change: the endpoint must be our own, still-running anvil, and it must be a fork.
        const info = await client.request({ method: 'anvil_nodeInfo' as any }) as any;
        if (exited || !info?.forkConfig?.forkBlockNumber) throw new Error('the endpoint is not the anvil fork this script started');
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
            catch (e) { return { ok: false as const, reason: clean(e) }; }
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
        const oldRejectedForSignature = !old.ok && /invalid signature/i.test(old.reason);
        const sdkSim = await simulate(calldata(nonce, payload.payload.signature as Hex));
        let sdk: { ok: boolean; detail: string } = { ok: false, detail: sdkSim.ok ? '' : `simulation rejected: ${sdkSim.reason}` };
        if (sdkSim.ok) {
            const hash = await client.request({ method: 'eth_sendTransaction' as any, params: [{ from: recipient, to: OP_USDC, data: calldata(nonce, payload.payload.signature as Hex) }] as any }) as Hex;
            const receipt = await client.waitForTransactionReceipt({ hash });
            sdk = { ok: receipt.status === 'success', detail: `fork tx ${hash} status ${receipt.status}` };
        }

        // Bridged USDC.e: the resolver must refuse because the getters are missing, not for any other reason.
        let usdcE: string;
        let usdcERefusedForGetters = false;
        try {
            await resolveEip712Domain(client as any, OP_USDC_E);
            usdcE = 'RESOLVED (unexpected)';
        } catch (e) {
            usdcE = `refused: ${clean(e)}`;
            usdcERefusedForGetters = usdcE.includes('neither eip712Domain() nor name()/version() could be read');
        }

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
