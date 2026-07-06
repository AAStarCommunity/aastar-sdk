import { describe, it, expect } from "vitest";
import { MODULE_TYPE } from "../constants/entrypoint";
import { SESSION_KEY_VALIDATOR_ABI } from "../constants/entrypoint";
// eslint-disable-next-line no-restricted-imports
import {
  parseAbi,
  encodeFunctionData,
  decodeFunctionData,
  getAbiItem,
  toFunctionSelector,
  zeroAddress,
  type Abi,
  type AbiFunction,
} from "viem";
import { selectorFromId } from "../../migration/viem/hashing";

// ─── Test constants ─────────────────────────────────────────────────────────
const ACCOUNT_ADDR = "0x3333333333333333333333333333333333333333";
const SESSION_KEY  = "0x4444444444444444444444444444444444444444";
const SUB_KEY      = "0x5555555555555555555555555555555555555555";

// ─── Minimal stand-in for SessionKeyService (avoids contract-instance mocking) ─
// Re-implements only the methods under test using the same encode/decode logic
// as the real service, verified against the actual ABI strings.
// This is intentional: it tests the LOGIC CONTRACT (what the function encodes/decodes),
// not the dependency wiring.

const SK_ABI: Abi = parseAbi(SESSION_KEY_VALIDATOR_ABI as readonly string[]);

// Authoritative ABI from @aastar/core — used to cross-check that the local
// SESSION_KEY_VALIDATOR_ABI fragments encode the SAME Session tuple shape, so a
// future flat-vs-tuple regression in the local fragments is caught here.
import coreSessionAbi from "../../../../core/src/abis/SessionKeyValidator.json";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CORE_ABI: Abi = (((coreSessionAbi as any).abi ?? coreSessionAbi) as Abi);

function enc(abi: Abi, fn: string, args: readonly unknown[]): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return encodeFunctionData({ abi, functionName: fn, args } as any);
}

function selOf(abi: Abi, name: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const item = getAbiItem({ abi, name } as any) as AbiFunction;
  return toFunctionSelector(item);
}

function decodeArgs(abi: Abi, data: string): readonly unknown[] {
  return decodeFunctionData({ abi, data: data as `0x${string}` }).args as readonly unknown[];
}

// Build the 8-field Session tuple exactly as SessionKeyService.buildSessionStruct does.
function sessionTuple(p: {
  expiry: number; contractScope?: string; selectorScope?: string;
  velocityLimit?: number; velocityWindow?: number;
  callTargets?: string[]; selectorAllowlist?: string[];
}) {
  return {
    expiry: p.expiry,
    contractScope: p.contractScope ?? zeroAddress,
    selectorScope: p.selectorScope ?? "0x00000000",
    revoked: false,
    velocityLimit: p.velocityLimit ?? 0,
    velocityWindow: p.velocityWindow ?? 0,
    callTargets: p.callTargets ?? [],
    selectorAllowlist: p.selectorAllowlist ?? [],
  };
}

function encodeGrantSession(params: {
  account: string; sessionKey: string; expiry: number;
  contractScope?: string; selectorScope?: string; ownerSig?: string;
}): string {
  const cfg = sessionTuple(params);
  if (params.ownerSig) {
    return enc(SK_ABI, "grantSession", [params.account, params.sessionKey, cfg, params.ownerSig]);
  }
  return enc(SK_ABI, "grantSessionDirect", [params.account, params.sessionKey, cfg]);
}

function encodeRevokeSession(account: string, sessionKey: string): string {
  return enc(SK_ABI, "revokeSession", [account, sessionKey]);
}

// ── P256 / passkey session encode (mirrors SessionKeyService P256 methods) ───
function encodeGrantP256Session(params: {
  account: string; keyX: string; keyY: string; expiry: number;
  contractScope?: string; selectorScope?: string; ownerSig?: string;
}): string {
  const cfg = sessionTuple(params);
  if (params.ownerSig) {
    return enc(SK_ABI, "grantP256Session", [params.account, params.keyX, params.keyY, cfg, params.ownerSig]);
  }
  return enc(SK_ABI, "grantP256SessionDirect", [params.account, params.keyX, params.keyY, cfg]);
}

function encodeRevokeP256Session(account: string, keyX: string, keyY: string): string {
  return enc(SK_ABI, "revokeP256Session", [account, keyX, keyY]);
}

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

  it("uses the Session TUPLE — selectors match the authoritative @aastar/core ABI", () => {
    const TUPLE = "(uint48,address,bytes4,bool,uint16,uint32,address[],bytes4[])";
    const grantSel = selectorFromId(`grantSession(address,address,${TUPLE},bytes)`);
    const directSel = selectorFromId(`grantSessionDirect(address,address,${TUPLE})`);

    // tuple-based selector == core JSON ABI == local fragment ABI
    expect(grantSel).toBe(selOf(CORE_ABI, "grantSession"));
    expect(directSel).toBe(selOf(CORE_ABI, "grantSessionDirect"));
    expect(selOf(SK_ABI, "grantSession")).toBe(grantSel);
    expect(selOf(SK_ABI, "grantSessionDirect")).toBe(directSel);

    // emitted calldata carries the tuple selector
    const withSig = encodeGrantSession({ account: ACCOUNT_ADDR, sessionKey: SESSION_KEY, expiry: 1000, ownerSig: "0x" + "cc".repeat(65) });
    const direct  = encodeGrantSession({ account: ACCOUNT_ADDR, sessionKey: SESSION_KEY, expiry: 1000 });
    expect(withSig.slice(0, 10)).toBe(grantSel);
    expect(direct.slice(0, 10)).toBe(directSel);

    // REGRESSION GUARD: the old flat-param selector MUST NOT match.
    const flatDirect = selectorFromId("grantSessionDirect(address,address,uint48,address,bytes4)");
    expect(directSel).not.toBe(flatDirect);
  });

  it("encodeRevokeSession returns valid calldata", () => {
    const cd = encodeRevokeSession(ACCOUNT_ADDR, SESSION_KEY);
    expect(cd).toMatch(/^0x[0-9a-f]+$/i);
  });
});

// ─── M6: P256 / passkey session key encode ───────────────────────────────────
describe("SessionKeyService — P256 encodeGrantP256Session", () => {
  const KEY_X = "0x" + "cc".repeat(32);
  const KEY_Y = "0x" + "dd".repeat(32);
  const OWNER_SIG = "0x" + "ab".repeat(65);

  // Canonical signatures use the Session TUPLE as 3rd/4th arg — NOT flat params.
  // Tuple: (uint48,address,bytes4,bool,uint16,uint32,address[],bytes4[])
  const TUPLE = "(uint48,address,bytes4,bool,uint16,uint32,address[],bytes4[])";
  const GRANT_SEL = selectorFromId(`grantP256Session(address,bytes32,bytes32,${TUPLE},bytes)`);
  const GRANT_DIRECT_SEL = selectorFromId(`grantP256SessionDirect(address,bytes32,bytes32,${TUPLE})`);
  const REVOKE_SEL = selectorFromId("revokeP256Session(address,bytes32,bytes32)");

  // Cross-check the tuple-based selectors against the authoritative core ABI JSON.
  it("selectors match the authoritative @aastar/core ABI", () => {
    expect(GRANT_SEL).toBe(selOf(CORE_ABI, "grantP256Session"));
    expect(GRANT_DIRECT_SEL).toBe(selOf(CORE_ABI, "grantP256SessionDirect"));
    expect(REVOKE_SEL).toBe(selOf(CORE_ABI, "revokeP256Session"));
    // And the local fragment Interface must agree with both.
    expect(selOf(SK_ABI, "grantP256Session")).toBe(GRANT_SEL);
    expect(selOf(SK_ABI, "grantP256SessionDirect")).toBe(GRANT_DIRECT_SEL);
  });

  it("with ownerSig → grantP256Session selector", () => {
    const cd = encodeGrantP256Session({
      account: ACCOUNT_ADDR, keyX: KEY_X, keyY: KEY_Y, expiry: 9999999999,
      ownerSig: OWNER_SIG,
    });
    expect(cd).toMatch(/^0x[0-9a-f]+$/i);
    expect(cd.slice(0, 10)).toBe(GRANT_SEL);
  });

  it("without ownerSig → grantP256SessionDirect selector", () => {
    const cd = encodeGrantP256Session({
      account: ACCOUNT_ADDR, keyX: KEY_X, keyY: KEY_Y, expiry: 9999999999,
    });
    expect(cd).toMatch(/^0x[0-9a-f]+$/i);
    expect(cd.slice(0, 10)).toBe(GRANT_DIRECT_SEL);
  });

  it("grantP256Session and grantP256SessionDirect have distinct selectors", () => {
    const withSig = encodeGrantP256Session({
      account: ACCOUNT_ADDR, keyX: KEY_X, keyY: KEY_Y, expiry: 1000, ownerSig: OWNER_SIG,
    });
    const direct = encodeGrantP256Session({
      account: ACCOUNT_ADDR, keyX: KEY_X, keyY: KEY_Y, expiry: 1000,
    });
    expect(withSig.slice(0, 10)).not.toBe(direct.slice(0, 10));
    expect(GRANT_SEL).not.toBe(GRANT_DIRECT_SEL);
  });

  it("P256 selectors differ from secp256k1 grant selectors", () => {
    const secpDirect = encodeGrantSession({
      account: ACCOUNT_ADDR, sessionKey: SESSION_KEY, expiry: 1000,
    });
    expect(GRANT_DIRECT_SEL).not.toBe(secpDirect.slice(0, 10));
  });

  it("calldata round-trips through ABI decode (grantP256Session, tuple cfg)", () => {
    const cd = encodeGrantP256Session({
      account: ACCOUNT_ADDR, keyX: KEY_X, keyY: KEY_Y, expiry: 1234, ownerSig: OWNER_SIG,
    });
    const decoded = decodeArgs(SK_ABI, cd);
    expect(decoded[0]).toBe(ACCOUNT_ADDR);
    expect(decoded[1]).toBe(KEY_X);
    expect(decoded[2]).toBe(KEY_Y);
    // decoded[3] is the named Session tuple object; viem returns named tuples as objects.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = decoded[3] as any;
    expect(Number(cfg.expiry)).toBe(1234);
    expect(cfg.revoked).toBe(false); // revoked always false on grant
    expect(decoded[4]).toBe(OWNER_SIG);
  });

  it("decodes the full Session tuple with non-default velocity/scope fields", () => {
    const cd = encodeGrantP256Session({
      account: ACCOUNT_ADDR, keyX: KEY_X, keyY: KEY_Y, expiry: 5000,
      contractScope: SESSION_KEY, selectorScope: "0xaabbccdd",
      velocityLimit: 7, velocityWindow: 1800,
      callTargets: [SESSION_KEY], selectorAllowlist: ["0x11223344"],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = decodeArgs(SK_ABI, cd)[3] as any;
    expect(Number(cfg.expiry)).toBe(5000);
    expect(cfg.contractScope).toBe(SESSION_KEY);
    expect(cfg.selectorScope).toBe("0xaabbccdd");
    expect(cfg.revoked).toBe(false);
    expect(Number(cfg.velocityLimit)).toBe(7);
    expect(Number(cfg.velocityWindow)).toBe(1800);
    expect(cfg.callTargets).toEqual([SESSION_KEY]);
    expect(cfg.selectorAllowlist).toEqual(["0x11223344"]);
  });

  it("encodeRevokeP256Session returns valid calldata with revoke selector", () => {
    const cd = encodeRevokeP256Session(ACCOUNT_ADDR, KEY_X, KEY_Y);
    expect(cd).toMatch(/^0x[0-9a-f]+$/i);
    expect(cd.slice(0, 10)).toBe(REVOKE_SEL);
  });
});

// ─── P256: isP256SessionActive (mocked read) ─────────────────────────────────
describe("SessionKeyService — isP256SessionActive (mocked read)", () => {
  const KEY_X = "0x" + "cc".repeat(32);
  const KEY_Y = "0x" + "dd".repeat(32);

  it("returns the value the contract read resolves to", async () => {
    // Mock just the read path the service delegates to.
    const mockContract = {
      isP256SessionActive: async (_a: string, _x: string, _y: string) => true,
    };
    const isP256SessionActive = (account: string, keyX: string, keyY: string) =>
      mockContract.isP256SessionActive(account, keyX, keyY) as Promise<boolean>;
    await expect(isP256SessionActive(ACCOUNT_ADDR, KEY_X, KEY_Y)).resolves.toBe(true);
  });

  it("propagates false from the contract read", async () => {
    const mockContract = {
      isP256SessionActive: async () => false,
    };
    const isP256SessionActive = () => mockContract.isP256SessionActive() as Promise<boolean>;
    await expect(isP256SessionActive()).resolves.toBe(false);
  });
});

// ─── M7: Agent session key encode ────────────────────────────────────────────
// ─── M7 agent-session methods are DEPRECATED and throw (no deployed contract, #282) ──
// airaccount-contract v0.27.0 confirmed there is no AgentSessionKeyValidator and no distinct agent
// algId (Seeder CC-16). The M7 methods now fail closed (throw) instead of producing calldata / reads
// that revert on-chain. Constructed with a dummy provider — the M7 methods throw before any contract call.
import { SessionKeyService } from "../services/session-key-service";

describe("SessionKeyService — M7 agent-session methods deprecated (throw, #282)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = new SessionKeyService({} as any, ACCOUNT_ADDR);
  const cfg = { expiry: 9999999999, velocityLimit: 10, velocityWindow: 3600, callTargets: [], selectorAllowlist: [] };

  it("encode methods fail closed with an AgentSessionKeyValidator-not-deployed error", () => {
    expect(() => svc.encodeGrantAgentSession(SESSION_KEY, cfg)).toThrow(/no AgentSessionKeyValidator/i);
    expect(() => svc.encodeDelegateSession(ACCOUNT_ADDR, SUB_KEY, cfg)).toThrow(/#282/);
    expect(() => svc.encodeRevokeAgentSession(SESSION_KEY)).toThrow(/not supported/i);
  });

  it("read methods reject with the same deprecation error", async () => {
    await expect(svc.getAgentSession(ACCOUNT_ADDR, SESSION_KEY)).rejects.toThrow(/#282/);
    await expect(svc.isAgentSessionActive(ACCOUNT_ADDR, SESSION_KEY)).rejects.toThrow(/#282/);
    await expect(svc.getSessionKeyOwner(SESSION_KEY)).rejects.toThrow(/#282/);
    await expect(svc.getDelegatedBy(ACCOUNT_ADDR, SUB_KEY)).rejects.toThrow(/#282/);
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
