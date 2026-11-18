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
    createPublicClient, createWalletClient, http, encodeFunctionData, parseSignature, type Address, type Hex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { optimism } from 'viem/chains';
import { resolveEip712Domain, clearEip712DomainCache } from '@aastar/core';
import { X402Client, EIP3009_TYPES } from '@aastar/x402';

const FORK_SOURCE = process.env.OP_FORK_RPC ?? 'https://mainnet.optimism.io'; // public, read-only; never written out
const OP_USDC = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' as Address;
const OP_USDC_E = '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address;
const PORT = 18545 + Math.floor(Math.random() * 1000);
const LOCAL = `http://127.0.0.1:${PORT}`;
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

async function waitForRpc(client: { getChainId: () => Promise<number> }): Promise<void> {
    for (let i = 0; i < 120; i++) {
        try { await client.getChainId(); return; } catch { await new Promise((r) => setTimeout(r, 500)); }
    }
    throw new Error('anvil fork did not come up');
}

async function main() {
    const anvilBin = process.env.ANVIL_BIN ?? join(homedir(), '.foundry/bin/anvil');
    const anvil = spawn(anvilBin, ['--fork-url', FORK_SOURCE, '--port', String(PORT), '--chain-id', '10', '--silent'], { stdio: 'ignore' });
    const lines: string[] = [];
    try {
        const client = createPublicClient({ chain: optimism, transport: http(LOCAL) });
        await waitForRpc(client);
        const forkBlock = await client.getBlockNumber();

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
        const submit = async (nonce: Hex, signature: Hex) => {
            const { v, r, s } = parseSignature(signature);
            const data = encodeFunctionData({
                abi: RECEIVE_ABI, functionName: 'receiveWithAuthorization',
                args: [payer.address, recipient, 0n, 0n, validBefore, nonce, Number(v), r, s],
            });
            try {
                await client.call({ account: recipient, to: OP_USDC, data });
            } catch (e) {
                return { ok: false as const, reason: (e as any).shortMessage?.split('\n')[0] ?? String(e) };
            }
            const hash = await client.request({ method: 'eth_sendTransaction' as any, params: [{ from: recipient, to: OP_USDC, data }] as any }) as Hex;
            const receipt = await client.waitForTransactionReceipt({ hash });
            return { ok: receipt.status === 'success', hash, status: receipt.status };
        };

        // 1. The SDK path: X402Client reads the domain from the fork and signs.
        const { payload, nonce } = await x402.createPayment({
            from: payer.address, to: recipient, asset: OP_USDC, amount: 0n, maxFee: 0n,
            settlement: 'eip-3009', validAfter: 0n, validBefore,
        });
        const sdk = await submit(nonce, payload.payload.signature as Hex);

        // 2. The old default domain, same message shape, fresh nonce.
        const oldNonce = ('0x' + 'ee'.repeat(32)) as Hex;
        const oldSig = await walletClient.signTypedData({
            account: payer, domain: { name: 'USDC', version: '2', chainId: 10, verifyingContract: OP_USDC },
            types: EIP3009_TYPES, primaryType: 'ReceiveWithAuthorization',
            message: { from: payer.address, to: recipient, value: 0n, validAfter: 0n, validBefore, nonce: oldNonce },
        });
        const old = await submit(oldNonce, oldSig);

        // 3. Bridged USDC.e: the resolver must refuse.
        let usdcE: string;
        try {
            await resolveEip712Domain(client as any, OP_USDC_E);
            usdcE = 'RESOLVED (unexpected)';
        } catch (e) {
            usdcE = `refused: ${(e as Error).message}`;
        }

        const pass = sdk.ok && !old.ok && usdcE.startsWith('refused');
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
            `| \`X402Client.createPayment\` → \`receiveWithAuthorization\` on the fork | ${sdk.ok ? `accepted, fork tx ${sdk.hash} status ${sdk.status}` : `REJECTED: ${(sdk as any).reason}`} |`,
            `| Same authorization signed under the old default \`{ name: 'USDC', version: '2' }\` | ${old.ok ? 'ACCEPTED (unexpected)' : `rejected: ${(old as any).reason}`} |`,
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
