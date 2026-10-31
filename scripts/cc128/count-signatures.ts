#!/usr/bin/env tsx
/**
 * CC-128 / AOA M4.9-SDK — count the signer calls `PaymasterClient.submitGaslessUserOperation`
 * makes for ONE sponsored op, by running the SDK's real code against stubs.
 *
 * Offline: no RPC, no bundler, no key that holds value. `fetch` and the
 * public client are stubs; the account is a real viem LocalAccount (anvil's public test mnemonic,
 * index 3) wrapped to count `signMessage`. Nothing is signed for, or sent to, any network.
 *
 * What it measures (per scenario): how many times the SDK asks the signer to sign, which hashes,
 * and whether the estimation signature covers a different UserOp than the submitted one. It does
 * NOT measure wallet prompts: whether a signMessage call surfaces as a prompt depends on the
 * account implementation the integrator passes in (a LocalAccount never prompts; a KMS / passkey
 * account runs its ceremony per call).
 *
 * Run from the root of the checkout whose SDK source you want to measure (tsconfig `paths` maps
 * @aastar/* to that checkout's packages/<pkg>/src):
 *   pnpm exec tsx scripts/cc128/count-signatures.ts            # -> JSON on stdout, exit 0
 * Exit 1 if any scenario's observed count differs from the expectation recorded below.
 */
import { pathToFileURL } from 'url';
import * as path from 'path';
import type { Address, Hex } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';

const ROOT = process.cwd();
const ANVIL_MNEMONIC = 'test test test test test test test test test test test junk';
const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address;
const PAYMASTER = '0x09DF0d2e3722EC0e401fE3819E64278a42ae4DE9' as Address;
const OPERATOR = '0x00000000000000000000000000000000000000a1' as Address;
const TOKEN = '0x00000000000000000000000000000000000000b2' as Address;
const SENDER = '0x00000000000000000000000000000000000000c3' as Address;
const CALLDATA = '0xb61d27f6' as Hex; // any bytes; never executed

type SendMode = 'ok' | 'underpriced-once' | 'method-not-found';
type Scenario = { id: string; desc: string; explicitGas: boolean; send: SendMode; expect: number };

const SCENARIOS: Scenario[] = [
    { id: 'A', desc: 'autoEstimate (no gas limits passed), bundler accepts', explicitGas: false, send: 'ok', expect: 2 },
    { id: 'B', desc: 'caller passes verificationGasLimit + callGasLimit, bundler accepts', explicitGas: true, send: 'ok', expect: 1 },
    { id: 'C', desc: 'autoEstimate, bundler answers "replacement underpriced" once then accepts', explicitGas: false, send: 'underpriced-once', expect: 3 },
    { id: 'D', desc: 'autoEstimate, bundler has no eth_sendUserOperation (-32601) -> direct handleOps fallback', explicitGas: false, send: 'method-not-found', expect: 2 },
];

async function main() {
    const pmcPath = path.join(ROOT, 'packages/paymaster/src/V4/PaymasterClient.ts');
    const { PaymasterClient } = await import(pathToFileURL(pmcPath).href);

    const base = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: 3 });
    const signed: Hex[] = [];
    const account = {
        ...base,
        signMessage: async (args: { message: { raw: Hex } }) => {
            signed.push(args.message.raw);
            return base.signMessage(args as any);
        },
    };
    const sentTxs: string[] = [];
    const reads: string[] = []; // which chain reads the SDK made: shows which generation path ran
    const wallet = {
        account,
        chain: { id: 11155111 },
        writeContract: async (req: any) => {
            sentTxs.push(req.functionName);
            return ('0x' + 'ee'.repeat(32)) as Hex;
        },
    };
    let nonce = 7n;
    const client = {
        chain: { id: 11155111 },
        getChainId: async () => 11155111,
        estimateFeesPerGas: async () => ({ maxFeePerGas: 2_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n }),
        getGasPrice: async () => 1_000_000_000n,
        waitForTransactionReceipt: async () => ({ status: 'success' }),
        readContract: async ({ functionName }: { functionName: string }) => {
            reads.push(functionName);
            switch (functionName) {
                case 'getNonce': return nonce;
                case 'version': return 'SuperPaymaster-5.5.0';
                // operators(): [aPNTsBalance, isConfigured, isPaused, xPNTsToken, ...]
                case 'operators': return [10n ** 21n, true, false, TOKEN, 0, 0, 0, 0n, 0n, 0n];
                case 'gasParams': return [{ minPostOpGas: 200_000n, settleGasBound: 0n, cWrap: 0n, cPostop: 0n }];
                default: throw new Error(`stub: unexpected readContract(${functionName})`);
            }
        },
    };

    let send: SendMode = 'ok';
    let sendCalls = 0;
    (globalThis as any).fetch = async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body);
        const reply = (x: object) => ({ json: async () => ({ jsonrpc: '2.0', id: 1, ...x }) });
        if (body.method === 'eth_estimateUserOperationGas') {
            return reply({ result: { preVerificationGas: '0xc350', verificationGasLimit: '0x30d40', callGasLimit: '0x186a0', paymasterVerificationGasLimit: '0x30d40', paymasterPostOpGasLimit: '0x30d40' } });
        }
        if (body.method === 'eth_sendUserOperation') {
            sendCalls++;
            if (send === 'method-not-found') return reply({ error: { code: -32601, message: 'Method not found' } });
            if (send === 'underpriced-once' && sendCalls === 1) {
                return reply({ error: { code: -32602, message: 'replacement underpriced', data: { currentMaxPriorityFee: '0x3b9aca00', currentMaxFee: '0x77359400' } } });
            }
            return reply({ result: '0x' + 'ab'.repeat(32) });
        }
        throw new Error(`stub: unexpected bundler method ${body.method}`);
    };

    const quiet = console.log;
    const results = [];
    let mismatch = false;
    for (const s of SCENARIOS) {
        signed.length = 0; sentTxs.length = 0; reads.length = 0; sendCalls = 0; send = s.send; nonce += 1n;
        try { (await import(pathToFileURL(path.join(ROOT, 'packages/paymaster/src/SuperPaymaster/v550.ts')).href)).SuperPaymasterInflightGuard?.clearAll(); } catch { /* baseline has no guard */ }
        console.log = () => {};
        let error: string | undefined;
        try {
            await PaymasterClient.submitGaslessUserOperation(client, wallet, SENDER, ENTRY_POINT, PAYMASTER, TOKEN, 'http://bundler.stub', CALLDATA, {
                operator: OPERATOR,
                ...(s.explicitGas ? { verificationGasLimit: 200_000n, callGasLimit: 100_000n, preVerificationGas: 60_000n, paymasterVerificationGasLimit: 250_000n } : {}),
            });
        } catch (e: any) {
            error = String(e?.message ?? e).slice(0, 160);
        } finally {
            console.log = quiet;
        }
        const ok = !error && signed.length === s.expect;
        if (!ok) mismatch = true;
        results.push({
            scenario: s.id, desc: s.desc, signMessageCalls: signed.length, expected: s.expect,
            distinctHashes: new Set(signed).size, bundlerSendCalls: sendCalls, walletTxs: [...sentTxs], reads: [...new Set(reads)],
            ...(error ? { error } : {}), pass: ok,
        });
    }
    process.stdout.write(JSON.stringify({ root: ROOT, results }, null, 2) + '\n');
    process.exit(mismatch ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
