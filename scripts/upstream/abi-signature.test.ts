/**
 * Regression lock for the upstream radar's SIGNATURE-LEVEL diff (the v0.20.0 lesson).
 *
 * A bare function-name diff is blind to a struct/param-shape change: the factory's
 * `getAddress(address,uint256,InitConfig)` keeps the same name and arity when the
 * `InitConfig` tuple grows from 6 → 8 fields (gaining `guardianP256X/Y`). The radar
 * only caught the v0.20.0 InitConfig change because `canonicalAbiType` expands tuples
 * recursively. These tests pin that behaviour so it can't silently regress back to a
 * name-only diff (which would let a future struct change slip through undetected).
 */
import { describe, it, expect } from "vitest";
import {
  canonicalAbiType,
  abiFunctionSignature,
  abiMemberSignatures,
} from "./abi-signature.js";
import { writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The 6-field (pre-v0.20.0) InitConfig: no guardianP256X/Y.
const initConfig6 = {
  name: "config",
  type: "tuple",
  components: [
    { name: "guardians", type: "address[3]" },
    { name: "dailyLimit", type: "uint256" },
    { name: "approvedAlgIds", type: "uint8[]" },
    { name: "minDailyLimit", type: "uint256" },
    { name: "initialTokens", type: "address[]" },
    {
      name: "initialTokenConfigs",
      type: "tuple[]",
      components: [
        { name: "tier1Limit", type: "uint128" },
        { name: "tier2Limit", type: "uint128" },
        { name: "dailyLimit", type: "uint256" },
      ],
    },
  ],
};

// The 8-field (v0.20.0) InitConfig: adds guardianP256X/Y (bytes32[3]) after `guardians`.
const initConfig8 = {
  name: "config",
  type: "tuple",
  components: [
    { name: "guardians", type: "address[3]" },
    { name: "guardianP256X", type: "bytes32[3]" },
    { name: "guardianP256Y", type: "bytes32[3]" },
    { name: "dailyLimit", type: "uint256" },
    { name: "approvedAlgIds", type: "uint8[]" },
    { name: "minDailyLimit", type: "uint256" },
    { name: "initialTokens", type: "address[]" },
    {
      name: "initialTokenConfigs",
      type: "tuple[]",
      components: [
        { name: "tier1Limit", type: "uint128" },
        { name: "tier2Limit", type: "uint128" },
        { name: "dailyLimit", type: "uint256" },
      ],
    },
  ],
};

const getAddress6 = {
  type: "function",
  name: "getAddress",
  inputs: [{ name: "owner", type: "address" }, { name: "salt", type: "uint256" }, initConfig6],
  outputs: [{ type: "address" }],
};
const getAddress8 = {
  type: "function",
  name: "getAddress",
  inputs: [{ name: "owner", type: "address" }, { name: "salt", type: "uint256" }, initConfig8],
  outputs: [{ type: "address" }],
};

describe("canonicalAbiType — recursive tuple expansion", () => {
  it("expands a nested tuple[] with its array suffix preserved", () => {
    expect(canonicalAbiType(initConfig6)).toBe(
      "(address[3],uint256,uint8[],uint256,address[],(uint128,uint128,uint256)[])",
    );
  });

  it("reflects the two extra bytes32[3] fields in the 8-field tuple", () => {
    expect(canonicalAbiType(initConfig8)).toBe(
      "(address[3],bytes32[3],bytes32[3],uint256,uint8[],uint256,address[],(uint128,uint128,uint256)[])",
    );
  });

  it("distinguishes the 6-field from the 8-field InitConfig", () => {
    expect(canonicalAbiType(initConfig6)).not.toBe(canonicalAbiType(initConfig8));
  });
});

describe("abiFunctionSignature — name-identical functions diverge on a struct change", () => {
  it("a 6-field getAddress and an 8-field getAddress have the SAME name but DIFFERENT signatures", () => {
    const sig6 = abiFunctionSignature(getAddress6);
    const sig8 = abiFunctionSignature(getAddress8);
    expect(getAddress6.name).toBe(getAddress8.name); // a name-only diff would see them as equal
    expect(sig6).not.toBe(sig8); // the signature-level diff catches the param-shape change
    expect(sig6).toContain("address[3],uint256,uint8[]"); // 6-field shape (no P256 guardians)
    expect(sig8).toContain("address[3],bytes32[3],bytes32[3]"); // 8-field shape (P256 guardians present)
  });
});

describe("abiMemberSignatures — a member-set diff surfaces the InitConfig change", () => {
  it("the getAddress member signature set differs between the 6- and 8-field ABIs", () => {
    const dir = tmpdir();
    const f6 = join(dir, `radar-abi6-${process.pid}.json`);
    const f8 = join(dir, `radar-abi8-${process.pid}.json`);
    try {
      writeFileSync(f6, JSON.stringify([getAddress6]));
      writeFileSync(f8, JSON.stringify([getAddress8]));
      const sigs6 = abiMemberSignatures(f6).get("function:getAddress")!;
      const sigs8 = abiMemberSignatures(f8).get("function:getAddress")!;
      expect(sigs6).toBeDefined();
      expect(sigs8).toBeDefined();
      // The set difference is non-empty in BOTH directions: the radar would report drift.
      const only8 = [...sigs8].filter((s) => !sigs6.has(s));
      const only6 = [...sigs6].filter((s) => !sigs8.has(s));
      expect(only8.length).toBeGreaterThan(0);
      expect(only6.length).toBeGreaterThan(0);
    } finally {
      rmSync(f6, { force: true });
      rmSync(f8, { force: true });
    }
  });
});
