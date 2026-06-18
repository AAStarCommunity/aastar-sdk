import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAbiItem, toFunctionSelector, type Abi, type AbiFunction, type PublicClient } from "viem";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { selectorFromId } from "../../migration/viem/hashing";
import {
  WeightedSignatureService,
  WEIGHT_CHANGE_THRESHOLD,
  type WeightConfig,
} from "../services/weighted-signature-service";

const ACCOUNT = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

// Canonical WeightConfig tuple signature (field order matches AAStarAirAccountV7.json).
const CONFIG_TUPLE = "(uint8,uint8,uint8,uint8,uint8,uint8,uint8,uint8,uint8,uint8)";
const selector = (sig: string): string => selectorFromId(sig);

// Cross-check selectors against the core ABI JSON (single source of truth).
const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE_ABI_PATH = resolve(
  __dirname,
  "../../../../core/src/abis/AAStarAirAccountV7.json"
);
const coreAbiRaw = JSON.parse(readFileSync(CORE_ABI_PATH, "utf8"));
const coreAbi = (Array.isArray(coreAbiRaw) ? coreAbiRaw : coreAbiRaw.abi) as Abi;
const coreSelector = (name: string): string =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toFunctionSelector(getAbiItem({ abi: coreAbi, name } as any) as AbiFunction);

/** A throwaway client for encoder-only tests (encoders never touch the client). */
const noClient = {} as unknown as PublicClient;

/** A viem PublicClient stub whose read resolves to `value`. */
function mockReadClient(value: unknown): PublicClient {
  return {
    readContract: vi.fn().mockResolvedValue(value),
  } as unknown as PublicClient;
}

const SAMPLE_CONFIG: WeightConfig = {
  passkeyWeight: 1,
  ecdsaWeight: 2,
  blsWeight: 1,
  guardian0Weight: 1,
  guardian1Weight: 1,
  guardian2Weight: 1,
  _padding: 0,
  tier1Threshold: 3,
  tier2Threshold: 4,
  tier3Threshold: 5,
};

describe("WeightedSignatureService — calldata encoders", () => {
  let svc: WeightedSignatureService;

  beforeEach(() => {
    svc = new WeightedSignatureService(ACCOUNT, noClient);
  });

  describe("encodeSetWeightConfig", () => {
    it("produces calldata with the exact 4-byte selector (tuple sig + core ABI cross-check)", () => {
      const cd = svc.encodeSetWeightConfig(SAMPLE_CONFIG);
      const expected = selector(`setWeightConfig(${CONFIG_TUPLE})`);
      expect(cd.slice(0, 10)).toBe(expected);
      expect(cd.slice(0, 10)).toBe(coreSelector("setWeightConfig"));
      expect(cd).toMatch(/^0x[0-9a-f]+$/i);
    });

    it("different config → different calldata, same selector", () => {
      const cd1 = svc.encodeSetWeightConfig(SAMPLE_CONFIG);
      const cd2 = svc.encodeSetWeightConfig({ ...SAMPLE_CONFIG, ecdsaWeight: 3 });
      expect(cd1.slice(0, 10)).toBe(cd2.slice(0, 10));
      expect(cd1).not.toBe(cd2);
    });
  });

  describe("encodeProposeWeightChange", () => {
    it("produces calldata with the exact 4-byte selector (tuple sig + core ABI cross-check)", () => {
      const cd = svc.encodeProposeWeightChange(SAMPLE_CONFIG);
      const expected = selector(`proposeWeightChange(${CONFIG_TUPLE})`);
      expect(cd.slice(0, 10)).toBe(expected);
      expect(cd.slice(0, 10)).toBe(coreSelector("proposeWeightChange"));
    });

    it("encodes the config payload (differs from setWeightConfig calldata)", () => {
      const set = svc.encodeSetWeightConfig(SAMPLE_CONFIG);
      const propose = svc.encodeProposeWeightChange(SAMPLE_CONFIG);
      // Same tuple payload, different selector.
      expect(set.slice(0, 10)).not.toBe(propose.slice(0, 10));
      expect(set.slice(10)).toBe(propose.slice(10));
    });
  });

  describe("encodeApproveWeightChange", () => {
    it("produces calldata with the exact 4-byte selector (no args)", () => {
      const cd = svc.encodeApproveWeightChange();
      const expected = selector("approveWeightChange()");
      expect(cd).toBe(expected);
      expect(cd).toBe(coreSelector("approveWeightChange"));
    });
  });

  describe("encodeCancelWeightChange", () => {
    it("produces calldata with the exact 4-byte selector (no args)", () => {
      const cd = svc.encodeCancelWeightChange();
      const expected = selector("cancelWeightChange()");
      expect(cd).toBe(expected);
      expect(cd).toBe(coreSelector("cancelWeightChange"));
    });
  });

  describe("encodeExecuteWeightChange", () => {
    it("produces calldata with the exact 4-byte selector (no args)", () => {
      const cd = svc.encodeExecuteWeightChange();
      const expected = selector("executeWeightChange()");
      expect(cd).toBe(expected);
      expect(cd).toBe(coreSelector("executeWeightChange"));
    });
  });

  describe("all encoders produce distinct selectors", () => {
    it("five distinct selectors", () => {
      const selectors = [
        svc.encodeSetWeightConfig(SAMPLE_CONFIG).slice(0, 10),
        svc.encodeProposeWeightChange(SAMPLE_CONFIG).slice(0, 10),
        svc.encodeApproveWeightChange().slice(0, 10),
        svc.encodeCancelWeightChange().slice(0, 10),
        svc.encodeExecuteWeightChange().slice(0, 10),
      ];
      expect(new Set(selectors).size).toBe(5);
    });
  });

  describe("constants", () => {
    it("threshold is 2-of-3 guardians", () => {
      expect(WEIGHT_CHANGE_THRESHOLD).toBe(2);
    });
  });
});

describe("WeightedSignatureService — on-chain read mocks", () => {
  it("getWeightConfig decodes the struct fields in canonical order", async () => {
    // weightConfig() returns 10 separate uint8 outputs → viem yields a positional array.
    const client = mockReadClient([1, 2, 1, 1, 1, 1, 0, 3, 4, 5]);

    const svc = new WeightedSignatureService(ACCOUNT, client);
    const cfg = await svc.getWeightConfig();

    expect(cfg).toEqual(SAMPLE_CONFIG);
    expect(cfg.passkeyWeight).toBe(1);
    expect(cfg.ecdsaWeight).toBe(2);
    expect(cfg.tier1Threshold).toBe(3);
    expect(cfg.tier3Threshold).toBe(5);
  });

  it("getPendingWeightChange decodes proposed config + proposedAt + approvalBitmap", async () => {
    // pendingWeightChange() returns (tuple proposed, uint256 proposedAt, uint256 approvalBitmap).
    const client = mockReadClient([[1, 2, 1, 1, 1, 1, 0, 3, 4, 5], 1717200000n, 3n]);

    const svc = new WeightedSignatureService(ACCOUNT, client);
    const pending = await svc.getPendingWeightChange();

    expect(pending.proposed).toEqual(SAMPLE_CONFIG);
    expect(pending.proposedAt).toBe(1717200000n);
    expect(pending.approvalBitmap).toBe(3n);
  });
});
