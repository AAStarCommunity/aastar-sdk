import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createWalletClient, http, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { X402Client } from '../X402Client.js';
import { createX402AuthHeaders } from '../authHeaders.js';

// Cross-repo golden vectors — byte-identical to the DVT facilitator's
// `conformance/x402/fixtures.json` (YetAnotherAA-Validator#130 / aastar-sdk#39).
const fixtures = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../conformance/fixtures.json'), 'utf8'),
);

// Deterministic test payer — all-0x11 key (matches the generator). NEVER holds funds.
const payer = privateKeyToAccount(('0x' + '11'.repeat(32)) as Hex);
const FACILITATOR = fixtures.config.facilitatorContract as Address;
const CHAIN_ID = fixtures.config.chainId as number;

function clientFor(tokenName: string, tokenVersion: string) {
  const walletClient = createWalletClient({ account: payer, chain: sepolia, transport: http('http://localhost:8545') });
  return new X402Client({
    publicClient: {} as never, walletClient,
    superPaymasterAddress: FACILITATOR, chainId: CHAIN_ID, facilitatorContract: FACILITATOR,
    tokenName, tokenVersion,
  });
}

const v = (name: string) => fixtures.vectors.find((x: any) => x.name === name);

describe('x402 cross-repo conformance — createPayment matches the DVT golden fixtures', () => {
  it('payer key derives the fixture `from` address', () => {
    expect(payer.address.toLowerCase()).toBe(v('direct-xpnts').body.paymentPayload.payload.authorization.from.toLowerCase());
  });

  it('direct-xpnts: byte-identical paymentPayload + paymentRequirements (signature included)', async () => {
    const f = v('direct-xpnts').body;
    const e = f.paymentRequirements.extra;
    const { payload } = await clientFor(e.name, e.version).createPayment({
      from: payer.address, to: f.paymentRequirements.payTo, asset: f.paymentRequirements.asset,
      amount: BigInt(f.paymentRequirements.amount), settlement: 'direct', maxFee: BigInt(e.maxFee),
      nonce: f.paymentPayload.payload.authorization.nonce as Hex,
      validBefore: BigInt(f.paymentPayload.payload.authorization.validBefore),
    });
    expect(payload.payload).toEqual(f.paymentPayload.payload);   // signature + authorization byte-exact
    expect(payload.accepted).toEqual(f.paymentRequirements);     // == the requirements wire object
  });

  it('eip3009-usdc: byte-identical paymentPayload (ReceiveWithAuthorization, recipient=facilitator, derived nonce)', async () => {
    const f = v('eip3009-usdc').body;
    const e = f.paymentRequirements.extra;
    const { payload } = await clientFor(e.name, e.version).createPayment({
      from: payer.address, to: f.paymentRequirements.payTo, asset: f.paymentRequirements.asset,
      amount: BigInt(f.paymentRequirements.amount), settlement: 'eip-3009', maxFee: BigInt(e.maxFee),
      salt: e.salt as Hex,
      validAfter: BigInt(f.paymentPayload.payload.authorization.validAfter),
      validBefore: BigInt(f.paymentPayload.payload.authorization.validBefore),
    });
    expect(payload.payload).toEqual(f.paymentPayload.payload);
    expect(payload.accepted).toEqual(f.paymentRequirements);
  });

  it('§4 auth header: createX402AuthHeaders matches the HMAC golden vector', async () => {
    const a = fixtures.authHeader;
    const fixedTs = Number(a.headers['X-X402-Timestamp']);
    const make = createX402AuthHeaders(a.secret, { now: () => fixedTs });
    const headers = await make({ endpoint: 'settle', body: a.rawBody });
    expect(headers).toEqual(a.headers);
    // and not emitted on the un-gated endpoints
    expect(await make({ endpoint: 'verify', body: a.rawBody })).toEqual({});
  });
});
