import { parseAbi, toFunctionSelector, type AbiFunction } from "viem";
import { AAStarAirAccountFactoryV7ABI } from "@aastar/core";
import {
  EntryPointVersion,
  ENTRYPOINT_ADDRESSES,
  ENTRYPOINT_ABI_V6,
  ENTRYPOINT_ABI_V7_V8,
  FACTORY_ABI_V6,
  FACTORY_ABI_V7_V8,
  ACCOUNT_ABI,
  VALIDATOR_ABI,
  ERC20_ABI,
  AIRACCOUNT_FACTORY_ABI,
} from "../constants/entrypoint";

describe("EntryPoint constants", () => {
  describe("EntryPointVersion enum", () => {
    it("should have v0.6, v0.7, v0.8", () => {
      expect(EntryPointVersion.V0_6).toBe("0.6");
      expect(EntryPointVersion.V0_7).toBe("0.7");
      expect(EntryPointVersion.V0_8).toBe("0.8");
    });
  });

  describe("ENTRYPOINT_ADDRESSES", () => {
    it("should have addresses for all versions", () => {
      expect(ENTRYPOINT_ADDRESSES[EntryPointVersion.V0_6].sepolia).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(ENTRYPOINT_ADDRESSES[EntryPointVersion.V0_7].sepolia).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(ENTRYPOINT_ADDRESSES[EntryPointVersion.V0_8].sepolia).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it("should have matching mainnet and sepolia addresses (canonical deployment)", () => {
      for (const version of Object.values(EntryPointVersion)) {
        expect(ENTRYPOINT_ADDRESSES[version].sepolia).toBe(ENTRYPOINT_ADDRESSES[version].mainnet);
      }
    });
  });

  describe("ABIs", () => {
    it("should include getUserOpHash in v0.6 ABI", () => {
      expect(ENTRYPOINT_ABI_V6.some(s => s.includes("getUserOpHash"))).toBe(true);
    });

    it("should include getUserOpHash in v0.7/v0.8 ABI", () => {
      expect(ENTRYPOINT_ABI_V7_V8.some(s => s.includes("getUserOpHash"))).toBe(true);
    });

    it("should include getNonce in both ABIs", () => {
      expect(ENTRYPOINT_ABI_V6.some(s => s.includes("getNonce"))).toBe(true);
      expect(ENTRYPOINT_ABI_V7_V8.some(s => s.includes("getNonce"))).toBe(true);
    });

    it("v0.6 factory should have createAccountWithAAStarValidator", () => {
      expect(FACTORY_ABI_V6.some(s => s.includes("createAccountWithAAStarValidator"))).toBe(true);
    });

    it("v0.7/v0.8 factory should have createAccount", () => {
      expect(FACTORY_ABI_V7_V8.some(s => s.includes("createAccount"))).toBe(true);
    });

    it("ACCOUNT_ABI should have execute function", () => {
      expect(ACCOUNT_ABI.some(s => s.includes("execute"))).toBe(true);
    });

    it("VALIDATOR_ABI should have getGasEstimate", () => {
      expect(VALIDATOR_ABI.some(s => s.includes("getGasEstimate"))).toBe(true);
    });

    it("ERC20_ABI should have standard ERC20 functions", () => {
      const expected = ["name", "symbol", "decimals", "balanceOf", "transfer", "approve"];
      for (const fn of expected) {
        expect(ERC20_ABI.some(s => s.includes(fn))).toBe(true);
      }
    });
  });

  // #118 (M1): the local human-readable AIRACCOUNT_FACTORY_ABI must produce the EXACT 4-byte selector
  // the DEPLOYED v0.20.0 factory exposes for every InitConfig-bearing function. The expected values are
  // HARDCODED (not just compared between the two SDK ABI sources) so that if both SDK sources drift
  // together — e.g. back to TokenConfig (uint256,uint256,uint256) instead of the deployed
  // (uint128 tier1Limit, uint128 tier2Limit, uint256 dailyLimit) per AAStarGlobalGuard.sol — this test
  // fails instead of silently agreeing while reverting on-chain. These selectors were confirmed against
  // live Sepolia factory 0x99C9300d52EDD9f4B7135DEd1811fBa6FFa1DDC6 (createAccount/getAddress both mined
  // status=0x1 in the #118 evidence run).
  describe("AIRACCOUNT_FACTORY_ABI selector parity with the deployed v0.22.0 factory", () => {
    const parsed = parseAbi(AIRACCOUNT_FACTORY_ABI) as readonly AbiFunction[];
    const json = AAStarAirAccountFactoryV7ABI as readonly AbiFunction[];

    // Known-good selectors of the deployed v0.22.0 factory (createAccount 8-arg: +ownerP256X/Y, nonce,
    // deadline, ownerSig; getAddress / getAddressWithChainId 5-arg: +ownerP256X/Y).
    const DEPLOYED_SELECTORS: Record<string, `0x${string}`> = {
      getAddress: "0xbd4bcf83",
      createAccount: "0x5f6314a2",
      getAddressWithChainId: "0xaf799fc6",
    };

    for (const [name, expected] of Object.entries(DEPLOYED_SELECTORS)) {
      it(`${name} selector == deployed factory (${expected})`, () => {
        const hr = parsed.find(a => a.type === "function" && a.name === name);
        expect(hr, `local ABI is missing ${name}`).toBeTruthy();
        const j = json.find(
          a => a.type === "function" && a.name === name && a.inputs.length === hr!.inputs.length
        );
        expect(j, `JSON ABI is missing ${name}`).toBeTruthy();
        // Both SDK ABI sources AND the on-chain factory must agree on the pinned selector.
        expect(toFunctionSelector(hr!)).toBe(expected);
        expect(toFunctionSelector(j!)).toBe(expected);
      });
    }

    it("InitConfig TokenConfig packs tier limits as uint128 (not uint256)", () => {
      // Guards the exact field that drifted: the create/getAddress InitConfig must carry uint128 tiers.
      expect(AIRACCOUNT_FACTORY_ABI.some(s => s.includes("uint128 tier1Limit, uint128 tier2Limit, uint256 dailyLimit"))).toBe(true);
      expect(AIRACCOUNT_FACTORY_ABI.some(s => s.includes("uint256 tier1Limit, uint256 tier2Limit, uint256 dailyLimit"))).toBe(false);
    });
  });
});
