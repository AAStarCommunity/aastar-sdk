import { describe, it, expect, vi } from 'vitest';
import {
  createWalletClient, http, encodeAbiParameters, keccak256,
  recoverTypedDataAddress, type Address, type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { X402Client } from '../X402Client.js';
import { deriveEip3009Nonce, X402_PAYMENT_AUTHORIZATION_TYPES } from '../x402auth.js';
import { EIP3009_TYPES, getEIP3009Domain } from '../eip3009.js';
import { getX402FacilitatorContract } from '../facilitators.js';
import { domainClient, type FacilitatorBehaviour } from './domainClient.js';

const PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // anvil #1 (test only)
const account = privateKeyToAccount(PK);
const CHAIN_ID = 11155111;
const FACILITATOR = getX402FacilitatorContract(CHAIN_ID); // 0xfe1DB01e…
const ASSET = '0xE6579A90dc498a710008de12119812D0FB7aA224' as Address; // pnts
const PAYTO = '0xF7Bf79AcB7F3702b9DbD397d8140ac9DE6Ce642C' as Address;

function client() {
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http('http://localhost:8545') });
  return new X402Client({ publicClient: domainClient(CHAIN_ID, 'USDC', '2'), walletClient, superPaymasterAddress: FACILITATOR, chainId: CHAIN_ID });
}

describe('deriveEip3009Nonce (matches X402Facilitator.settleX402Payment)', () => {
  it('== keccak256(abi.encode(payTo, maxFee, salt))', () => {
    const maxFee = 1000n;
    const salt = ('0x' + '11'.repeat(32)) as Hex;
    const want = keccak256(encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }], [PAYTO, maxFee, salt]));
    expect(deriveEip3009Nonce(PAYTO, maxFee, salt)).toBe(want);
  });
});

describe('X402Client.createPayment — direct (xPNTs)', () => {
  it('signs X402PaymentAuthorization over the FACILITATOR domain; sig recovers to payer; extra.settlement=direct', async () => {
    const { payload } = await client().createPayment({
      from: account.address, to: PAYTO, asset: ASSET, amount: 10n * 10n ** 18n,
      settlement: 'direct', maxFee: 0n, nonce: ('0x' + 'ab'.repeat(32)) as Hex, validBefore: 4102444800n,
    });
    expect(payload.accepted.extra.settlement).toBe('direct');
    expect(payload.accepted.extra.maxFee).toBe('0');
    const recovered = await recoverTypedDataAddress({
      domain: { name: 'X402Facilitator', version: '1', chainId: CHAIN_ID, verifyingContract: FACILITATOR },
      types: X402_PAYMENT_AUTHORIZATION_TYPES,
      primaryType: 'X402PaymentAuthorization',
      message: {
        from: account.address, to: PAYTO, asset: ASSET, amount: 10n * 10n ** 18n,
        maxFee: 0n, validBefore: 4102444800n, nonce: ('0x' + 'ab'.repeat(32)) as Hex,
      },
      signature: payload.payload.signature,
    });
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });
});

describe('X402Client.createPayment — eip-3009 (USDC)', () => {
  it('signs ReceiveWithAuthorization to the facilitator with the recipient-bound derived nonce; extra carries salt', async () => {
    const amount = 5n * 10n ** 6n;
    const { payload, nonce } = await client().createPayment({
      from: account.address, to: PAYTO, asset: ASSET, amount,
      settlement: 'eip-3009', maxFee: amount, salt: ('0x' + '22'.repeat(32)) as Hex,
      validAfter: 0n, validBefore: 4102444800n,
    });
    expect(payload.accepted.extra.settlement).toBe('eip-3009');
    expect(payload.accepted.extra.salt).toBe('0x' + '22'.repeat(32));
    // recipient is the facilitator (C-03), and the nonce is recipient-bound
    expect(payload.payload.authorization.to.toLowerCase()).toBe(FACILITATOR.toLowerCase());
    expect(nonce).toBe(deriveEip3009Nonce(PAYTO, amount, ('0x' + '22'.repeat(32)) as Hex));
    expect(payload.payload.authorization.nonce).toBe(nonce);
    const recovered = await recoverTypedDataAddress({
      domain: getEIP3009Domain('USDC', '2', CHAIN_ID, ASSET),
      types: EIP3009_TYPES,
      primaryType: 'ReceiveWithAuthorization',
      message: { from: account.address, to: FACILITATOR, value: amount, validAfter: 0n, validBefore: 4102444800n, nonce },
      signature: payload.payload.signature,
    });
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });
});

describe('settleViaFacilitator carries the settlement extra into paymentRequirements', () => {
  function facilClient() {
    const walletClient = createWalletClient({ account, chain: sepolia, transport: http('http://localhost:8545') });
    return new X402Client({
      publicClient: domainClient(CHAIN_ID, 'USDC', '2'), walletClient, superPaymasterAddress: FACILITATOR, chainId: CHAIN_ID,
      facilitator: { url: 'https://dvt1.aastar.io/x402' },
    });
  }

  it('sends settlement/maxFee/salt in paymentRequirements even when no requirements arg is passed (x402Fetch path)', async () => {
    const c = facilClient();
    const amount = 5n * 10n ** 6n;
    const { payload } = await c.createPayment({
      from: account.address, to: PAYTO, asset: ASSET, amount,
      settlement: 'eip-3009', maxFee: amount, salt: ('0x' + '33'.repeat(32)) as Hex,
    });
    let captured: any;
    const fetchMock = vi.fn(async (_url: any, init: any) => {
      captured = JSON.parse(init.body);
      return { ok: true, json: async () => ({ success: true, transaction: '0xabc' }) } as any;
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await c.settleViaFacilitator(payload); // no requirements arg
      expect(res.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith('https://dvt1.aastar.io/x402/settle', expect.anything());
      expect(captured.paymentRequirements.extra.settlement).toBe('eip-3009');
      expect(captured.paymentRequirements.extra.maxFee).toBe(amount.toString());
      expect(captured.paymentRequirements.extra.salt).toBe('0x' + '33'.repeat(32));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('X402Client.createPayment — the asset domain comes from the chain (OP Mainnet USDC is "USD Coin")', () => {
  const OP_USDC = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' as Address;
  const OP_FACILITATOR = '0x000000000000000000000000000000000000fac1' as Address;
  function opClient(extra: { tokenName?: string; tokenVersion?: string; chainId?: number } = {}) {
    const walletClient = createWalletClient({ account, chain: sepolia, transport: http('http://localhost:8545') });
    return new X402Client({
      publicClient: domainClient(10, 'USD Coin', '2'), walletClient, superPaymasterAddress: OP_FACILITATOR,
      chainId: extra.chainId ?? 10, facilitatorContract: OP_FACILITATOR,
      tokenName: extra.tokenName, tokenVersion: extra.tokenVersion,
    });
  }
  const pay = (c: X402Client) => c.createPayment({
    from: account.address, to: PAYTO, asset: OP_USDC, amount: 1n, settlement: 'eip-3009', maxFee: 1n,
    salt: ('0x' + '33'.repeat(32)) as Hex, validAfter: 0n, validBefore: 4102444800n,
  });

  it('signs under "USD Coin" / "2" with no configuration, and the signature recovers under that domain only', async () => {
    const { payload, nonce } = await pay(opClient());
    expect(payload.accepted.extra.name).toBe('USD Coin');
    expect(payload.accepted.extra.version).toBe('2');
    const message = { from: account.address, to: OP_FACILITATOR, value: 1n, validAfter: 0n, validBefore: 4102444800n, nonce };
    const under = (name: string) => recoverTypedDataAddress({
      domain: getEIP3009Domain(name, '2', 10, OP_USDC), types: EIP3009_TYPES, primaryType: 'ReceiveWithAuthorization',
      message, signature: payload.payload.signature,
    });
    expect((await under('USD Coin')).toLowerCase()).toBe(account.address.toLowerCase());
    expect((await under('USDC')).toLowerCase()).not.toBe(account.address.toLowerCase()); // the old default would not verify
  });

  it('a configured tokenName the chain does not report throws instead of signing', async () => {
    await expect(pay(opClient({ tokenName: 'USDC' }))).rejects.toThrow('expected name "USDC"');
  });

  it('a config chainId other than the RPC\'s throws', async () => {
    await expect(pay(opClient({ chainId: 11155420 }))).rejects.toThrow('config chainId 11155420');
  });
});

describe('X402Client.createPayment — direct path does not depend on the asset exposing an EIP-712 domain', () => {
  it('a plain ERC-20 asset (no version(), no DOMAIN_SEPARATOR()) still gets a direct-path payment', async () => {
    const walletClient = createWalletClient({ account, chain: sepolia, transport: http('http://localhost:8545') });
    const reads: string[] = [];
    // Facilitator reads are served (its code check); any read of the asset is recorded and reverts.
    const plainErc20 = {
      ...(domainClient(CHAIN_ID, 'unused', 'unused') as any),
      readContract: async ({ functionName }: { functionName: string }) => { reads.push(functionName); throw new Error('execution reverted'); },
    } as never;
    const c = new X402Client({ publicClient: plainErc20, walletClient, superPaymasterAddress: FACILITATOR, chainId: CHAIN_ID });
    const { payload } = await c.createPayment({ from: account.address, to: PAYTO, asset: ASSET, amount: 1n, settlement: 'direct', maxFee: 0n });
    expect(payload.accepted.extra.settlement).toBe('direct');
    expect(reads).toEqual([]);
  });
});

describe('X402Client.createPayment — direct path asks the facilitator\'s verifier before signing', () => {
  const directClient = (facilitator?: FacilitatorBehaviour) => {
    const walletClient = createWalletClient({ account, chain: sepolia, transport: http('http://localhost:8545') });
    return new X402Client({ publicClient: domainClient(CHAIN_ID, 'USDC', '2', { facilitator }), walletClient, superPaymasterAddress: FACILITATOR, chainId: CHAIN_ID });
  };
  const pay = (c: X402Client) => c.createPayment({ from: account.address, to: PAYTO, asset: ASSET, amount: 1n, settlement: 'direct', maxFee: 0n });

  it('a facilitator whose verifier accepts { X402Facilitator, 1 } gets the payment signed', async () => {
    await expect(pay(directClient())).resolves.toBeTruthy();
  });

  it('an RPC on another chain than the payment\'s gets no signature (checked before the probe)', async () => {
    const walletClient = createWalletClient({ account, chain: sepolia, transport: http('http://localhost:8545') });
    const c = new X402Client({ publicClient: domainClient(10, 'USDC', '2'), walletClient, superPaymasterAddress: FACILITATOR, chainId: CHAIN_ID });
    await expect(pay(c)).rejects.toThrow(`the RPC is on chain 10, the payment is for chain ${CHAIN_ID}`);
  });

  it('a facilitator verifying under another domain (version "2") gets no signature', async () => {
    await expect(pay(directClient({ kind: 'verifier', version: '2' }))).rejects.toThrow('its verifier rejects a probe signed under');
  });

  it('a simulation that does not reach the signature check (roles first, no revert data, no code) cannot confirm the domain', async () => {
    await expect(pay(directClient({ kind: 'role-first' }))).rejects.toThrow('reverted with Unauthorized, not InvalidX402Signature');
    await expect(pay(directClient({ kind: 'no-data' }))).rejects.toThrow('without revert data');
    await expect(pay(directClient({ kind: 'no-code' }))).rejects.toThrow('reverted with no-revert');
  });
});
