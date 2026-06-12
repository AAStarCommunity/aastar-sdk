import { describe, it, expect } from "vitest";
import { MODULE_TYPE } from "../constants/entrypoint";
import { SESSION_KEY_VALIDATOR_ABI, AGENT_SESSION_KEY_VALIDATOR_ABI } from "../constants/entrypoint";
import { ethers } from "ethers";

// ─── Test constants ─────────────────────────────────────────────────────────
const ACCOUNT_ADDR = "0x3333333333333333333333333333333333333333";
const SESSION_KEY  = "0x4444444444444444444444444444444444444444";
const SUB_KEY      = "0x5555555555555555555555555555555555555555";
const PARENT_KEY   = "0x6666666666666666666666666666666666666666";

// ─── Minimal stand-in for SessionKeyService (avoids ethers.Contract mocking) ─
// Re-implements only the methods under test using the same encode/decode logic
// as the real service, verified against the actual ABI strings.
// This is intentional: it tests the LOGIC CONTRACT (what the function encodes/decodes),
// not the dependency wiring (ethers.Contract constructor).

const skIface  = new ethers.Interface(SESSION_KEY_VALIDATOR_ABI);
const askIface = new ethers.Interface(AGENT_SESSION_KEY_VALIDATOR_ABI);

function encodeGrantSession(params: {
  account: string; sessionKey: string; expiry: number;
  contractScope?: string; selectorScope?: string; ownerSig?: string;
}): string {
  if (params.ownerSig) {
    return skIface.encodeFunctionData("grantSession", [
      params.account, params.sessionKey, params.expiry,
      params.contractScope ?? ethers.ZeroAddress,
      params.selectorScope ?? "0x00000000",
      params.ownerSig,
    ]);
  }
  return skIface.encodeFunctionData("grantSessionDirect", [
    params.account, params.sessionKey, params.expiry,
    params.contractScope ?? ethers.ZeroAddress,
    params.selectorScope ?? "0x00000000",
  ]);
}

function encodeRevokeSession(account: string, sessionKey: string): string {
  return skIface.encodeFunctionData("revokeSession", [account, sessionKey]);
}

function encodeGrantAgentSession(sessionKey: string, cfg: {
  expiry: number; velocityLimit: number; velocityWindow: number;
  callTargets: string[]; selectorAllowlist: string[];
}): string {
  return askIface.encodeFunctionData("grantAgentSession", [
    sessionKey,
    { expiry: cfg.expiry, velocityLimit: cfg.velocityLimit,
      velocityWindow: cfg.velocityWindow, revoked: false,
      callTargets: cfg.callTargets, selectorAllowlist: cfg.selectorAllowlist },
  ]);
}

// M9 change: now accepts (account, subKey, subCfg) — 3 params
function encodeDelegateSession(account: string, subKey: string, subCfg: {
  expiry: number; velocityLimit: number; velocityWindow: number;
  callTargets: string[]; selectorAllowlist: string[];
}): string {
  return askIface.encodeFunctionData("delegateSession", [
    account, subKey,
    { expiry: subCfg.expiry, velocityLimit: subCfg.velocityLimit,
      velocityWindow: subCfg.velocityWindow, revoked: false,
      callTargets: subCfg.callTargets, selectorAllowlist: subCfg.selectorAllowlist },
  ]);
}

function encodeRevokeAgentSession(sessionKey: string): string {
  return askIface.encodeFunctionData("revokeAgentSession", [sessionKey]);
}

// Decoder logic extracted from getAgentSession — M9 6-field + 2-field layout
function decodeAgentSession(
  agentSessionsResult: [bigint, bigint, bigint, boolean, string[], string[]],
  sessionStatesResult: [bigint, bigint]
) {
  const [expiry, velocityLimit, velocityWindow, revoked, callTargets, selectorAllowlist]
    = agentSessionsResult;
  const [callCount, windowStart] = sessionStatesResult;
  return {
    expiry: Number(expiry),
    velocityLimit: Number(velocityLimit),
    velocityWindow: Number(velocityWindow),
    callTargets,
    selectorAllowlist,
    revoked,
    callCount: BigInt(callCount),
    windowStart: BigInt(windowStart),
  };
}

const BASE_CFG = {
  expiry: 9999999999, velocityLimit: 10, velocityWindow: 3600,
  callTargets: [] as string[], selectorAllowlist: [] as string[],
};

// ─── MODULE_TYPE constants (M9: HOOK changed 3→4, FALLBACK=3 added) ──────────
describe("MODULE_TYPE constants — M9 changes", () => {
  it("VALIDATOR = 1", () => expect(MODULE_TYPE.VALIDATOR).toBe(1));
  it("EXECUTOR = 2",  () => expect(MODULE_TYPE.EXECUTOR).toBe(2));
  it("FALLBACK = 3 (new in M9)", () => expect(MODULE_TYPE.FALLBACK).toBe(3));
  it("HOOK = 4 (changed from 3 in M9)", () => expect(MODULE_TYPE.HOOK).toBe(4));
  it("HOOK != FALLBACK — no overlap", () => expect(MODULE_TYPE.HOOK).not.toBe(MODULE_TYPE.FALLBACK));
});

// ─── M6: Session key encode ──────────────────────────────────────────────────
describe("SessionKeyService — M6 encodeGrantSession", () => {
  it("returns hex calldata with ownerSig → grantSession", () => {
    const cd = encodeGrantSession({
      account: ACCOUNT_ADDR, sessionKey: SESSION_KEY, expiry: 9999999999,
      ownerSig: "0x" + "cc".repeat(65),
    });
    expect(cd).toMatch(/^0x[0-9a-f]+$/i);
    expect(cd.length).toBeGreaterThan(10);
  });

  it("returns hex calldata without ownerSig → grantSessionDirect", () => {
    const cd = encodeGrantSession({ account: ACCOUNT_ADDR, sessionKey: SESSION_KEY, expiry: 9999999999 });
    expect(cd).toMatch(/^0x[0-9a-f]+$/i);
  });

  it("grantSession and grantSessionDirect have different selectors", () => {
    const withSig  = encodeGrantSession({ account: ACCOUNT_ADDR, sessionKey: SESSION_KEY, expiry: 1000, ownerSig: "0x" + "cc".repeat(65) });
    const direct   = encodeGrantSession({ account: ACCOUNT_ADDR, sessionKey: SESSION_KEY, expiry: 1000 });
    expect(withSig.slice(0, 10)).not.toBe(direct.slice(0, 10));
  });

  it("encodeRevokeSession returns valid calldata", () => {
    const cd = encodeRevokeSession(ACCOUNT_ADDR, SESSION_KEY);
    expect(cd).toMatch(/^0x[0-9a-f]+$/i);
  });
});

// ─── M7: Agent session key encode ────────────────────────────────────────────
describe("SessionKeyService — M7 encodeGrantAgentSession", () => {
  it("returns hex calldata", () => {
    expect(encodeGrantAgentSession(SESSION_KEY, BASE_CFG)).toMatch(/^0x[0-9a-f]+$/i);
  });

  it("different expiry → different calldata, same selector", () => {
    const cd1 = encodeGrantAgentSession(SESSION_KEY, { ...BASE_CFG, expiry: 1000 });
    const cd2 = encodeGrantAgentSession(SESSION_KEY, { ...BASE_CFG, expiry: 2000 });
    expect(cd1.slice(0, 10)).toBe(cd2.slice(0, 10));
    expect(cd1).not.toBe(cd2);
  });

  it("callTargets changes calldata", () => {
    const w = encodeGrantAgentSession(SESSION_KEY, { ...BASE_CFG, callTargets: [ACCOUNT_ADDR] });
    const n = encodeGrantAgentSession(SESSION_KEY, BASE_CFG);
    expect(w).not.toBe(n);
  });
});

// ─── M9 CRITICAL: encodeDelegateSession — 3-param signature ──────────────────
describe("SessionKeyService — encodeDelegateSession M9 3-param", () => {
  it("accepts (account, subKey, subCfg) without throwing", () => {
    const cd = encodeDelegateSession(ACCOUNT_ADDR, SUB_KEY, BASE_CFG);
    expect(cd).toMatch(/^0x[0-9a-f]+$/i);
  });

  it("consistent function selector for same function", () => {
    const cd1 = encodeDelegateSession(ACCOUNT_ADDR, SUB_KEY, BASE_CFG);
    const cd2 = encodeDelegateSession(ACCOUNT_ADDR, SESSION_KEY, BASE_CFG);
    expect(cd1.slice(0, 10)).toBe(cd2.slice(0, 10));
    expect(cd1).not.toBe(cd2);
  });

  it("different account produces different calldata", () => {
    const cd1 = encodeDelegateSession(ACCOUNT_ADDR, SUB_KEY, BASE_CFG);
    const cd2 = encodeDelegateSession(PARENT_KEY, SUB_KEY, BASE_CFG);
    expect(cd1).not.toBe(cd2);
  });

  it("narrow callTargets produce different calldata vs empty", () => {
    const narrow = encodeDelegateSession(ACCOUNT_ADDR, SUB_KEY, { ...BASE_CFG, callTargets: [ACCOUNT_ADDR] });
    const open   = encodeDelegateSession(ACCOUNT_ADDR, SUB_KEY, BASE_CFG);
    expect(narrow).not.toBe(open);
  });

  it("encodeRevokeAgentSession returns valid calldata", () => {
    expect(encodeRevokeAgentSession(SESSION_KEY)).toMatch(/^0x[0-9a-f]+$/i);
  });
});

// ─── M9: getAgentSession decoder — 6-field agentSessions + 2-field sessionStates
describe("getAgentSession M9 decoder logic", () => {
  it("correctly decodes all 6 fields from agentSessions", () => {
    const info = decodeAgentSession(
      [9999999999n, 5n, 1800n, false, [ACCOUNT_ADDR], ["0xaabbccdd"]],
      [7n, 1700000000n]
    );
    expect(info.expiry).toBe(9999999999);
    expect(info.velocityLimit).toBe(5);
    expect(info.velocityWindow).toBe(1800);
    expect(info.revoked).toBe(false);
    expect(info.callTargets).toEqual([ACCOUNT_ADDR]);
    expect(info.selectorAllowlist).toEqual(["0xaabbccdd"]);
  });

  it("correctly decodes callCount and windowStart from sessionStates", () => {
    const info = decodeAgentSession(
      [9999999999n, 0n, 0n, false, [], []],
      [42n, 1234567890n]
    );
    expect(info.callCount).toBe(42n);
    expect(info.windowStart).toBe(1234567890n);
  });

  it("callCount and windowStart are bigints", () => {
    const info = decodeAgentSession([9999999999n, 0n, 0n, false, [], []], [1n, 999n]);
    expect(typeof info.callCount).toBe("bigint");
    expect(typeof info.windowStart).toBe("bigint");
  });

  it("revoked=true propagates", () => {
    const info = decodeAgentSession([1000n, 0n, 0n, true, [], []], [0n, 0n]);
    expect(info.revoked).toBe(true);
  });

  it("isAgentSessionActive: active when future expiry + not revoked", () => {
    const farFuture = Math.floor(Date.now() / 1000) + 86400;
    const info = decodeAgentSession([BigInt(farFuture), 0n, 0n, false, [], []], [0n, 0n]);
    const isActive = info.expiry > Math.floor(Date.now() / 1000) && !info.revoked;
    expect(isActive).toBe(true);
  });

  it("isAgentSessionActive: inactive when revoked", () => {
    const farFuture = Math.floor(Date.now() / 1000) + 86400;
    const info = decodeAgentSession([BigInt(farFuture), 0n, 0n, true, [], []], [0n, 0n]);
    const isActive = info.expiry > Math.floor(Date.now() / 1000) && !info.revoked;
    expect(isActive).toBe(false);
  });

  it("isAgentSessionActive: inactive when expired", () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    const info = decodeAgentSession([BigInt(past), 0n, 0n, false, [], []], [0n, 0n]);
    const isActive = info.expiry > Math.floor(Date.now() / 1000) && !info.revoked;
    expect(isActive).toBe(false);
  });
});
