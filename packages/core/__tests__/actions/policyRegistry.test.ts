import { describe, it, expect, beforeEach } from 'vitest';
import { policyRegistryActions, PolicyDecision } from '../../src/actions/policyRegistry';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const PR_ADDRESS = '0x37e4E40e69Fb7d5C3fbAA0F52A4002D27472Ff29' as `0x${string}`;
const SENDER = ('0x' + 'aa'.repeat(20)) as `0x${string}`;
const TARGET = ('0x' + 'bb'.repeat(20)) as `0x${string}`;
const ASSET = ('0x' + 'cc'.repeat(20)) as `0x${string}`;
const CONSUMER = ('0x' + 'dd'.repeat(20)) as `0x${string}`;
const SELECTOR = '0xa9059cbb' as `0x${string}`; // transfer(address,uint256)

describe('PolicyRegistryActions', () => {
  let publicClient: any;
  let walletClient: any;

  beforeEach(() => {
    resetMocks();
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
  });

  // ── Validation-time read ────────────────────────────────────────────────────
  describe('checkPolicy', () => {
    it('decodes (decision, remainingDaily) and maps the uint8 to PolicyDecision', async () => {
      publicClient.readContract.mockResolvedValue([1, 5000n]); // REQUIRE_DVT, 5000 left
      const actions = policyRegistryActions(PR_ADDRESS)(publicClient);
      const r = await actions.checkPolicy({ sender: SENDER, target: TARGET, asset: ASSET, amount: 100n, selector: SELECTOR });
      expect(r).toEqual({ decision: PolicyDecision.REQUIRE_DVT, remainingDaily: 5000n });

      const call = publicClient.readContract.mock.calls[0][0];
      expect(call.functionName).toBe('checkPolicy');
      expect(call.args).toEqual([SENDER, TARGET, ASSET, 100n, SELECTOR]);
    });

    it('maps 0 → ALLOW and 2 → REJECT', async () => {
      const actions = policyRegistryActions(PR_ADDRESS)(publicClient);
      publicClient.readContract.mockResolvedValue([0, (2n ** 256n - 1n)]);
      expect((await actions.checkPolicy({ sender: SENDER, target: TARGET, asset: ASSET, amount: 1n, selector: SELECTOR })).decision).toBe(PolicyDecision.ALLOW);
      publicClient.readContract.mockResolvedValue([2, 0n]);
      expect((await actions.checkPolicy({ sender: SENDER, target: TARGET, asset: ASSET, amount: 1n, selector: SELECTOR })).decision).toBe(PolicyDecision.REJECT);
    });
  });

  // ── Config + counter views ──────────────────────────────────────────────────
  describe('getAssetPolicy', () => {
    it('decodes the AssetPolicy struct', async () => {
      publicClient.readContract.mockResolvedValue({
        dvtTriggerAmount: 1000n,
        perTxHardCap: 5000n,
        dailyLimit: 20000n,
        windowSeconds: 86400n,
        configured: true,
      });
      const actions = policyRegistryActions(PR_ADDRESS)(publicClient);
      const r = await actions.getAssetPolicy({ sender: SENDER, asset: ASSET });
      expect(r).toEqual({
        dvtTriggerAmount: 1000n,
        perTxHardCap: 5000n,
        dailyLimit: 20000n,
        windowSeconds: 86400n,
        configured: true,
      });
      expect(publicClient.readContract.mock.calls[0][0].functionName).toBe('getAssetPolicy');
    });
  });

  describe('getTargetScope', () => {
    const scope = { allowed: true, requireDVTAlways: false, velocityWindow: 3600n, configured: true };
    it('reads getTargetScope and decodes the 4-field ContractScope (no velocityLimit since 3.0)', async () => {
      publicClient.readContract.mockResolvedValue(scope);
      const actions = policyRegistryActions(PR_ADDRESS)(publicClient);
      expect(await actions.getTargetScope({ sender: SENDER, target: TARGET })).toEqual(scope);
      const call = publicClient.readContract.mock.calls[0][0];
      expect(call.functionName).toBe('getTargetScope');
      expect(call.args).toEqual([SENDER, TARGET]);
    });
    it('the deprecated getContractScope alias makes the same on-chain call', async () => {
      publicClient.readContract.mockResolvedValue(scope);
      const { getContractScope } = policyRegistryActions(PR_ADDRESS)(publicClient); // detached: no `this`
      expect(await getContractScope({ sender: SENDER, target: TARGET })).toEqual(scope);
      expect(publicClient.readContract.mock.calls[0][0].functionName).toBe('getTargetScope');
    });
  });

  describe('getTargetVelocity', () => {
    it('passes (sender, target, asset) and decodes (limit, configured)', async () => {
      publicClient.readContract.mockResolvedValue([9999n, true]);
      const actions = policyRegistryActions(PR_ADDRESS)(publicClient);
      expect(await actions.getTargetVelocity({ sender: SENDER, target: TARGET, asset: ASSET })).toEqual({ limit: 9999n, configured: true });
      const call = publicClient.readContract.mock.calls[0][0];
      expect(call.functionName).toBe('getTargetVelocity');
      expect(call.args).toEqual([SENDER, TARGET, ASSET]);
    });
  });

  describe('getAssetSpend', () => {
    it('decodes (spentInWindow, windowStart); the counter is uint256 since 3.0', async () => {
      const big = 2n ** 200n;
      publicClient.readContract.mockResolvedValue([big, 1700000000n]);
      const actions = policyRegistryActions(PR_ADDRESS)(publicClient);
      const r = await actions.getAssetSpend({ sender: SENDER, asset: ASSET });
      expect(r).toEqual({ spentInWindow: big, windowStart: 1700000000n });
    });
  });

  describe('getTargetSpend (3.0.2)', () => {
    it('passes (sender, target, asset) and decodes (spentInWindow, windowStart)', async () => {
      publicClient.readContract.mockResolvedValue([77n, 1700000000n]);
      const actions = policyRegistryActions(PR_ADDRESS)(publicClient);
      expect(await actions.getTargetSpend({ sender: SENDER, target: TARGET, asset: ASSET })).toEqual({ spentInWindow: 77n, windowStart: 1700000000n });
      const call = publicClient.readContract.mock.calls[0][0];
      expect(call.functionName).toBe('getTargetSpend');
      expect(call.args).toEqual([SENDER, TARGET, ASSET]);
    });
    it('the vendored ABI is 3.0.2: getTargetSpend 0x0c4752d2 and VelocityDisabled 0x071caaf1', async () => {
      const { PolicyRegistryABI } = await import('../../src/abis/index');
      const { toFunctionSelector, toFunctionSignature, keccak256, toHex } = await import('viem');
      const fn = (PolicyRegistryABI as any[]).find((e) => e.type === 'function' && e.name === 'getTargetSpend');
      expect(toFunctionSelector(toFunctionSignature(fn))).toBe('0x0c4752d2');
      expect((PolicyRegistryABI as any[]).some((e) => e.type === 'error' && e.name === 'VelocityDisabled')).toBe(true);
      expect(keccak256(toHex('VelocityDisabled()')).slice(0, 10)).toBe('0x071caaf1');
    });
  });

  describe('isSelectorAllowed / isFrozen / isAuthorizedConsumer', () => {
    it('isSelectorAllowed passes (sender, target, selector)', async () => {
      publicClient.readContract.mockResolvedValue(true);
      const actions = policyRegistryActions(PR_ADDRESS)(publicClient);
      expect(await actions.isSelectorAllowed({ sender: SENDER, target: TARGET, selector: SELECTOR })).toBe(true);
      expect(publicClient.readContract.mock.calls[0][0].args).toEqual([SENDER, TARGET, SELECTOR]);
    });

    it('isFrozen reads frozen flag', async () => {
      publicClient.readContract.mockResolvedValue(false);
      const actions = policyRegistryActions(PR_ADDRESS)(publicClient);
      expect(await actions.isFrozen({ sender: SENDER })).toBe(false);
      expect(publicClient.readContract.mock.calls[0][0].functionName).toBe('isFrozen');
    });

    it('isAuthorizedConsumer reads consumer authorization', async () => {
      publicClient.readContract.mockResolvedValue(true);
      const actions = policyRegistryActions(PR_ADDRESS)(publicClient);
      expect(await actions.isAuthorizedConsumer({ consumer: CONSUMER })).toBe(true);
      expect(publicClient.readContract.mock.calls[0][0].args).toEqual([CONSUMER]);
    });
  });

  // ── Governance state views ──────────────────────────────────────────────────
  describe('governance state views', () => {
    it('guardian / timelock / DEFAULT_WINDOW / ETH_SENTINEL / version', async () => {
      const actions = policyRegistryActions(PR_ADDRESS)(publicClient);

      publicClient.readContract.mockResolvedValueOnce(TARGET);
      expect(await actions.guardian()).toBe(TARGET);

      publicClient.readContract.mockResolvedValueOnce(CONSUMER);
      expect(await actions.timelock()).toBe(CONSUMER);

      publicClient.readContract.mockResolvedValueOnce(86400n);
      expect(await actions.DEFAULT_WINDOW()).toBe(86400n);

      publicClient.readContract.mockResolvedValueOnce('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE');
      expect(await actions.ETH_SENTINEL()).toBe('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE');

      publicClient.readContract.mockResolvedValueOnce('5.4.0');
      expect(await actions.version()).toBe('5.4.0');
    });
  });

  // ── Immediate tighten / freeze writes ───────────────────────────────────────
  describe('immediate tighten / freeze (guardian or timelock)', () => {
    const assetParams = { dvtTriggerAmount: 100n, perTxHardCap: 500n, dailyLimit: 1000n, windowSeconds: 0n };
    const scopeParams = { allowed: false, requireDVTAlways: true, velocityWindow: 0n, selectorAllowlist: [SELECTOR] };

    it('tightenAssetPolicy calls writeContract with (sender, asset, params)', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash');
      const actions = policyRegistryActions(PR_ADDRESS)(walletClient);
      await actions.tightenAssetPolicy({ sender: SENDER, asset: ASSET, params: assetParams, account: walletClient.account });
      const call = walletClient.writeContract.mock.calls[0][0];
      expect(call.functionName).toBe('tightenAssetPolicy');
      expect(call.args).toEqual([SENDER, ASSET, assetParams]);
    });

    it('tightenContractScope calls writeContract with (sender, target, params)', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash');
      const actions = policyRegistryActions(PR_ADDRESS)(walletClient);
      await actions.tightenContractScope({ sender: SENDER, target: TARGET, params: scopeParams, account: walletClient.account });
      const call = walletClient.writeContract.mock.calls[0][0];
      expect(call.functionName).toBe('tightenContractScope');
      expect(call.args).toEqual([SENDER, TARGET, scopeParams]);
    });

    it('tightenTargetVelocity calls writeContract with (sender, target, asset, limit)', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash');
      const actions = policyRegistryActions(PR_ADDRESS)(walletClient);
      await actions.tightenTargetVelocity({ sender: SENDER, target: TARGET, asset: ASSET, limit: 10n, account: walletClient.account });
      const call = walletClient.writeContract.mock.calls[0][0];
      expect(call.functionName).toBe('tightenTargetVelocity');
      expect(call.args).toEqual([SENDER, TARGET, ASSET, 10n]);
    });

    it('freezeSender calls writeContract with (sender)', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash');
      const actions = policyRegistryActions(PR_ADDRESS)(walletClient);
      await actions.freezeSender({ sender: SENDER, account: walletClient.account });
      const call = walletClient.writeContract.mock.calls[0][0];
      expect(call.functionName).toBe('freezeSender');
      expect(call.args).toEqual([SENDER]);
    });
  });

  // ── Timelocked loosen / admin writes (onlyTimelock) ─────────────────────────
  describe('timelocked loosen / admin (onlyTimelock — routed through external TimelockController)', () => {
    const assetParams = { dvtTriggerAmount: 100n, perTxHardCap: 500n, dailyLimit: 1000n, windowSeconds: 0n };
    const scopeParams = { allowed: true, requireDVTAlways: false, velocityWindow: 3600n, selectorAllowlist: [SELECTOR] };

    it('setAssetPolicy calls writeContract with (sender, asset, params)', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash');
      const actions = policyRegistryActions(PR_ADDRESS)(walletClient);
      await actions.setAssetPolicy({ sender: SENDER, asset: ASSET, params: assetParams, account: walletClient.account });
      const call = walletClient.writeContract.mock.calls[0][0];
      expect(call.functionName).toBe('setAssetPolicy');
      expect(call.args).toEqual([SENDER, ASSET, assetParams]);
    });

    it('setContractScope calls writeContract with (sender, target, params)', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash');
      const actions = policyRegistryActions(PR_ADDRESS)(walletClient);
      await actions.setContractScope({ sender: SENDER, target: TARGET, params: scopeParams, account: walletClient.account });
      const call = walletClient.writeContract.mock.calls[0][0];
      expect(call.functionName).toBe('setContractScope');
      expect(call.args).toEqual([SENDER, TARGET, scopeParams]);
    });

    it('setTargetVelocity calls writeContract with (sender, target, asset, limit)', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash');
      const actions = policyRegistryActions(PR_ADDRESS)(walletClient);
      await actions.setTargetVelocity({ sender: SENDER, target: TARGET, asset: ASSET, limit: 9999n, account: walletClient.account });
      const call = walletClient.writeContract.mock.calls[0][0];
      expect(call.functionName).toBe('setTargetVelocity');
      expect(call.args).toEqual([SENDER, TARGET, ASSET, 9999n]);
    });

    it('unfreezeSender calls writeContract with (sender)', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash');
      const actions = policyRegistryActions(PR_ADDRESS)(walletClient);
      await actions.unfreezeSender({ sender: SENDER, account: walletClient.account });
      const call = walletClient.writeContract.mock.calls[0][0];
      expect(call.functionName).toBe('unfreezeSender');
      expect(call.args).toEqual([SENDER]);
    });

    it('setGuardian calls writeContract with (newGuardian)', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash');
      const actions = policyRegistryActions(PR_ADDRESS)(walletClient);
      await actions.setGuardian({ newGuardian: TARGET, account: walletClient.account });
      const call = walletClient.writeContract.mock.calls[0][0];
      expect(call.functionName).toBe('setGuardian');
      expect(call.args).toEqual([TARGET]);
    });

    it('setConsumerAuthorization calls writeContract with (consumer, authorized)', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash');
      const actions = policyRegistryActions(PR_ADDRESS)(walletClient);
      await actions.setConsumerAuthorization({ consumer: CONSUMER, authorized: true, account: walletClient.account });
      const call = walletClient.writeContract.mock.calls[0][0];
      expect(call.functionName).toBe('setConsumerAuthorization');
      expect(call.args).toEqual([CONSUMER, true]);
    });
  });
});
