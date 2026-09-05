import { describe, it, expect } from "vitest";
import {
  buildFullInitConfig,
  toGuardianSpecs,
  serializeGuardianSpecs,
  initConfigToTuple,
  initConfigFromRecord,
  type FullConfigGuardianParams,
} from "../services/account-init-config";
import type { AccountRecord } from "../interfaces/storage-adapter";
import { AIRACCOUNT_FACTORY_ABI } from "../constants/entrypoint";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const ZERO32 = `0x${"00".repeat(32)}`;
const P256_SENTINEL = "0x0000000000000000000000000000000000007026";

const X1 = `0x${"11".repeat(32)}` as const;
const Y1 = `0x${"22".repeat(32)}` as const;
const X2 = `0x${"33".repeat(32)}` as const;
const Y2 = `0x${"44".repeat(32)}` as const;
const ECDSA_G = "0x1111111111111111111111111111111111111111" as const;
const DAILY = 1_000_000_000_000_000_000n; // 1 ETH

describe("account-init-config helpers (#118 P-256 full-config path)", () => {
  describe("buildFullInitConfig", () => {
    it("places a single P-256 guardian's (x, y) in slot 0 and leaves the ECDSA slot zero", () => {
      const cfg = buildFullInitConfig({ p256Guardians: [{ x: X1, y: Y1 }], dailyLimit: DAILY });

      // slot 0 is a P-256 slot: ECDSA address is zero, P-256 coords carry the key.
      expect(cfg.guardians[0]).toBe(ZERO_ADDR);
      expect(cfg.guardianP256X[0]).toBe(X1);
      expect(cfg.guardianP256Y[0]).toBe(Y1);
      // unused slots are all zero
      expect(cfg.guardians).toEqual([ZERO_ADDR, ZERO_ADDR, ZERO_ADDR]);
      expect(cfg.guardianP256X.slice(1)).toEqual([ZERO32, ZERO32]);
      expect(cfg.guardianP256Y.slice(1)).toEqual([ZERO32, ZERO32]);
      // dailyLimit threaded through; approvedAlgIds default to [ECDSA, P-256] when a passkey present.
      expect(cfg.dailyLimit).toBe(DAILY);
      // #118 H1: ALG_P256 == 0x03 (NOT 0x01 = BLS). Default whitelists the ECDSA owner + P-256, never BLS.
      expect(cfg.approvedAlgIds).toEqual([0x02, 0x03]);
      expect(cfg.approvedAlgIds).toContain(0x03);
      expect(cfg.approvedAlgIds).toContain(0x02);
      expect(cfg.approvedAlgIds).not.toContain(0x01);
    });

    it("orders ECDSA guardians first, then P-256 — deterministic slot assignment", () => {
      const cfg = buildFullInitConfig({
        ecdsaGuardians: [ECDSA_G],
        p256Guardians: [{ x: X1, y: Y1 }, { x: X2, y: Y2 }],
        dailyLimit: DAILY,
      });

      // slot 0 = ECDSA, slots 1 & 2 = P-256
      expect(cfg.guardians[0].toLowerCase()).toBe(ECDSA_G);
      expect(cfg.guardianP256X[0]).toBe(ZERO32);
      expect(cfg.guardians[1]).toBe(ZERO_ADDR);
      expect(cfg.guardianP256X[1]).toBe(X1);
      expect(cfg.guardianP256Y[1]).toBe(Y1);
      expect(cfg.guardianP256X[2]).toBe(X2);
      expect(cfg.guardianP256Y[2]).toBe(Y2);
    });

    it("honors an explicit approvedAlgIds + minDailyLimit", () => {
      const cfg = buildFullInitConfig({
        p256Guardians: [{ x: X1, y: Y1 }],
        dailyLimit: DAILY,
        approvedAlgIds: [2, 1, 3],
        minDailyLimit: DAILY / 10n,
      });
      expect(cfg.approvedAlgIds).toEqual([2, 1, 3]);
      expect(cfg.minDailyLimit).toBe(DAILY / 10n);
    });

    it("rejects dailyLimit <= 0 (guard required for a guardian set)", () => {
      expect(() =>
        buildFullInitConfig({ p256Guardians: [{ x: X1, y: Y1 }], dailyLimit: 0n })
      ).toThrow(/dailyLimit/);
    });

    it("rejects > 3 guardian slots", () => {
      expect(() =>
        buildFullInitConfig({
          p256Guardians: [
            { x: X1, y: Y1 },
            { x: X2, y: Y2 },
          ],
          ecdsaGuardians: [ECDSA_G, "0x2222222222222222222222222222222222222222"],
          dailyLimit: DAILY,
        })
      ).toThrow(/at most 3 guardians/);
    });

    it("rejects a zero/half-specified P-256 coordinate (all-or-nothing)", () => {
      expect(() =>
        buildFullInitConfig({ p256Guardians: [{ x: X1, y: ZERO32 }], dailyLimit: DAILY })
      ).toThrow(/non-zero/);
    });
  });

  describe("initConfigToTuple", () => {
    // Was "emits the 8 fields in consensus-critical order", asserting `toHaveLength(8)`.
    //
    // That assertion did not miss the bug — **it pinned it**. The contract grew two fields at #161
    // and `AIRACCOUNT_FACTORY_ABI` was updated; this test then held the flattener at the old shape,
    // green, while every real `getAddress` call failed. The arity assertion lives in the describe
    // block below now, where it is READ OUT OF THE ABI instead of retyped.
    it("emits the fields in consensus-critical order", () => {
      const cfg = buildFullInitConfig({ p256Guardians: [{ x: X1, y: Y1 }], dailyLimit: DAILY });
      const t = initConfigToTuple(cfg);
      expect(t[0]).toEqual(cfg.guardians); // guardians
      expect(t[1]).toEqual(cfg.guardianP256X); // guardianP256X
      expect(t[2]).toEqual(cfg.guardianP256Y); // guardianP256Y
      expect(t[3]).toBe(cfg.dailyLimit); // dailyLimit
      expect(t[4]).toEqual(cfg.approvedAlgIds); // approvedAlgIds
      expect(t[5]).toBe(cfg.minDailyLimit); // minDailyLimit
      expect(t[6]).toEqual(cfg.initialTokens); // initialTokens
      expect(t[7]).toEqual([]); // initialTokenConfigs (default empty)
      expect(t[8]).toBe(cfg.tier1Limit); // #161 ETH tier-1 ceiling
      expect(t[9]).toBe(cfg.tier2Limit); // #161 ETH tier-2 ceiling
    });
  });

  describe("initConfigFromRecord — byte-identical deploy-time reconstruction", () => {
    function recordFor(params: FullConfigGuardianParams): AccountRecord {
      const cfg = buildFullInitConfig(params);
      return {
        userId: "u",
        address: "0xabc",
        signerAddress: "0xowner",
        salt: 1,
        deployed: false,
        deploymentTxHash: null,
        validatorAddress: "0xval",
        entryPointVersion: "0.7",
        factoryAddress: "0xfac",
        createdAt: new Date().toISOString(),
        dailyLimit: params.dailyLimit.toString(),
        guardianSpecs: serializeGuardianSpecs(toGuardianSpecs(params)),
        approvedAlgIds: [...cfg.approvedAlgIds],
        minDailyLimit: cfg.minDailyLimit.toString(),
      };
    }

    it("reconstructs the EXACT config that was predicted (P-256 only)", () => {
      const params: FullConfigGuardianParams = {
        p256Guardians: [{ x: X1, y: Y1 }],
        dailyLimit: DAILY,
        minDailyLimit: DAILY / 10n,
      };
      const created = buildFullInitConfig(params);
      const rebuilt = initConfigFromRecord(recordFor(params));
      // Deep equality of the config AND the encoded tuple => same _getConfigHash => same CREATE2 address.
      expect(rebuilt).toEqual(created);
      expect(initConfigToTuple(rebuilt)).toEqual(initConfigToTuple(created));
    });

    it("reconstructs the EXACT config for a mixed ECDSA + P-256 set", () => {
      const params: FullConfigGuardianParams = {
        ecdsaGuardians: [ECDSA_G],
        p256Guardians: [{ x: X1, y: Y1 }],
        dailyLimit: DAILY,
        approvedAlgIds: [2, 1, 3],
      };
      const created = buildFullInitConfig(params);
      const rebuilt = initConfigFromRecord(recordFor(params));
      expect(rebuilt).toEqual(created);
      expect(initConfigToTuple(rebuilt)).toEqual(initConfigToTuple(created));
    });

    it("throws on a record with no guardianSpecs (not a full-config account)", () => {
      const bare = recordFor({ p256Guardians: [{ x: X1, y: Y1 }], dailyLimit: DAILY });
      delete bare.guardianSpecs;
      expect(() => initConfigFromRecord(bare)).toThrow(/no guardianSpecs/);
    });
  });

  describe("serializeGuardianSpecs", () => {
    it("round-trips ECDSA and P-256 slots through JSON-safe shapes", () => {
      const specs = toGuardianSpecs({
        ecdsaGuardians: [ECDSA_G],
        p256Guardians: [{ x: X1, y: Y1 }],
        dailyLimit: DAILY,
      });
      const ser = serializeGuardianSpecs(specs);
      expect(ser).toEqual([{ ecdsa: ECDSA_G }, { p256: { x: X1, y: Y1 } }]);
      // serialized values are plain strings (JSON-storable)
      expect(JSON.parse(JSON.stringify(ser))).toEqual(ser);
    });

    it("never serializes the P-256 sentinel as an ECDSA address", () => {
      const specs = toGuardianSpecs({ p256Guardians: [{ x: X1, y: Y1 }], dailyLimit: DAILY });
      const ser = serializeGuardianSpecs(specs);
      for (const s of ser) {
        if ("ecdsa" in s) expect(s.ecdsa.toLowerCase()).not.toBe(P256_SENTINEL);
      }
    });
  });

  describe("initialTokens / initialTokenConfigs plumbing (#266)", () => {
    const TOKEN = "0x1111111111111111111111111111111111111111" as const;

    it("threads initialTokens + per-token configs into the InitConfig", () => {
      const cfg = buildFullInitConfig({
        p256Guardians: [],
        dailyLimit: 10n ** 18n,
        initialTokens: [TOKEN],
        initialTokenConfigs: [{ tier1Limit: 1n, tier2Limit: 2n, dailyLimit: 3n }],
      } as FullConfigGuardianParams);
      expect(cfg.initialTokens).toEqual([TOKEN]);
      expect(cfg.initialTokenConfigs).toEqual([{ tier1Limit: 1n, tier2Limit: 2n, dailyLimit: 3n }]);
    });

    it("defaults to empty when omitted (backward compatible)", () => {
      const cfg = buildFullInitConfig({ p256Guardians: [], dailyLimit: 10n ** 18n } as FullConfigGuardianParams);
      expect(cfg.initialTokens).toEqual([]);
      expect(cfg.initialTokenConfigs).toEqual([]);
    });
  });
});

describe("initConfigToTuple agrees with the ABI it feeds", () => {
  /**
   * The arity, derived from `AIRACCOUNT_FACTORY_ABI` rather than retyped.
   *
   * This is the whole point of the test. A `toHaveLength(10)` here would be a second copy of the
   * same number, and the bug it is meant to catch is precisely two copies drifting: the ABI gained
   * `tier1Limit` / `tier2Limit` at #161 and the flattener did not, so viem got eight values for a
   * ten-field tuple and reported `Cannot convert undefined to a BigInt` from inside `getAddress`.
   * Reading the count out of the ABI means the next field the contract grows fails HERE, on a
   * message that names the struct, instead of on a chain call that names neither.
   */
  const configTupleArity = (fn: "getAddress" | "createAccount"): number => {
    const sig = AIRACCOUNT_FACTORY_ABI.find(
      (e): e is string => typeof e === "string" && e.includes(`function ${fn}(`)
    );
    if (!sig) throw new Error(`no ${fn} in AIRACCOUNT_FACTORY_ABI`);
    // The `config` tuple is the parenthesised group that ends `) config`.
    const inner = /\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s+config/.exec(sig)?.[1];
    if (!inner) throw new Error(`could not find the config tuple in: ${sig.slice(0, 80)}…`);
    // Split on commas that are NOT inside the nested initialTokenConfigs tuple.
    let depth = 0;
    let fields = 1;
    for (const ch of inner) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === "," && depth === 0) fields++;
    }
    return fields;
  };

  it("reads a plausible arity out of the ABI — the meter itself must work", () => {
    // Control: if the parser silently returned 8 for everything, every assertion below would pass
    // while measuring nothing. Both entry points declare the SAME struct, so they must agree, and
    // the value must exceed the eight fields that existed before #161.
    expect(configTupleArity("getAddress")).toBe(configTupleArity("createAccount"));
    expect(configTupleArity("getAddress")).toBeGreaterThan(8);
  });

  it("emits exactly as many positional values as the ABI declares fields", () => {
    const cfg = buildFullInitConfig({ p256Guardians: [{ x: X1, y: Y1 }], dailyLimit: DAILY });
    expect(initConfigToTuple(cfg)).toHaveLength(configTupleArity("getAddress"));
  });

  it("defaults both ETH tier ceilings to 0n on this path", () => {
    const cfg = buildFullInitConfig({ p256Guardians: [{ x: X1, y: Y1 }], dailyLimit: DAILY });
    expect(initConfigToTuple(cfg).slice(8)).toEqual([0n, 0n]);
  });

  it("puts tier1 in slot 9 and tier2 in slot 10 — with values that can tell them apart", () => {
    /*
     * The first version of this test asserted `tuple[8] === cfg.tier1Limit` on a config built by
     * `buildFullInitConfig`, whose tier fields are BOTH `0n` — so it read `0n === 0n` twice and
     * was green with the two slots swapped. Mutation caught it: swapping them changed nothing.
     *
     * It had a comment saying position matters more than presence. The comment was right and the
     * test did not implement it. Distinct non-zero values are what make the assertion about ORDER
     * rather than about arity, and swapping them now fails.
     *
     * (`buildFullInitConfig` cannot produce these: `FullConfigGuardianParams` has no tier fields.
     * That is a real gap, tracked separately — but a test for the flattener should feed the
     * flattener directly rather than wait for the builder to grow a parameter.)
     */
    const cfg = {
      ...buildFullInitConfig({ p256Guardians: [{ x: X1, y: Y1 }], dailyLimit: DAILY }),
      tier1Limit: 111n,
      tier2Limit: 222n,
    };
    expect(initConfigToTuple(cfg).slice(8)).toEqual([111n, 222n]);
  });
});
