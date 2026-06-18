import { describe, it, expect } from "vitest";
import { CANONICAL_ADDRESSES } from "@aastar/core";
import { AIRACCOUNT_ADDRESSES } from "./entrypoint";

// Anti-drift guard: the CURRENT (non-deprecated) Sepolia fields of
// AIRACCOUNT_ADDRESSES MUST be derived from @aastar/core CANONICAL_ADDRESSES
// (single source of truth). If core is re-synced on a protocol redeploy but
// this package fails to follow, these assertions fail in CI — exactly the
// stale-beta.4 bug this test exists to prevent.
describe("AIRACCOUNT_ADDRESSES.sepolia is sourced from @aastar/core", () => {
  const core = CANONICAL_ADDRESSES[11155111];
  const aa = AIRACCOUNT_ADDRESSES.sepolia;

  // airaccount field → core canonical key (verified mapping).
  const MAPPING: Array<[keyof typeof aa, keyof typeof core]> = [
    ["factory", "airAccountFactoryV7"],
    ["factoryM7", "airAccountFactoryV7"],
    ["accountImpl", "airAccountV7Impl"],
    ["validatorRouter", "aaStarValidator"],
    ["blsAlgorithm", "aaStarBLSAlgorithm"],
    ["blsAggregator", "aaStarBLSAggregator"],
    ["sessionKeyValidator", "sessionKeyValidator"],
    ["forceExitModule", "forceExitModule"],
    ["airAccountDelegate", "airAccountDelegate"],
    ["airAccountExtension", "airAccountExtension"],
    ["agentRegistry", "agentRegistry"],
    ["calldataParserRegistry", "calldataParserRegistry"],
    ["superPaymaster", "superPaymaster"],
  ];

  it.each(MAPPING)("%s equals core.%s", (aaKey, coreKey) => {
    expect(aa[aaKey]).toBe(core[coreKey]);
  });
});
