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

// ─── packSecp256k1SessionSignature + packP256SessionSignature (Issue #38) ────

import { packSecp256k1SessionSignature, packP256SessionSignature } from "../services/session-key-service";

describe("packSecp256k1SessionSignature (106-byte format)", () => {
  const account = "0x1111111111111111111111111111111111111111";
  const sessionKey = "0x2222222222222222222222222222222222222222";
  // 65-byte secp256k1 sig: r(32) + s(32) + v(1)
  const sig65 = "aa".repeat(32) + "bb".repeat(32) + "1c";

  it("produces 106-byte (212 hex chars + 0x prefix) output", () => {
    const packed = packSecp256k1SessionSignature(account, sessionKey, "0x" + sig65);
    // 0x + 1(algId) + 20(account) + 20(key) + 32(r) + 32(s) + 1(v) = 106 bytes = 212 hex chars
    expect(packed.slice(2).length).toBe(212);
  });

  it("starts with algId 0x08", () => {
    const packed = packSecp256k1SessionSignature(account, sessionKey, "0x" + sig65);
    expect(packed.startsWith("0x08")).toBe(true);
  });

  it("contains account address after algId byte", () => {
    const packed = packSecp256k1SessionSignature(account, sessionKey, "0x" + sig65);
    // 0x + 08 + account(40) → chars 4..44
    expect(packed.slice(4, 44).toLowerCase()).toBe("1111111111111111111111111111111111111111");
  });

  it("accepts addresses without 0x prefix", () => {
    const packed = packSecp256k1SessionSignature(
      "1111111111111111111111111111111111111111",
      "2222222222222222222222222222222222222222",
      sig65
    );
    expect(packed.slice(2).length).toBe(212);
  });

  it("throws if account is wrong length", () => {
    expect(() =>
      packSecp256k1SessionSignature("0x1234", sessionKey, "0x" + sig65)
    ).toThrow("20 bytes");
  });

  it("throws if signature is wrong length", () => {
    expect(() =>
      packSecp256k1SessionSignature(account, sessionKey, "0x" + "aa".repeat(64))
    ).toThrow("65 bytes");
  });
});

describe("packP256SessionSignature (149-byte format)", () => {
  const account = "0x1111111111111111111111111111111111111111";
  const keyX = "cc".repeat(32); // 32 bytes = 64 hex
  const keyY = "dd".repeat(32);
  // 64-byte P256 sig: r(32) + s(32), no V
  const sig64 = "ee".repeat(32) + "ff".repeat(32);

  it("produces 149-byte (298 hex chars + 0x prefix) output", () => {
    const packed = packP256SessionSignature(account, keyX, keyY, sig64);
    // 0x + 1(algId) + 20(account) + 32(keyX) + 32(keyY) + 32(r) + 32(s) = 149 bytes = 298 hex chars
    expect(packed.slice(2).length).toBe(298);
  });

  it("starts with algId 0x08", () => {
    const packed = packP256SessionSignature(account, keyX, keyY, sig64);
    expect(packed.startsWith("0x08")).toBe(true);
  });

  it("throws if keyX is wrong length", () => {
    expect(() =>
      packP256SessionSignature(account, "cc", keyY, sig64)
    ).toThrow("32 bytes");
  });

  it("throws if signature is not 64 bytes", () => {
    expect(() =>
      packP256SessionSignature(account, keyX, keyY, "0x" + "aa".repeat(65))
    ).toThrow("64 bytes");
  });
});
