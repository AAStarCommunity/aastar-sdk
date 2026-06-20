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

  // #118: the local human-readable AIRACCOUNT_FACTORY_ABI must produce the SAME 4-byte selector as
  // the canonical JSON ABI for every InitConfig-bearing function. A type drift (e.g. declaring
  // TokenConfig as (uint256,uint256,uint256) instead of the deployed (uint128,uint128,uint256))
  // silently changes the selector and reverts the call on the live v0.20.0 factory.
  describe("AIRACCOUNT_FACTORY_ABI selector parity with canonical JSON ABI", () => {
    const parsed = parseAbi(AIRACCOUNT_FACTORY_ABI) as readonly AbiFunction[];
    const json = AAStarAirAccountFactoryV7ABI as readonly AbiFunction[];

    for (const name of ["getAddress", "createAccount", "getAddressWithChainId"]) {
      it(`${name} selector matches the deployed factory`, () => {
        const hr = parsed.find(a => a.type === "function" && a.name === name);
        expect(hr, `local ABI is missing ${name}`).toBeTruthy();
        const j = json.find(
          a => a.type === "function" && a.name === name && a.inputs.length === hr!.inputs.length
        );
        expect(j, `JSON ABI is missing ${name}`).toBeTruthy();
        expect(toFunctionSelector(hr!)).toBe(toFunctionSelector(j!));
      });
    }

    it("InitConfig TokenConfig packs tier limits as uint128 (not uint256)", () => {
      // Guards the exact field that drifted: the create/getAddress InitConfig must carry uint128 tiers.
      expect(AIRACCOUNT_FACTORY_ABI.some(s => s.includes("uint128 tier1Limit, uint128 tier2Limit, uint256 dailyLimit"))).toBe(true);
      expect(AIRACCOUNT_FACTORY_ABI.some(s => s.includes("uint256 tier1Limit, uint256 tier2Limit, uint256 dailyLimit"))).toBe(false);
    });
  });
});
