import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenSaleClient, usd } from './tokenSale.js';

const SEPOLIA = 11155111;
const SALE_GT = '0x3e4e0a663682a2d58d626d0057142328ef0b626a';
const SALE_AP = '0xf1a5fe670dbf6c5219000b30500a98f772ef1f14';
const BUY_HELPER = '0x578D6f74d8bDA18Cc3b834C1bd74674c529250e7';
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const GTOKEN_PAYOUT = '0x4e6A1125B8619d6D05c99AB2F30BDFc96C843B67';
const APNTS_PAYOUT = '0x4C4EC2e866f0c43DCA4670A6033e962a05B4C772';
const ACCOUNT = '0x1111111111111111111111111111111111111111';

// readContract dispatcher keyed by functionName.
function makeReadContract(overrides: Record<string, any> = {}) {
  const map: Record<string, any> = {
    gToken: GTOKEN_PAYOUT,
    aPNTs: APNTS_PAYOUT,
    getCurrentPriceUSD: 150000n, // $0.15
    priceUSD: 20000n, // $0.02
    getTokensForUSD: 33_333333333333333333n,
    getAPNTsForUSD: 250_000000000000000000n,
    allowance: 0n,
    balanceOf: 7n,
    ...overrides,
  };
  return vi.fn(async ({ functionName }: any) => map[functionName]);
}

function makePublicClient(readContract = makeReadContract()) {
  return {
    chain: { id: SEPOLIA },
    readContract,
    getBalance: vi.fn(async () => 1000n),
    waitForTransactionReceipt: vi.fn(async ({ hash }: any) => ({ status: 'success', hash })),
  } as any;
}

function makeWalletClient() {
  return {
    chain: { id: SEPOLIA },
    account: { address: ACCOUNT },
    writeContract: vi.fn(async () => '0xbeef'),
    signTypedData: vi.fn(async () => '0x' + '11'.repeat(32) + '22'.repeat(32) + '1b'),
  } as any;
}

describe('usd()', () => {
  it('converts to 6-decimal base units', () => {
    expect(usd(1.5)).toBe(1_500000n);
    expect(usd(5)).toBe(5_000000n);
  });
});

describe('TokenSaleClient constructor', () => {
  it('throws when chainId cannot be determined', () => {
    expect(() => new TokenSaleClient({ readContract: vi.fn() } as any)).toThrow('chainId');
  });

  it('throws when no address group for the chain', () => {
    expect(() => new TokenSaleClient({ chain: { id: 999 } } as any)).toThrow('no launch sale address group');
  });

  it('resolves the Sepolia address group', () => {
    const c = new TokenSaleClient(makePublicClient());
    expect(c.addresses.saleGToken.toLowerCase()).toBe(SALE_GT);
    expect(c.addresses.buyHelper).toBe(BUY_HELPER);
    expect(c.addresses.usdc).toBe(USDC);
  });
});

describe('getPrices / quote', () => {
  it('reads prices from both sale contracts', async () => {
    const c = new TokenSaleClient(makePublicClient());
    const prices = await c.getPrices();
    expect(prices).toEqual({ gToken: 150000n, aPNTs: 20000n });
  });

  it('quotes GTOKEN via getTokensForUSD', async () => {
    const read = makeReadContract();
    const c = new TokenSaleClient(makePublicClient(read));
    const out = await c.quote('GTOKEN', usd(5));
    expect(out).toBe(33_333333333333333333n);
    const call = read.mock.calls.find((a: any) => a[0].functionName === 'getTokensForUSD');
    expect(call[0].address.toLowerCase()).toBe(SALE_GT);
    expect(call[0].args).toEqual([5_000000n]);
  });
});

describe('getPayoutToken', () => {
  it('reads sale.gToken() and caches it', async () => {
    const read = makeReadContract();
    const c = new TokenSaleClient(makePublicClient(read));
    expect(await c.getPayoutToken('GTOKEN')).toBe(GTOKEN_PAYOUT);
    await c.getPayoutToken('GTOKEN');
    const calls = read.mock.calls.filter((a: any) => a[0].functionName === 'gToken');
    expect(calls.length).toBe(1); // cached on second call
  });

  it('reads sale.aPNTs() for APNTS', async () => {
    const c = new TokenSaleClient(makePublicClient());
    expect(await c.getPayoutToken('APNTS')).toBe(APNTS_PAYOUT);
  });
});

describe('buySelfPay', () => {
  it('approves then buys when allowance is short', async () => {
    const wallet = makeWalletClient();
    const c = new TokenSaleClient(makePublicClient(makeReadContract({ allowance: 0n })), wallet);
    const res = await c.buySelfPay({ token: 'GTOKEN', usdAmount: usd(5) });
    expect(res.txHash).toBe('0xbeef');
    const fns = wallet.writeContract.mock.calls.map((a: any) => a[0].functionName);
    expect(fns).toEqual(['approve', 'buyTokens']);
  });

  it('skips approve when allowance is sufficient', async () => {
    const wallet = makeWalletClient();
    const c = new TokenSaleClient(makePublicClient(makeReadContract({ allowance: 10_000000n })), wallet);
    await c.buySelfPay({ token: 'APNTS', usdAmount: usd(5), payToken: 'USDT' });
    const fns = wallet.writeContract.mock.calls.map((a: any) => a[0].functionName);
    expect(fns).toEqual(['buyAPNTs']);
  });

  it('throws without a wallet client', async () => {
    const c = new TokenSaleClient(makePublicClient());
    await expect(c.buySelfPay({ token: 'GTOKEN', usdAmount: usd(1) })).rejects.toThrow('walletClient is required');
  });
});

describe('buyGasless', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('signs EIP-3009 + BuyIntent and posts to the relayer', async () => {
    const wallet = makeWalletClient();
    const public_ = makePublicClient();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ txHash: '0xc0ffee', matchedRule: 'rule-1' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const c = new TokenSaleClient(public_, wallet);
    const res = await c.buyGasless({ token: 'GTOKEN', usdAmount: usd(5) });

    expect(res).toEqual({ txHash: '0xc0ffee', matchedRule: 'rule-1' });
    expect(wallet.signTypedData).toHaveBeenCalledTimes(2);
    // primaryType order: TransferWithAuthorization then BuyIntent
    const primaries = wallet.signTypedData.mock.calls.map((a: any) => a[0].primaryType);
    expect(primaries).toEqual(['TransferWithAuthorization', 'BuyIntent']);
    // posts to /v3/relay with the resolved targetToken
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/v3\/relay$/);
    const body = JSON.parse(init.body);
    expect(body.intent.targetToken).toBe(GTOKEN_PAYOUT);
    expect(body.intent.paymentToken).toBe(USDC);
  });

  it('throws when the relayer rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ code: 'E_RULE', error: 'no match' }),
    })));
    const c = new TokenSaleClient(makePublicClient(), makeWalletClient());
    await expect(c.buyGasless({ token: 'GTOKEN', usdAmount: usd(5) })).rejects.toThrow('relayer rejected');
  });
});
