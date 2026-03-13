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
});
