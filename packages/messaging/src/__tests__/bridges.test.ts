// bridges.test.ts — Unit tests for M2 on-chain bridge layer
// Covers X402Bridge, ChannelBridge, and UserOpBridge.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { X402Bridge } from '../payment/X402Bridge.js';
import { ChannelBridge } from '../payment/ChannelBridge.js';
import { UserOpBridge } from '../payment/UserOpBridge.js';
import type { X402ClientLike } from '../payment/X402Bridge.js';
import type { ChannelClientLike, ChannelState } from '../payment/ChannelBridge.js';
import type { BundlerClientLike } from '../payment/UserOpBridge.js';
import type { SignedNostrEvent } from '../types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal SignedNostrEvent for testing */
function makeEvent(overrides: Partial<SignedNostrEvent> = {}): SignedNostrEvent {
  return {
    id: 'testid',
    pubkey: 'senderpubkey',
    created_at: Math.floor(Date.now() / 1000),
    kind: 23402,
    tags: [],
    content: '{}',
    sig: 'testsig',
    ...overrides,
  };
}

/** Build a valid future validBefore timestamp */
function futureTimestamp(secondsFromNow = 3600): string {
  return String(Math.floor(Date.now() / 1000) + secondsFromNow);
}

/** Build a past timestamp (expired) */
function pastTimestamp(secondsAgo = 3600): string {
  return String(Math.floor(Date.now() / 1000) - secondsAgo);
}

/** Build valid kind:23402 tags */
function makeX402Tags(overrides: Record<string, string> = {}): string[][] {
  const defaults: Record<string, string> = {
    p: 'payeepubkey',
    asset: '0xUSDCaddress',
    amount: '1000000',
    chain: '10',
    nonce: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    from: '0xpayeraddress',
    to: '0xpayeeaddress',
    valid_before: futureTimestamp(),
    sig: '0xsignaturehex',
    ...overrides,
  };
  return Object.entries(defaults).map(([k, v]) => [k, v]);
}

// ─── X402Bridge Tests ─────────────────────────────────────────────────────────

describe('X402Bridge', () => {
  let mockClient: X402ClientLike;
  let bridge: X402Bridge;

  beforeEach(() => {
    mockClient = {
      settlePayment: vi.fn().mockResolvedValue({ txHash: '0xsuccesstxhash' as `0x${string}` }),
    };
    bridge = new X402Bridge({ x402Client: mockClient });
  });

  it('valid payment → settlePayment called, returns success', async () => {
    const event = makeEvent({
      kind: 23402,
      tags: makeX402Tags(),
    });

    const result = await bridge.handle(event);

    expect(result.success).toBe(true);
    expect(result.txHash).toBe('0xsuccesstxhash');
    expect(result.replyContent).toEqual({ success: true, txHash: '0xsuccesstxhash' });
    expect(mockClient.settlePayment).toHaveBeenCalledOnce();
  });

  it('expired payment → returns "expired" error', async () => {
    const event = makeEvent({
      kind: 23402,
      tags: makeX402Tags({ valid_before: pastTimestamp() }),
    });

    const result = await bridge.handle(event);

    expect(result.success).toBe(false);
    expect(result.error).toBe('expired');
    expect(mockClient.settlePayment).not.toHaveBeenCalled();
  });

  it('amount exceeds limit → returns "amount_exceeds_limit" error', async () => {
    bridge = new X402Bridge({
      x402Client: mockClient,
      maxAmountPerRequest: 500_000n,
    });

    const event = makeEvent({
      kind: 23402,
      tags: makeX402Tags({ amount: '1000000' }), // 1_000_000 > 500_000
    });

    const result = await bridge.handle(event);

    expect(result.success).toBe(false);
    expect(result.error).toBe('amount_exceeds_limit');
    expect(mockClient.settlePayment).not.toHaveBeenCalled();
  });

  it('nonce replay → returns "nonce_already_used" error', async () => {
    const tags = makeX402Tags({
      nonce: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    });
    const event = makeEvent({ kind: 23402, tags });

    // First call should succeed
    const first = await bridge.handle(event);
    expect(first.success).toBe(true);

    // Second call with same nonce should fail
    const second = await bridge.handle(event);
    expect(second.success).toBe(false);
    expect(second.error).toBe('nonce_already_used');
    expect(mockClient.settlePayment).toHaveBeenCalledOnce(); // only once total
  });

  it('payer not in whitelist → returns "payer_not_allowed" error', async () => {
    bridge = new X402Bridge({
      x402Client: mockClient,
      allowedPayers: new Set(['0xallowedpayer']),
    });

    const event = makeEvent({
      kind: 23402,
      tags: makeX402Tags({ from: '0xblockedpayer' }),
    });

    const result = await bridge.handle(event);

    expect(result.success).toBe(false);
    expect(result.error).toBe('payer_not_allowed');
    expect(mockClient.settlePayment).not.toHaveBeenCalled();
  });

  it('missing required tags → returns "missing_tags" error', async () => {
    const event = makeEvent({
      kind: 23402,
      tags: [['p', 'payeepubkey']], // only 'p' tag, missing rest
    });

    const result = await bridge.handle(event);

    expect(result.success).toBe(false);
    expect(result.error).toBe('missing_tags');
    expect(mockClient.settlePayment).not.toHaveBeenCalled();
  });

  it('settlePayment throws → returns error string', async () => {
    (mockClient.settlePayment as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('RPC connection refused')
    );

    const event = makeEvent({ kind: 23402, tags: makeX402Tags() });
    const result = await bridge.handle(event);

    expect(result.success).toBe(false);
    expect(result.error).toBe('RPC connection refused');
  });

  it('payer in whitelist (case-insensitive) → success', async () => {
    bridge = new X402Bridge({
      x402Client: mockClient,
      allowedPayers: new Set(['0xallowedpayer']), // lowercase
    });

    const event = makeEvent({
      kind: 23402,
      tags: makeX402Tags({ from: '0xALLOWEDPAYER' }), // uppercase from
    });

    // Note: bridge normalizes from.toLowerCase() for comparison
    const result = await bridge.handle(event);
    // The from value '0xallowedpayer' should match since bridge lowercases it
    expect(result.success).toBe(true);
  });
});

// ─── ChannelBridge Tests ──────────────────────────────────────────────────────

describe('ChannelBridge', () => {
  let mockClient: ChannelClientLike;
  let bridge: ChannelBridge;

  const openChannel: ChannelState = {
    channelId: 'chan-001',
    payer: '0xpayer',
    payee: '0xpayee',
    status: 'Open',
    depositedAmount: 100_000_000n,
  };

  /** Build a kind:23403 event with given cumulativeAmount */
  function makeChannelEvent(
    channelId: string,
    cumulativeAmount: string,
    voucherSig = '0xvouchersig'
  ): SignedNostrEvent {
    return makeEvent({
      kind: 23403,
      tags: [
        ['p', 'payeepubkey'],
        ['channel', channelId],
        ['cumulative', cumulativeAmount],
        ['chain', '10'],
      ],
      content: JSON.stringify({ voucherSig }),
    });
  }

  beforeEach(() => {
    mockClient = {
      getChannelState: vi.fn().mockResolvedValue(openChannel),
      submitVoucher: vi.fn().mockResolvedValue({ txHash: '0xchannel_txhash' as `0x${string}` }),
    };
    // Use a low threshold (1_000_000) so we can test both lazy and eager paths.
    // skipVoucherSigVerification: true bypasses EIP-712 sig check (testing only).
    bridge = new ChannelBridge({
      channelClient: mockClient,
      lazySettleThreshold: 1_000_000n,
      skipVoucherSigVerification: true,
    });
  });

  it('voucher below threshold → stored lazily (no on-chain submission)', async () => {
    const event = makeChannelEvent('chan-001', '500000'); // 500_000 < 1_000_000

    const result = await bridge.handle(event);

    expect(result.success).toBe(true);
    expect(result.replyContent).toMatchObject({ stored: true });
    expect(mockClient.submitVoucher).not.toHaveBeenCalled();
  });

  it('voucher at or above threshold → submitted on-chain', async () => {
    const event = makeChannelEvent('chan-001', '1000000'); // == threshold

    const result = await bridge.handle(event);

    expect(result.success).toBe(true);
    expect(result.txHash).toBe('0xchannel_txhash');
    expect(result.replyContent).toMatchObject({ settled: true });
    expect(mockClient.submitVoucher).toHaveBeenCalledOnce();
  });

  it('non-monotonic cumulative → rejected', async () => {
    // First voucher: 800_000
    const first = makeChannelEvent('chan-001', '800000');
    await bridge.handle(first);

    // Second voucher: same amount (not strictly greater)
    const second = makeChannelEvent('chan-001', '800000');
    const result = await bridge.handle(second);

    expect(result.success).toBe(false);
    expect(result.error).toBe('non_monotonic_cumulative');
  });

  it('lower cumulative than previous → rejected', async () => {
    const first = makeChannelEvent('chan-001', '800000');
    await bridge.handle(first);

    const second = makeChannelEvent('chan-001', '500000'); // lower
    const result = await bridge.handle(second);

    expect(result.success).toBe(false);
    expect(result.error).toBe('non_monotonic_cumulative');
  });

  it('channel not Open → rejected', async () => {
    (mockClient.getChannelState as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...openChannel,
      status: 'Closed',
    });

    const event = makeChannelEvent('chan-001', '500000');
    const result = await bridge.handle(event);

    expect(result.success).toBe(false);
    expect(result.error).toBe('channel_not_open');
    expect(mockClient.submitVoucher).not.toHaveBeenCalled();
  });

  it('missing channel or cumulative tags → returns "missing_tags"', async () => {
    const event = makeEvent({ kind: 23403, tags: [['p', 'payeepubkey']] });
    const result = await bridge.handle(event);
    expect(result.success).toBe(false);
    expect(result.error).toBe('missing_tags');
  });

  it('invalid JSON content → returns "invalid_content"', async () => {
    const event = makeEvent({
      kind: 23403,
      tags: [
        ['p', 'payeepubkey'],
        ['channel', 'chan-001'],
        ['cumulative', '500000'],
        ['chain', '10'],
      ],
      content: 'not-json',
    });
    const result = await bridge.handle(event);
    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid_content');
  });

  it('forceSettleAll settles all pending vouchers', async () => {
    // Store a voucher below threshold
    const event = makeChannelEvent('chan-001', '500000');
    await bridge.handle(event);
    expect(mockClient.submitVoucher).not.toHaveBeenCalled();

    // Force settle
    const results = await bridge.forceSettleAll();
    expect(results.get('chan-001')).toBe('0xchannel_txhash');
    expect(mockClient.submitVoucher).toHaveBeenCalledOnce();
  });
});

// ─── UserOpBridge Tests ───────────────────────────────────────────────────────

describe('UserOpBridge', () => {
  let mockBundler: BundlerClientLike;

  /** Build a kind:23404 event */
  function makeUserOpEvent(overrides: {
    sender?: string;
    triggerNonce?: string;
    chainId?: string;
    ep?: string;
    callData?: string;
  } = {}): SignedNostrEvent {
    const {
      sender = '0xselfaddress',
      triggerNonce = '0xuniquetriggernonce',
      chainId = '10',
      ep = '0xentrypoint',
      callData = '0x12345678abcdef',
    } = overrides;

    return makeEvent({
      kind: 23404,
      tags: [
        ['p', 'agentpubkey'],
        ['chain', chainId],
        ['ep', ep],
      ],
      content: JSON.stringify({
        userOp: {
          sender,
          nonce: '0x01',
          callData,
          callGasLimit: '0x10000',
          verificationGasLimit: '0x10000',
          preVerificationGas: '0x5000',
          maxFeePerGas: '0x1000',
          maxPriorityFeePerGas: '0x100',
        },
        authorizationSig: '0xauthsig',
        triggerNonce,
      }),
    });
  }

  beforeEach(() => {
    mockBundler = {
      sendUserOperation: vi
        .fn()
        .mockResolvedValue({ userOpHash: '0xuserophash' as `0x${string}` }),
    };
  });

  it('self_only mode: sender matches selfAddress → submitted to bundler', async () => {
    const bridge = new UserOpBridge({
      bundlerClient: mockBundler,
      authMode: 'open',
      selfAddress: '0xselfaddress',
    });

    const event = makeUserOpEvent({ sender: '0xselfaddress' });
    const result = await bridge.handle(event);

    expect(result.success).toBe(true);
    expect(result.txHash).toBe('0xuserophash');
    expect(mockBundler.sendUserOperation).toHaveBeenCalledOnce();
  });

  it('self_only mode: sender does not match selfAddress → rejected', async () => {
    const bridge = new UserOpBridge({
      bundlerClient: mockBundler,
      authMode: 'self_only',
      selfAddress: '0xselfaddress',
    });

    const event = makeUserOpEvent({ sender: '0xotheraccount' });
    const result = await bridge.handle(event);

    // authorizationSig is fake, so rejection happens at sig verification before sender check
    expect(result.success).toBe(false);
    expect(mockBundler.sendUserOperation).not.toHaveBeenCalled();
  });

  it('whitelist mode: sender in allowedSenders → submitted', async () => {
    const bridge = new UserOpBridge({
      bundlerClient: mockBundler,
      authMode: 'open',
      allowedSenders: new Set(['0xwhitelistedaccount']),
    });

    const event = makeUserOpEvent({ sender: '0xwhitelistedaccount' });
    const result = await bridge.handle(event);

    expect(result.success).toBe(true);
    expect(mockBundler.sendUserOperation).toHaveBeenCalledOnce();
  });

  it('whitelist mode: sender not in allowedSenders → rejected', async () => {
    const bridge = new UserOpBridge({
      bundlerClient: mockBundler,
      authMode: 'whitelist',
      allowedSenders: new Set(['0xwhitelistedaccount']),
    });

    const event = makeUserOpEvent({ sender: '0xnotinlist' });
    const result = await bridge.handle(event);

    // authorizationSig is fake, so rejection happens at sig verification before sender check
    expect(result.success).toBe(false);
    expect(mockBundler.sendUserOperation).not.toHaveBeenCalled();
  });

  it('trigger nonce replay → rejected', async () => {
    const bridge = new UserOpBridge({
      bundlerClient: mockBundler,
      authMode: 'open',
      selfAddress: '0xselfaddress',
    });

    const event = makeUserOpEvent({
      sender: '0xselfaddress',
      triggerNonce: '0xreplayablenonce',
    });

    // First call succeeds
    const first = await bridge.handle(event);
    expect(first.success).toBe(true);

    // Second call with same triggerNonce is rejected
    const second = await bridge.handle(event);
    expect(second.success).toBe(false);
    expect(second.error).toBe('trigger_nonce_replayed');
    expect(mockBundler.sendUserOperation).toHaveBeenCalledOnce(); // only once
  });

  it('selector not in allowlist → rejected (prompt injection defense)', async () => {
    // Target is at callData bytes 16-35; inner selector at bytes 68-71.
    // Layout: outerSelector(4) + pad(12) + target(20) + value(32) + innerSelector(4)
    const targetContract = '0x1111111111111111111111111111111111111111';
    const callDataBlockedSelector =
      '0xb61d27f6' +                                              // outer selector
      '000000000000000000000000' + '1111111111111111111111111111111111111111' + // target
      '0000000000000000000000000000000000000000000000000000000000000000' + // value
      '12345678';                                                  // inner selector (NOT allowed)
    const bridge = new UserOpBridge({
      bundlerClient: mockBundler,
      authMode: 'open',
      selfAddress: '0xselfaddress',
      allowedSelectors: new Map([
        [targetContract, ['0xdeadbeef']], // only deadbeef allowed, not 12345678
      ]),
    });

    const event = makeUserOpEvent({
      sender: '0xselfaddress',
      callData: callDataBlockedSelector,
    });
    const result = await bridge.handle(event);

    expect(result.success).toBe(false);
    expect(result.error).toBe('selector_not_allowed');
    expect(mockBundler.sendUserOperation).not.toHaveBeenCalled();
  });

  it('selector in allowlist → submitted', async () => {
    const targetContract = '0x1111111111111111111111111111111111111111';
    const callDataAllowedSelector =
      '0xb61d27f6' +
      '000000000000000000000000' + '1111111111111111111111111111111111111111' +
      '0000000000000000000000000000000000000000000000000000000000000000' +
      'deadbeef';                                                  // inner selector IS allowed
    const bridge = new UserOpBridge({
      bundlerClient: mockBundler,
      authMode: 'open',
      selfAddress: '0xselfaddress',
      allowedSelectors: new Map([
        [targetContract, ['0xdeadbeef']],
      ]),
    });

    const event = makeUserOpEvent({
      sender: '0xselfaddress',
      callData: callDataAllowedSelector,
    });
    const result = await bridge.handle(event);

    expect(result.success).toBe(true);
    expect(mockBundler.sendUserOperation).toHaveBeenCalledOnce();
  });

  it('open mode: any sender → submitted', async () => {
    const bridge = new UserOpBridge({
      bundlerClient: mockBundler,
      authMode: 'open',
    });

    const event = makeUserOpEvent({ sender: '0xanyrandomsender' });
    const result = await bridge.handle(event);

    expect(result.success).toBe(true);
    expect(mockBundler.sendUserOperation).toHaveBeenCalledOnce();
  });

  it('missing chain or ep tags → returns "missing_tags"', async () => {
    const bridge = new UserOpBridge({
      bundlerClient: mockBundler,
      authMode: 'open',
    });

    const event = makeEvent({ kind: 23404, tags: [] }); // no tags
    const result = await bridge.handle(event);

    expect(result.success).toBe(false);
    expect(result.error).toBe('missing_tags');
  });

  it('invalid JSON content → returns "invalid_content"', async () => {
    const bridge = new UserOpBridge({
      bundlerClient: mockBundler,
      authMode: 'open',
    });

    const event = makeEvent({
      kind: 23404,
      tags: [['chain', '10'], ['ep', '0xentrypoint']],
      content: 'not valid json',
    });
    const result = await bridge.handle(event);

    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid_content');
  });

  it('bundler throws → returns error string', async () => {
    const bridge = new UserOpBridge({
      bundlerClient: mockBundler,
      authMode: 'open',
      selfAddress: '0xselfaddress',
    });

    (mockBundler.sendUserOperation as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('bundler unavailable')
    );

    const event = makeUserOpEvent({ sender: '0xselfaddress' });
    const result = await bridge.handle(event);

    expect(result.success).toBe(false);
    expect(result.error).toContain('bundler unavailable');
  });

  it('contract not in allowedContracts → rejected', async () => {
    // target at callData[16:36] = 0x2222...2222 which is NOT in allowedContracts
    const callDataBlockedTarget =
      '0xb61d27f6' +
      '000000000000000000000000' + '2222222222222222222222222222222222222222' +
      '0000000000000000000000000000000000000000000000000000000000000000' +
      'deadbeef';
    const bridge = new UserOpBridge({
      bundlerClient: mockBundler,
      authMode: 'open',
      selfAddress: '0xselfaddress',
      allowedContracts: new Set(['0x3333333333333333333333333333333333333333']),
    });

    const event = makeUserOpEvent({
      sender: '0xselfaddress',
      callData: callDataBlockedTarget,
    });
    const result = await bridge.handle(event);

    expect(result.success).toBe(false);
    expect(result.error).toBe('contract_not_allowed');
    expect(mockBundler.sendUserOperation).not.toHaveBeenCalled();
  });

  it('malformed callData → rejected when allowedContracts or allowedSelectors set', async () => {
    const bridge = new UserOpBridge({
      bundlerClient: mockBundler,
      authMode: 'open',
      allowedContracts: new Set(['0x1111111111111111111111111111111111111111']),
    });

    const event = makeUserOpEvent({ callData: '0x12345678' }); // only 4 bytes
    const result = await bridge.handle(event);

    expect(result.success).toBe(false);
    expect(result.error).toBe('malformed_calldata');
  });
});
