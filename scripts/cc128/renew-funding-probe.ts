#!/usr/bin/env tsx
/**
 * CC-128 / AOA M4.9-SDK — who can pay for an explicit cap renewal (`xPNTsTokenV2.renewForSelf`)?
 *
 * LOCAL ANVIL ONLY (refuses any chain id other than 31337); every address comes from the SP repo's
 * `deployments/config.anvil.json` (SP tag v5.5.0-rc.4, `./deploy-core anvil --force`). Run it after
 * `scripts/sp550-local-e2e.ts` (same accounts, same setup), from an aastar-sdk checkout that has the
 * 5.5.0 adaptation (CC-122 R2, 49714635), so @aastar/* resolves to that source:
 *   SP550_CONFIG=/path/to/sp/deployments/config.anvil.json SP550_RPC=http://127.0.0.1:28545 \
 *     pnpm exec tsx /path/to/scripts/cc128/renew-funding-probe.ts
 *
 * P1  an SP-sponsored op whose call is `account.execute(token, 0, renewForSelf(sp))`.
 *     Read from source: SP locks the reserve during validation (lockedOf > 0) and `_renew` reverts
 *     `RenewBlocked` while lockedOf != 0 (xPNTsV2Base.sol:302-311), so the renewal cannot ride on SP
 *     sponsorship. Expect: UserOperationEvent.success == false, the op still charged, `used` unchanged.
 * P2  the same call executed directly by the account owner's EOA (`SimpleAccount.execute`, owner
 *     pays ETH). Expect: success, `autoAllowance(account, sp).used` reset to 0.
 * Exit 0 only if both expectations hold.
 */
import * as fs from 'fs';
import { type Address, type Hex, createPublicClient, createWalletClient, decodeErrorResult, decodeEventLog, encodeFunctionData, http } from 'viem';
import { privateKeyToAccount, mnemonicToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { EntryPointABI, SimpleAccountABI, SimpleAccountFactoryABI, xPNTsTokenV2ABI, encodeXPNTsV2RenewForSelf } from '@aastar/core';
import { PaymasterClient } from '@aastar/paymaster';

const RPC = process.env.SP550_RPC ?? 'http://127.0.0.1:28545';
const CONFIG = process.env.SP550_CONFIG;
const ANNI_PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const; // anvil #1 (public)
const ANVIL_MNEMONIC = 'test test test test test test test test test test test junk';

function fail(msg: string): never {
    console.error(`FAIL ${msg}`);
    process.exit(1);
}

async function main() {
    if (!CONFIG || !fs.existsSync(CONFIG)) fail('set SP550_CONFIG to the SP repo deployments/config.anvil.json');
    const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
    const ep = cfg.entryPoint as Address, sp = cfg.superPaymaster as Address, token = cfg.pnts as Address;
    const pub = createPublicClient({ chain: foundry, transport: http(RPC) });
    if ((await pub.getChainId()) !== 31337) fail('refusing to run: not local anvil');

    const user = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: 3 });
    const anni = privateKeyToAccount(ANNI_PK);
    const userWallet = createWalletClient({ account: user, chain: foundry, transport: http(RPC) });
    const account = (await pub.readContract({ address: cfg.simpleAccountFactory, abi: SimpleAccountFactoryABI, functionName: 'getAddress', args: [user.address, 0n] })) as Address;
    if (((await pub.getCode({ address: account })) ?? '0x') === '0x') fail('account not deployed — run scripts/sp550-local-e2e.ts first');

    const used = async () => ((await pub.readContract({ address: token, abi: xPNTsTokenV2ABI, functionName: 'autoAllowance', args: [account, sp] })) as readonly bigint[])[1];
    const bal = async () => (await pub.readContract({ address: token, abi: xPNTsTokenV2ABI, functionName: 'balanceOf', args: [account] })) as bigint;
    const renewCall = encodeFunctionData({ abi: SimpleAccountABI, functionName: 'execute', args: [token, 0n, encodeXPNTsV2RenewForSelf(sp)] });

    // ---- P1: renewal inside an SP-sponsored op ----
    const used0 = await used(), bal0 = await bal();
    console.log(`P1 before: autoAllowance(account, SP).used=${used0} balance=${bal0}`);
    if (used0 === 0n) fail('used is already 0 — nothing to renew; run sp550-local-e2e.ts first');
    const txHash = (await PaymasterClient.submitGaslessUserOperation(
        pub, userWallet, account, ep, sp, '0x0000000000000000000000000000000000000000', RPC, renewCall,
        { operator: anni.address, callGasLimit: 150_000n, verificationGasLimit: 300_000n, preVerificationGas: 60_000n },
    )) as Hex;
    const rc = await pub.waitForTransactionReceipt({ hash: txHash });
    let success: boolean | undefined, revertReason: Hex | undefined;
    for (const l of rc.logs.filter((x) => x.address.toLowerCase() === ep.toLowerCase())) {
        try {
            const ev = decodeEventLog({ abi: EntryPointABI, data: l.data, topics: l.topics }) as any;
            if (ev.eventName === 'UserOperationEvent') success = ev.args.success;
            if (ev.eventName === 'UserOperationRevertReason') revertReason = ev.args.revertReason;
        } catch { /* other events */ }
    }
    let reasonName = 'none';
    if (revertReason) {
        try { reasonName = decodeErrorResult({ abi: xPNTsTokenV2ABI, data: revertReason }).errorName; } catch { reasonName = `undecoded ${revertReason.slice(0, 10)}`; }
    }
    const used1 = await used(), bal1 = await bal();
    console.log(`P1 handleOps tx ${txHash} status=${rc.status}; UserOperationEvent.success=${success}; revert=${reasonName}`);
    console.log(`P1 after:  used=${used1} balance=${bal1} (charged ${bal0 - bal1} xPNTs for the failed renewal)`);
    if (success !== false) fail('P1 expected the sponsored renewal to fail');
    if (reasonName !== 'RenewBlocked') fail(`P1 expected RenewBlocked, got ${reasonName}`);
    if (used1 === 0n) fail('P1 used was reset — renewal unexpectedly succeeded');

    // ---- P2: the same renewal, owner EOA pays ETH ----
    const h2 = await userWallet.writeContract({ address: account, abi: SimpleAccountABI, functionName: 'execute', args: [token, 0n, encodeXPNTsV2RenewForSelf(sp)], account: user, chain: foundry });
    const rc2 = await pub.waitForTransactionReceipt({ hash: h2 });
    const used2 = await used();
    console.log(`P2 owner-EOA execute tx ${h2} status=${rc2.status} gasUsed=${rc2.gasUsed} paid by ${user.address}; used ${used1}→${used2}`);
    if (rc2.status !== 'success' || used2 !== 0n) fail('P2 expected a successful renewal resetting used to 0');

    console.log('PASS renewal cannot be SP-sponsored (P1); it needs a separately funded executor (P2).');
}

main().catch((e) => { console.error(e); process.exit(1); });
