import { describe, it, expect, beforeEach } from 'vitest';
import {
  airAccountActions,
  airAccountFactoryActions,
  agentRegistryActions,
  sessionKeyValidatorActions,
  forceExitActions,
  type InitConfig,
  type TokenConfig,
  type PackedUserOperation,
} from '../../src/actions/index';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const ADDR = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const OWNER = '0x2222222222222222222222222222222222222222' as `0x${string}`;
const ACCT = '0x3333333333333333333333333333333333333333' as `0x${string}`;
const B32 = `0x${'ab'.repeat(32)}` as `0x${string}`;
const SEL = '0xdeadbeef' as `0x${string}`;

const TOKEN_CONFIG: TokenConfig = { tier1Limit: 1n, tier2Limit: 2n, dailyLimit: 3n };
const ZERO32 = `0x${'00'.repeat(32)}` as `0x${string}`;
const INIT_CONFIG: InitConfig = {
  guardians: [OWNER, ACCT, ADDR],
  guardianP256X: [ZERO32, ZERO32, ZERO32],
  guardianP256Y: [ZERO32, ZERO32, ZERO32],
  dailyLimit: 100n,
  approvedAlgIds: [1, 8],
  minDailyLimit: 10n,
  initialTokens: [ADDR],
  initialTokenConfigs: [TOKEN_CONFIG],
};
const USER_OP: PackedUserOperation = {
  sender: ACCT,
  nonce: 0n,
  initCode: '0x',
  callData: '0x',
  accountGasLimits: B32,
  preVerificationGas: 0n,
  gasFees: B32,
  paymasterAndData: '0x',
  signature: '0x',
};

describe('AAStarAirAccountV7 actions', () => {
  let p: any;
  let w: any;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  it('reads', async () => {
    const act = airAccountActions(ADDR)(p);
    p.readContract.mockResolvedValueOnce('air-account-v7');
    expect(await act.accountId()).toBe('air-account-v7');
    p.readContract.mockResolvedValueOnce('0x1626ba7e');
    expect(await act.isValidSignature({ hash: B32, sig: '0x' })).toBe('0x1626ba7e');
    p.readContract.mockResolvedValueOnce(2);
    expect(await act.requiredTier({ txValue: 5n })).toBe(2);
    p.readContract.mockResolvedValueOnce(true);
    expect(await act.supportsModule({ moduleTypeId: 1n })).toBe(true);
    p.readContract.mockResolvedValueOnce(B32);
    await act.p256KeyX();
    p.readContract.mockResolvedValueOnce(B32);
    await act.p256KeyY();
    p.readContract.mockResolvedValueOnce(ADDR);
    await act.parserRegistry();
    p.readContract.mockResolvedValueOnce(7n);
    expect(await act.moduleManagementNonce()).toBe(7n);
    p.readContract.mockResolvedValueOnce(86400n);
    expect(await act.moduleInstallTimelock()).toBe(86400n);
    p.readContract.mockResolvedValueOnce([ADDR, 1, 100, 200, B32]);
    const pend = await act.pendingModuleInstall();
    expect(pend.module).toBe(ADDR);
    expect(pend.executeAfter).toBe(200);
    expect(p.readContract).toHaveBeenCalledTimes(10);
  });

  it('writes', async () => {
    w.writeContract.mockResolvedValue('0xhash');
    const act = airAccountActions(ADDR)(w);
    await act.setP256Key({ x: B32, y: B32, account: OWNER });
    await act.setTierLimits({ tier1: 1n, tier2: 2n, account: OWNER });
    await act.setValidator({ validator: ADDR, account: OWNER });
    await act.setParserRegistry({ registry: ADDR, account: OWNER });
    await act.executeFromExecutor({ mode: B32, executionCalldata: '0x', account: OWNER });
    await act.validateUserOp({ userOp: USER_OP, userOpHash: B32, missingAccountFunds: 0n, account: OWNER });
    await act.initializeAgentAccount({ entryPoint: ADDR, owner: OWNER, config: INIT_CONFIG, guardAddr: ADDR, account: OWNER });
    await act.guardAddTokenConfig({ token: ADDR, config: TOKEN_CONFIG, account: OWNER });
    await act.guardApproveAlgorithm({ algId: 8, account: OWNER });
    await act.guardDecreaseDailyLimit({ newLimit: 5n, account: OWNER });
    await act.guardDecreaseTokenDailyLimit({ token: ADDR, newLimit: 5n, account: OWNER });
    await act.proposeModuleInstall({ moduleTypeId: 1n, module: ADDR, initData: '0x', account: OWNER });
    await act.executeModuleInstall({ moduleInitData: '0x', account: OWNER });
    await act.cancelModuleInstall({ account: OWNER });
    await act.setModuleInstallTimelock({ newTimelock: 1n, guardianSigs: '0x', account: OWNER });
    expect(w.writeContract).toHaveBeenCalledTimes(15);

    // Struct-arg writes must forward args in the EXACT ABI order (regression guard
    // for PackedUserOperation / InitConfig / TokenConfig field-order mistakes).
    const byFn = (name: string) =>
      w.writeContract.mock.calls.map((c: any) => c[0]).find((c: any) => c.functionName === name);
    expect(byFn('validateUserOp').args).toEqual([USER_OP, B32, 0n]);
    expect(byFn('initializeAgentAccount').args).toEqual([ADDR, OWNER, INIT_CONFIG, ADDR]);
    expect(byFn('guardAddTokenConfig').args).toEqual([ADDR, TOKEN_CONFIG]);
    expect(byFn('executeFromExecutor').args).toEqual([B32, '0x']);
  });

  it('wraps viem errors', async () => {
    const act = airAccountActions(ADDR)(p);
    p.readContract.mockRejectedValueOnce(new Error('revert'));
    await expect(act.accountId()).rejects.toThrow();
  });
});

describe('AAStarAirAccountFactoryV7 actions', () => {
  let p: any;
  let w: any;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  it('reads', async () => {
    const act = airAccountFactoryActions(ADDR)(p);
    p.readContract.mockResolvedValueOnce([ACCT, B32]);
    const r = await act.getAddressWithChainId({ owner: OWNER, salt: 1n, config: INIT_CONFIG });
    expect(r.account).toBe(ACCT);
    expect(r.chainQualified).toBe(B32);
    p.readContract.mockResolvedValueOnce(ACCT);
    await act.getAddressWithDefaults({ owner: OWNER, salt: 1n, guard: ADDR, validator: ADDR, dailyLimit: 1n });
    p.readContract.mockResolvedValueOnce(B32);
    await act.getChainQualifiedAddress({ account: ACCT });
    p.readContract.mockResolvedValueOnce(ADDR);
    await act.implementation();
    p.readContract.mockResolvedValueOnce(OWNER);
    await act.factoryAdmin();
    p.readContract.mockResolvedValueOnce(ADDR);
    await act.defaultCommunityGuardian();
    expect(p.readContract).toHaveBeenCalledTimes(6);
  });

  it('agent-account reads', async () => {
    const act = airAccountFactoryActions(ADDR)(p);
    p.readContract.mockResolvedValueOnce(ADDR);
    expect(await act.agentRegistry()).toBe(ADDR);
    p.readContract.mockResolvedValueOnce(ACCT);
    const predicted = await act.getAgentAddress({ humanOwner: OWNER, agentKey: ADDR, agentId: B32 });
    expect(predicted).toBe(ACCT);
    const byFn = (name: string) =>
      p.readContract.mock.calls.map((c: any) => c[0]).find((c: any) => c.functionName === name);
    expect(byFn('getAgentAddress').args).toEqual([OWNER, ADDR, B32]);
    expect(p.readContract).toHaveBeenCalledTimes(2);
  });

  it('agent-account writes (exact ABI arg order)', async () => {
    const act = airAccountFactoryActions(ADDR)(w);
    w.writeContract.mockResolvedValue('0xhash');
    await act.createAgentAccount({
      agentKey: ADDR, agentId: B32, guardian2: OWNER, guardian2Sig: '0xaa',
      agentKeySig: '0xbb', deadline: 1234n, dailyLimit: 100n, account: OWNER,
    });
    await act.setAgentRegistry({ agentRegistry: ACCT, account: OWNER });
    const byFn = (name: string) =>
      w.writeContract.mock.calls.map((c: any) => c[0]).find((c: any) => c.functionName === name);
    // (agentKey, agentId, guardian2, guardian2Sig, agentKeySig, deadline, dailyLimit)
    expect(byFn('createAgentAccount').args).toEqual([ADDR, B32, OWNER, '0xaa', '0xbb', 1234n, 100n]);
    expect(byFn('setAgentRegistry').args).toEqual([ACCT]);
    expect(w.writeContract).toHaveBeenCalledTimes(2);
  });

  it('wraps viem errors on agent-account fns', async () => {
    const act = airAccountFactoryActions(ADDR)(p);
    p.readContract.mockRejectedValueOnce(new Error('revert'));
    await expect(act.getAgentAddress({ humanOwner: OWNER, agentKey: ADDR, agentId: B32 })).rejects.toThrow();
  });
});

describe('AgentRegistry actions', () => {
  let p: any;
  let w: any;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  it('base reads + writes', async () => {
    const r = agentRegistryActions(ADDR)(p);
    p.readContract.mockResolvedValueOnce(OWNER);
    await r.deployer();
    p.readContract.mockResolvedValueOnce(ADDR);
    await r.factory();
    expect(p.readContract).toHaveBeenCalledTimes(2);

    const wAct = agentRegistryActions(ADDR)(w);
    w.writeContract.mockResolvedValue('0xhash');
    await wAct.bindFactory({ factory: ADDR, account: OWNER });
    await wAct.markValid({ account: ACCT, signer: OWNER });
    expect(w.writeContract).toHaveBeenCalledTimes(2);
  });

  it('lifecycle reads (incl. bool, uint256 and address[])', async () => {
    const r = agentRegistryActions(ADDR)(p);
    p.readContract.mockResolvedValueOnce(true);
    expect(await r.isRegisteredAgent({ agentWallet: ACCT })).toBe(true);
    p.readContract.mockResolvedValueOnce(false);
    expect(await r.isValidAccount({ account: ACCT })).toBe(false);
    p.readContract.mockResolvedValueOnce(OWNER);
    expect(await r.getHumanOwner({ agentWallet: ACCT })).toBe(OWNER);
    p.readContract.mockResolvedValueOnce(OWNER);
    expect(await r.agentWalletOwner({ agentWallet: ACCT })).toBe(OWNER);
    p.readContract.mockResolvedValueOnce(3n);
    expect(await r.getAgentCount({ owner: OWNER })).toBe(3n);
    p.readContract.mockResolvedValueOnce([ACCT, ADDR]);
    expect(await r.getAgents({ humanOwner: OWNER })).toEqual([ACCT, ADDR]);
    p.readContract.mockResolvedValueOnce([ACCT]);
    expect(await r.getAgentsPage({ owner: OWNER, start: 0n, count: 1n })).toEqual([ACCT]);
    p.readContract.mockResolvedValueOnce(ACCT);
    expect(await r.getAgentByIndex({ owner: OWNER, index: 0n })).toBe(ACCT);
    p.readContract.mockResolvedValueOnce(ADDR);
    expect(await r.ownerAgents({ owner: OWNER, index: 1n })).toBe(ADDR);

    const byFn = (name: string) =>
      p.readContract.mock.calls.map((c: any) => c[0]).find((c: any) => c.functionName === name);
    expect(byFn('getAgentsPage').args).toEqual([OWNER, 0n, 1n]);
    expect(byFn('getAgentByIndex').args).toEqual([OWNER, 0n]);
    expect(byFn('ownerAgents').args).toEqual([OWNER, 1n]);
    expect(p.readContract).toHaveBeenCalledTimes(9);
  });

  it('lifecycle writes (registerAgent bytes sig, revoke, deregister)', async () => {
    const wAct = agentRegistryActions(ADDR)(w);
    w.writeContract.mockResolvedValue('0xhash');
    await wAct.registerAgent({ agentWallet: ACCT, agentWalletSig: '0xdead', account: OWNER });
    await wAct.revokeAgent({ agentWallet: ACCT, account: OWNER });
    await wAct.deregisterAgent({ agentWallet: ACCT, account: OWNER });
    const byFn = (name: string) =>
      w.writeContract.mock.calls.map((c: any) => c[0]).find((c: any) => c.functionName === name);
    expect(byFn('registerAgent').args).toEqual([ACCT, '0xdead']);
    expect(byFn('revokeAgent').args).toEqual([ACCT]);
    expect(byFn('deregisterAgent').args).toEqual([ACCT]);
    expect(w.writeContract).toHaveBeenCalledTimes(3);
  });

  it('wraps viem errors', async () => {
    const r = agentRegistryActions(ADDR)(p);
    p.readContract.mockRejectedValueOnce(new Error('revert'));
    await expect(r.isRegisteredAgent({ agentWallet: ACCT })).rejects.toThrow();
  });
});

describe('SessionKeyValidator actions', () => {
  let p: any;
  let w: any;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  it('reads', async () => {
    const act = sessionKeyValidatorActions(ADDR)(p);
    p.readContract.mockResolvedValueOnce(undefined);
    await act.checkSessionScope({ account: ACCT, sessionKeyOrHash: B32, sessionType: 1, dest: ADDR, selector: SEL });
    p.readContract.mockResolvedValueOnce(3n);
    expect(await act.grantNonces({ account: ACCT, key: OWNER })).toBe(3n);
    p.readContract.mockResolvedValueOnce(4n);
    expect(await act.grantNonces_p256({ account: ACCT, keyHash: B32 })).toBe(4n);
    p.readContract.mockResolvedValueOnce(2n);
    expect(await act.sessionKeyCount({ account: ACCT })).toBe(2n);
    p.readContract.mockResolvedValueOnce([1000, 5, 2]);
    const st = await act.sessionStates_p256({ account: ACCT, keyHash: B32 });
    expect(st).toEqual({ windowStart: 1000, callCount: 5, prevCount: 2 });
    expect(p.readContract).toHaveBeenCalledTimes(5);
  });

  it('writes', async () => {
    const act = sessionKeyValidatorActions(ADDR)(w);
    w.writeContract.mockResolvedValue('0xhash');
    await act.recordCallForVelocity({ account: ACCT, sessionKeyOrHash: B32, sessionType: 1, signer: OWNER });
    expect(w.writeContract).toHaveBeenCalledTimes(1);
  });
});

describe('ForceExitModule actions', () => {
  let p: any;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); });

  it('reads pendingExit', async () => {
    const act = forceExitActions(ADDR)(p);
    p.readContract.mockResolvedValueOnce([ACCT, 5n, '0x', 1234n, 7n]);
    const r = await act.pendingExit({ account: ACCT });
    expect(r).toEqual({ target: ACCT, value: 5n, data: '0x', proposedAt: 1234n, approvalBitmap: 7n });
  });
});
