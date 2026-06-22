import { type Address, type Hash, type Hex } from 'viem';
import {
  ERC20ABI,
  SaleContractV2ABI,
  APNTsSaleContractABI,
  getLaunchSaleAddresses,
  getDvtRelayerUrlsForChain,
  type LaunchSaleAddresses,
  type PublicClient,
  type WalletClient,
} from '@aastar/core';

/** Which token to buy from the launch sale stack. */
export type SaleTokenKind = 'GTOKEN' | 'APNTS';
/** Stablecoin used to pay (both 6-decimal). Gasless supports USDC only. */
export type PayToken = 'USDC' | 'USDT';

/** Live USD prices (6-decimal) for one unit of each sale token. */
export interface SalePrices {
  /** USD price per GToken, 6-decimal (e.g. 150000n = $0.15). */
  gToken: bigint;
  /** USD price per aPNTs, 6-decimal. */
  aPNTs: bigint;
}

/** Wallet balances relevant to the sale (raw base units). */
export interface SaleBalances {
  /** Native ETH (wei). */
  eth: bigint;
  /** USDC (6-decimal). */
  usdc: bigint;
  /** USDT (6-decimal). */
  usdt: bigint;
  /** GToken (18-decimal). */
  gToken: bigint;
  /** aPNTs (18-decimal). */
  aPNTs: bigint;
}

/** Result of a completed buy (self-pay or gasless). */
export interface BuyResult {
  /** Transaction hash (gasless: the relayer-submitted tx). */
  txHash: Hash;
  /** Relayer rule that matched (gasless only). */
  matchedRule?: string;
}

export interface TokenSaleClientOptions {
  /**
   * Chain id. Defaults to `publicClient.chain?.id` / `walletClient.chain?.id`.
   * Used to look up {@link getLaunchSaleAddresses}.
   */
  chainId?: number;
  /** Explicit address group override (skips the per-chain lookup). */
  addresses?: LaunchSaleAddresses;
}

interface SelfPayParams {
  token: SaleTokenKind;
  /** USD to spend, in 6-decimal base units (use {@link usd}). */
  usdAmount: bigint;
  /** Payment stablecoin. Default `'USDC'`. */
  payToken?: PayToken;
  /** Minimum tokens out (slippage guard, 18-decimal). Default `0n`. */
  minOut?: bigint;
}

interface GaslessParams {
  token: SaleTokenKind;
  /** USD to spend, in 6-decimal base units (use {@link usd}). Paid in USDC. */
  usdAmount: bigint;
  /** Recipient of the purchased tokens. Default: the buyer. */
  recipient?: Address;
  /** Minimum tokens out (18-decimal). Default `0n`. */
  minOut?: bigint;
  /** Authorization validity window in seconds. Default `1800` (30 min). */
  deadlineSeconds?: number;
  /** Override the relayer base URL (default: the address group's `relayerUrl`). */
  relayerUrl?: string;
}

/** Convert a human USD amount to 6-decimal base units. `usd(1.5)` → `1500000n`. */
export function usd(amount: number): bigint {
  return BigInt(Math.round(amount * 1e6));
}

/**
 * TokenSaleClient — buy aPoints (aPNTs) and the governance token (GToken) from the
 * MushroomDAO launch sale stack. Abstraction of the `launch.mushroom.cv/join` page.
 *
 * Two flows:
 *  - {@link buySelfPay}: user pays gas; `approve` (if needed) then `buyTokens` / `buyAPNTs`.
 *  - {@link buyGasless}: zero-gas; signs EIP-3009 (USDC) + an EIP-712 `BuyIntent` and posts
 *    them to the relayer, which executes the buy via BuyHelper.
 *
 * The token actually paid out is read ON-CHAIN from the sale contract (`gToken()` / `aPNTs()`),
 * never from a stored address — so it stays correct across sale redeploys.
 *
 * @example
 * ```ts
 * const sale = new TokenSaleClient(publicClient, walletClient);
 * await sale.buyGasless({ token: 'GTOKEN', usdAmount: usd(5) }); // $5, zero gas
 * ```
 */
export class TokenSaleClient {
  private readonly addrs: LaunchSaleAddresses;
  private readonly chainId: number;
  /** Cache of on-chain-resolved payout token addresses. */
  private payoutToken: Partial<Record<SaleTokenKind, Address>> = {};

  constructor(
    private readonly publicClient: PublicClient,
    private readonly walletClient?: WalletClient,
    options: TokenSaleClientOptions = {},
  ) {
    const chainId =
      options.chainId ??
      (publicClient as any)?.chain?.id ??
      (walletClient as any)?.chain?.id;
    if (!chainId) {
      throw new Error('TokenSaleClient: cannot determine chainId; pass options.chainId');
    }
    this.chainId = chainId;
    const addrs = options.addresses ?? getLaunchSaleAddresses(chainId);
    if (!addrs) {
      throw new Error(
        `TokenSaleClient: no launch sale address group for chainId ${chainId}; pass options.addresses`,
      );
    }
    this.addrs = addrs;
  }

  /** The resolved address group in use. */
  get addresses(): LaunchSaleAddresses {
    return this.addrs;
  }

  /** Sale contract address for a token kind. */
  private saleFor(token: SaleTokenKind): Address {
    return token === 'GTOKEN' ? this.addrs.saleGToken : this.addrs.saleAPNTs;
  }

  /**
   * Resolve (and cache) the ERC-20 the sale actually pays out, by reading the sale
   * contract's `gToken()` / `aPNTs()` immutable getter. This is the single source of
   * truth for the payout token — no address is duplicated in the config.
   */
  async getPayoutToken(token: SaleTokenKind): Promise<Address> {
    const cached = this.payoutToken[token];
    if (cached) return cached;
    const resolved = (await this.publicClient.readContract({
      address: this.saleFor(token),
      abi: token === 'GTOKEN' ? SaleContractV2ABI : APNTsSaleContractABI,
      functionName: token === 'GTOKEN' ? 'gToken' : 'aPNTs',
    } as any)) as Address;
    this.payoutToken[token] = resolved;
    return resolved;
  }

  /** Read live USD prices (6-decimal) for both sale tokens. */
  async getPrices(): Promise<SalePrices> {
    const [gToken, aPNTs] = await Promise.all([
      this.publicClient.readContract({
        address: this.addrs.saleGToken,
        abi: SaleContractV2ABI,
        functionName: 'getCurrentPriceUSD',
      } as any) as Promise<bigint>,
      this.publicClient.readContract({
        address: this.addrs.saleAPNTs,
        abi: APNTsSaleContractABI,
        functionName: 'priceUSD',
      } as any) as Promise<bigint>,
    ]);
    return { gToken, aPNTs };
  }

  /**
   * Quote how many tokens (18-decimal) a USD amount buys, via the sale's on-chain
   * pricing (`getTokensForUSD` / `getAPNTsForUSD`).
   */
  async quote(token: SaleTokenKind, usdAmount: bigint): Promise<bigint> {
    return (await this.publicClient.readContract({
      address: this.saleFor(token),
      abi: token === 'GTOKEN' ? SaleContractV2ABI : APNTsSaleContractABI,
      functionName: token === 'GTOKEN' ? 'getTokensForUSD' : 'getAPNTsForUSD',
      args: [usdAmount],
    } as any)) as bigint;
  }

  /** Read ETH / USDC / USDT / GToken / aPNTs balances for an account. */
  async getBalances(account: Address): Promise<SaleBalances> {
    const erc20 = (address: Address) =>
      this.publicClient.readContract({
        address,
        abi: ERC20ABI,
        functionName: 'balanceOf',
        args: [account],
      } as any) as Promise<bigint>;
    const [gTokenAddr, aPNTsAddr] = await Promise.all([
      this.getPayoutToken('GTOKEN'),
      this.getPayoutToken('APNTS'),
    ]);
    const [eth, usdc, usdt, gToken, aPNTs] = await Promise.all([
      this.publicClient.getBalance({ address: account }),
      erc20(this.addrs.usdc),
      erc20(this.addrs.usdt).catch(() => 0n),
      erc20(gTokenAddr),
      erc20(aPNTsAddr),
    ]);
    return { eth, usdc, usdt, gToken, aPNTs };
  }

  // ─── Self-pay flow (buyer pays gas) ──────────────────────────────────────
  /**
   * Buy with the user paying gas: ensures allowance (approves if short) then calls
   * `buyTokens` / `buyAPNTs`. Tokens are sent to the buyer. Waits for both receipts.
   */
  async buySelfPay(params: SelfPayParams): Promise<BuyResult> {
    const wallet = this.requireWallet();
    const { account: signer, address: account } = this.signer(wallet);
    const { token, usdAmount } = params;
    const payToken = params.payToken ?? 'USDC';
    const minOut = params.minOut ?? 0n;
    // aPNTs self-pay has NO slippage param on-chain (`APNTsSaleContract.buyAPNTs(usdAmount,
    // paymentToken)`), so a caller-supplied minOut could NOT be enforced. Fail closed rather than
    // silently dropping it (which would give a false sense of protection). GToken self-pay and the
    // gasless path (BuyIntent.minOut) do enforce minOut.
    if (token === 'APNTS' && minOut > 0n) {
      throw new Error(
        'buySelfPay: aPNTs self-pay does not support minOut (APNTsSaleContract.buyAPNTs has no ' +
          'slippage param). Use buyGasless for aPNTs slippage protection, or omit minOut.'
      );
    }
    const payAddr = payToken === 'USDC' ? this.addrs.usdc : this.addrs.usdt;
    const saleAddr = this.saleFor(token);

    const allowance = (await this.publicClient.readContract({
      address: payAddr,
      abi: ERC20ABI,
      functionName: 'allowance',
      args: [account, saleAddr],
    } as any)) as bigint;

    if (allowance < usdAmount) {
      const approveHash = (await wallet.writeContract({
        address: payAddr,
        abi: ERC20ABI,
        functionName: 'approve',
        args: [saleAddr, usdAmount],
        account: signer,
        chain: (wallet as any).chain,
      } as any)) as Hash;
      const r = await this.publicClient.waitForTransactionReceipt({ hash: approveHash });
      if (r.status !== 'success') throw new Error(`approve reverted: ${approveHash}`);
    }

    const buyHash = (await wallet.writeContract(
      token === 'GTOKEN'
        ? {
            address: saleAddr,
            abi: SaleContractV2ABI,
            functionName: 'buyTokens',
            args: [usdAmount, payAddr, minOut],
            account: signer,
            chain: (wallet as any).chain,
          }
        : ({
            address: saleAddr,
            abi: APNTsSaleContractABI,
            functionName: 'buyAPNTs',
            args: [usdAmount, payAddr],
            account: signer,
            chain: (wallet as any).chain,
          } as any),
    )) as Hash;

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: buyHash });
    if (receipt.status !== 'success') throw new Error(`buy reverted: ${buyHash}`);
    return { txHash: buyHash };
  }

  // ─── Gasless flow (EIP-3009 + BuyIntent → relayer) ───────────────────────
  /**
   * Buy with zero gas: signs an EIP-3009 USDC `TransferWithAuthorization` (to BuyHelper)
   * and an EIP-712 `BuyIntent`, then posts both to the relayer's `/v3/relay`. Returns the
   * relayer-submitted tx hash after on-chain confirmation. Payment is always USDC.
   */
  async buyGasless(params: GaslessParams): Promise<BuyResult> {
    const wallet = this.requireWallet();
    const { account: signer, address: account } = this.signer(wallet);
    const { token, usdAmount } = params;
    const minOut = params.minOut ?? 0n;
    const recipient = params.recipient ?? account;
    const targetToken = await this.getPayoutToken(token);
    const usdc = this.addrs.usdc;
    const buyHelper = this.addrs.buyHelper;

    const deadline = BigInt(Math.floor(Date.now() / 1000) + (params.deadlineSeconds ?? 1800));
    const nonce = randomNonce();

    // ① EIP-3009 USDC TransferWithAuthorization → BuyHelper
    const transferSig = await (wallet as any).signTypedData({
      account: signer,
      domain: { name: 'USDC', version: '2', chainId: this.chainId, verifyingContract: usdc },
      types: {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      },
      primaryType: 'TransferWithAuthorization',
      message: {
        from: account,
        to: buyHelper,
        value: usdAmount,
        validAfter: 0n,
        validBefore: deadline,
        nonce,
      },
    });

    // ② EIP-712 BuyIntent (domain MyceliumBuyHelper v1, verifyingContract = BuyHelper)
    const buyIntentSig = await (wallet as any).signTypedData({
      account: signer,
      domain: { name: 'MyceliumBuyHelper', version: '1', chainId: this.chainId, verifyingContract: buyHelper },
      types: {
        BuyIntent: [
          { name: 'buyer', type: 'address' },
          { name: 'paymentToken', type: 'address' },
          { name: 'paymentAmount', type: 'uint256' },
          { name: 'targetToken', type: 'address' },
          { name: 'recipient', type: 'address' },
          { name: 'minOut', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      },
      primaryType: 'BuyIntent',
      message: {
        buyer: account,
        paymentToken: usdc,
        paymentAmount: usdAmount,
        targetToken,
        recipient,
        minOut,
        deadline,
        nonce,
      },
    });

    // Split the EIP-3009 signature into v/r/s (the relayer calls the 7-arg 3009 variant).
    const r_ = transferSig.slice(0, 66) as Hex;
    const s_ = ('0x' + transferSig.slice(66, 130)) as Hex;
    let v_ = parseInt(transferSig.slice(130, 132), 16);
    if (v_ < 27) v_ += 27;

    const payload = JSON.stringify({
      intent: {
        buyer: account,
        paymentToken: usdc,
        paymentAmount: usdAmount.toString(),
        targetToken,
        recipient,
        minOut: minOut.toString(),
        deadline: Number(deadline),
        nonce,
      },
      buyIntentSig,
      transferAuth: { validAfter: 0, v: v_, r: r_, s: s_ },
    });

    // Load-balance across the DVT relayer pool (random start) + fail over on 5xx / network errors.
    // A 4xx is the request's own fault (bad sig / not whitelisted / rate-limited) — identical on
    // every node, so don't retry it. A submitted tx that reverts on-chain is final (not retried).
    const candidates = this.relayerCandidates(params.relayerUrl);
    let lastErr: Error | undefined;
    for (const base of candidates) {
      let resp: Response;
      try {
        resp = await fetch(base.replace(/\/$/, '') + '/v3/relay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });
      } catch (e: any) {
        lastErr = new Error(`relayer ${base} unreachable: ${e?.message ?? e}`);
        continue; // network/timeout → try next node
      }
      const body: any = await resp.json().catch(() => ({}));
      if (resp.ok && body?.txHash) {
        const receipt = await this.publicClient.waitForTransactionReceipt({ hash: body.txHash as Hash });
        if (receipt.status !== 'success') throw new Error(`gasless buy reverted on-chain: ${body.txHash}`);
        return { txHash: body.txHash as Hash, matchedRule: body.matchedRule };
      }
      const err = new Error(`relayer rejected: [${body?.code ?? resp.status}] ${body?.error ?? resp.statusText}`);
      if (resp.status >= 400 && resp.status < 500) throw err; // client error — same on every node
      lastErr = err; // 5xx (incl. INFRA_NOT_READY) → try next node
    }
    throw lastErr ?? new Error('no relayer available');
  }

  /**
   * Build the ordered relayer candidate list: an explicit override wins; otherwise load-balance
   * across the DVT relay pool — the SINGLE source of truth `getDvtRelayerUrlsForChain(chainId)`
   * (random start) — with the legacy `relayerUrl` (Cloudflare Worker) appended as a final fallback.
   * Pure ordering — no network. (Math.random for LB spread is fine here.)
   */
  private relayerCandidates(override?: string): string[] {
    if (override) return [override];
    const pool = [...getDvtRelayerUrlsForChain(this.chainId)];
    if (pool.length > 1) {
      const start = Math.floor(Math.random() * pool.length);
      pool.push(...pool.splice(0, start)); // rotate start for round-robin-ish spread
    }
    if (this.addrs.relayerUrl && !pool.includes(this.addrs.relayerUrl)) pool.push(this.addrs.relayerUrl);
    if (pool.length === 0 && this.addrs.relayerUrl) return [this.addrs.relayerUrl];
    return pool;
  }

  private requireWallet(): WalletClient {
    if (!this.walletClient) {
      throw new Error('TokenSaleClient: a walletClient is required for write operations');
    }
    return this.walletClient;
  }

  /**
   * Resolve the signing account. Returns the viem account OBJECT (a LocalAccount, or a
   * JsonRpcAccount for injected wallets) for the `account` field of write/sign calls, plus
   * its address for message fields. Passing the object — not a bare address string — is what
   * lets a local private-key account sign locally instead of routing to `eth_signTypedData_v4`
   * on the (key-less) RPC transport.
   */
  private signer(wallet: WalletClient): { account: any; address: Address } {
    const acc = (wallet as any).account;
    const address = (acc?.address ?? acc) as Address;
    if (!address) throw new Error('TokenSaleClient: walletClient has no account');
    return { account: acc ?? address, address };
  }
}

/** 32-byte random hex nonce for EIP-3009 / BuyIntent. */
function randomNonce(): Hex {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return ('0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')) as Hex;
}
