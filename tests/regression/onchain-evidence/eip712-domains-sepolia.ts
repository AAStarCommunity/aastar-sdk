/**
 * Evidence: the EIP-712 domains of the contracts without the full eip712Domain() + DOMAIN_SEPARATOR() pair, read
 * on Sepolia, and the KMS payment-signer pre-checks against them. Read-only (eth_call / eth_getCode on a public RPC);
 * nothing is signed or sent.
 *
 *   pnpm exec tsx tests/regression/onchain-evidence/eip712-domains-sepolia.ts
 *
 * Output: docs/onchain-evidence/eip712-domains-sepolia.md (no RPC URL, no error text).
 */
import { writeFileSync } from 'node:fs';
import { createPublicClient, decodeFunctionResult, domainSeparator, encodeFunctionData, http, keccak256, toHex, type Address, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { resolveReportedEip712Domain, getCanonicalAddresses, MicroPaymentChannelABI, GTokenAuthorizationABI } from '@aastar/core';
import { verifyFacilitatorDomain } from '@aastar/x402';
import { micropaymentVoucherDigest, micropaymentVoucherContractDigest } from '../../../packages/airaccount/src/server/services/kms-payment-signer.js';

const RPC = process.env.SEPOLIA_PUBLIC_RPC ?? 'https://ethereum-sepolia-rpc.publicnode.com'; // never written out
const OUT = 'docs/onchain-evidence/eip712-domains-sepolia.md';
const FACILITATOR = '0xfe1DB01e1d6622e722B92ed5993af61325DB92aF' as Address; // DEFAULT_X402_FACILITATORS[11155111]

// Only the SDK's own refusal reason is recorded, never error text.
const reasonOf = (e: unknown) => {
    const r = (e as any)?.data?.reason;
    return (e as any)?.name === 'AAStarError' && typeof r === 'string' && /^[a-z-]+$/.test(r) ? r : 'unexpected-error';
};
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x));

async function main() {
    const c = createPublicClient({ chain: sepolia, transport: http(RPC) });
    if ((await c.getChainId()) !== sepolia.id) throw new Error('the endpoint is not Sepolia');
    const book = getCanonicalAddresses(sepolia.id)!;
    const channel = book.microPaymentChannel as Address;
    const rows: Array<[string, string, boolean]> = [];
    // Each check pins its own reads to one block hash and records that block; the checks are not one snapshot.
    const at = async (blockHash: Hex) => `block ${(await c.getBlock({ blockHash })).number}`;
    const callAt = async (to: Address, abi: any, functionName: string, blockHash: Hex) => decodeFunctionResult({
        abi, functionName, data: await c.request({ method: 'eth_call', params: [{ to, data: encodeFunctionData({ abi, functionName, args: [] }) }, { blockHash, requireCanonical: true }] } as any) as Hex,
    } as any) as Hex;

    const ch = await resolveReportedEip712Domain(c as any, channel, { expectedChainId: sepolia.id, mayLackSeparator: true });
    const onChainTypeHash = await callAt(channel, MicroPaymentChannelABI, 'VOUCHER_TYPEHASH', ch.blockHash);
    const u128 = keccak256(toHex('Voucher(bytes32 channelId,uint128 cumulativeAmount)'));
    const u256 = keccak256(toHex('Voucher(bytes32 channelId,uint256 cumulativeAmount)'));
    rows.push([`MicroPaymentChannel ${channel}: eip712Domain() (${await at(ch.blockHash)})`, `${json(ch.domain)}; DOMAIN_SEPARATOR() present: ${ch.separatorChecked}`, ch.domain.name === 'MicroPaymentChannel' && ch.domain.version === '1.0.0']);
    rows.push([`MicroPaymentChannel VOUCHER_TYPEHASH (same block)`, `${onChainTypeHash} (= uint128 type: ${onChainTypeHash === u128}; = uint256 type: ${onChainTypeHash === u256})`, onChainTypeHash === u128]);

    const voucher = { keyId: 'k', chainId: sepolia.id, verifyingContract: channel, channelId: ('0x' + '11'.repeat(32)), cumulativeAmount: '1000000' };
    const kms = micropaymentVoucherDigest(voucher), contract = micropaymentVoucherContractDigest(voucher);
    rows.push(['KMS voucher digest vs the digest the channel verifies (same voucher, computed off-chain)', `KMS ${kms}; contract ${contract}`, kms !== contract]);

    const fac = await verifyFacilitatorDomain(c as any, FACILITATOR, sepolia.id);
    const { blockHash: facBlock, blockNumber: facNumber, ...facDomain } = fac;
    rows.push([`X402Facilitator ${FACILITATOR}: verifier probe at block ${facNumber} (${facBlock}) — simulated settle: the wrong-domain probe reverts InvalidX402Signature, the SDK-domain probe reaches the role check (Unauthorized)`, json(facDomain), true]);

    const gBlock = (await c.getBlock()).hash as Hex;
    const token = book.gToken as Address;
    const [gSep, gType] = [await callAt(token, GTokenAuthorizationABI, 'DOMAIN_SEPARATOR', gBlock), await callAt(token, GTokenAuthorizationABI, 'TRANSFER_WITH_AUTHORIZATION_TYPEHASH', gBlock)];
    const kmsSep = domainSeparator({ domain: { name: 'GToken', version: '1', chainId: sepolia.id, verifyingContract: token } });
    const kmsType = keccak256(toHex('TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)'));
    rows.push([`GToken ${token}: DOMAIN_SEPARATOR() and TRANSFER_WITH_AUTHORIZATION_TYPEHASH vs the KMS domain and type (${await at(gBlock)})`, `separator ${gSep === kmsSep ? 'equal' : 'DIFFERENT'}; type hash ${gType === kmsType ? 'equal' : 'DIFFERENT'}`, gSep === kmsSep && gType === kmsType]);

    const pass = rows.every(([, , ok]) => ok);
    const lines = [
        '# EIP-712 domains on Sepolia (contracts without the full getter pair) and the KMS pre-checks',
        '',
        `Generated by \`tests/regression/onchain-evidence/eip712-domains-sepolia.ts\` on ${new Date().toISOString()}, Sepolia, read-only through a public RPC (URL not recorded). Each row's reads are pinned to one block hash (EIP-1898); different rows may be at different blocks. The facilitator probe signs with a key generated in memory and sends nothing.`,
        '',
        '| Check | Result | OK |',
        '|---|---|---|',
        ...rows.map(([what, got, ok]) => `| ${what} | ${got} | ${ok ? 'yes' : '**NO**'} |`),
        '',
        `Verdict: ${pass ? 'PASS' : 'FAIL'}`,
        '',
    ];
    writeFileSync(OUT, lines.join('\n'));
    console.log(lines.join('\n'));
    if (!pass) process.exitCode = 1;
}

main().catch((e) => { console.error(`eip712-domains-sepolia: ${reasonOf(e)}`); process.exitCode = 1; });
