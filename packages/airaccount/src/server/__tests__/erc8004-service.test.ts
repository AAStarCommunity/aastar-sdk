import { describe, it, expect } from "vitest";
import { ethers } from "ethers";
import {
  ERC8004Service,
  ERC8004_ADDRESSES,
  erc8004AddressesForChain,
} from "../services/erc8004-service";

const ACCOUNT      = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const AGENT_WALLET = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const AGENT_REG    = "0xcccccccccccccccccccccccccccccccccccccccc"; // AAStar AgentRegistry (not official ERC-8004)
const DUMMY_SIG    = "0x" + "ab".repeat(65);

describe("ERC8004_ADDRESSES", () => {
  it("testnet identityRegistry starts with 0x8004A818", () => {
    expect(ERC8004_ADDRESSES.testnet.identityRegistry.toLowerCase()).toContain("0x8004a818");
  });

  it("testnet reputationRegistry starts with 0x8004B663", () => {
    expect(ERC8004_ADDRESSES.testnet.reputationRegistry.toLowerCase()).toContain("0x8004b663");
  });

  it("mainnet identityRegistry starts with 0x8004A169", () => {
    expect(ERC8004_ADDRESSES.mainnet.identityRegistry.toLowerCase()).toContain("0x8004a169");
  });

  it("mainnet and testnet addresses are different", () => {
    expect(ERC8004_ADDRESSES.mainnet.identityRegistry).not.toBe(
      ERC8004_ADDRESSES.testnet.identityRegistry,
    );
  });
});

describe("erc8004AddressesForChain", () => {
  it("chain 11155111 (Sepolia) returns testnet addresses", () => {
    const addrs = erc8004AddressesForChain(11155111);
    expect(addrs.identityRegistry).toBe(ERC8004_ADDRESSES.testnet.identityRegistry);
  });

  it("chain 11155420 (OP Sepolia) returns testnet addresses", () => {
    const addrs = erc8004AddressesForChain(11155420);
    expect(addrs.identityRegistry).toBe(ERC8004_ADDRESSES.testnet.identityRegistry);
  });

  it("chain 1 (Ethereum mainnet) returns mainnet addresses", () => {
    const addrs = erc8004AddressesForChain(1);
    expect(addrs.identityRegistry).toBe(ERC8004_ADDRESSES.mainnet.identityRegistry);
  });

  it("chain 10 (OP Mainnet) returns mainnet addresses", () => {
    const addrs = erc8004AddressesForChain(10);
    expect(addrs.identityRegistry).toBe(ERC8004_ADDRESSES.mainnet.identityRegistry);
  });

  it("throws for unsupported chain", () => {
    expect(() => erc8004AddressesForChain(999999)).toThrow(/unsupported chain/i);
  });
});

describe("ERC8004Service calldata encoders", () => {
  let svc: ERC8004Service;

  beforeEach(() => {
    svc = new ERC8004Service();
  });

  describe("encodeSetAgentWallet — AAStar AgentRegistry path", () => {
    it("produces valid hex calldata", () => {
      const cd = svc.encodeSetAgentWallet({
        agentId: 1n,
        agentWallet: AGENT_WALLET,
        agentRegistry: AGENT_REG,
        agentWalletSig: DUMMY_SIG,
      });
      expect(cd).toMatch(/^0x[0-9a-f]+$/i);
      expect(cd.length).toBeGreaterThan(10);
    });

    it("different agentId → different calldata, same 4-byte selector", () => {
      const cd1 = svc.encodeSetAgentWallet({ agentId: 1n, agentWallet: AGENT_WALLET, agentRegistry: AGENT_REG, agentWalletSig: DUMMY_SIG });
      const cd2 = svc.encodeSetAgentWallet({ agentId: 2n, agentWallet: AGENT_WALLET, agentRegistry: AGENT_REG, agentWalletSig: DUMMY_SIG });
      expect(cd1.slice(0, 10)).toBe(cd2.slice(0, 10));
      expect(cd1).not.toBe(cd2);
    });

    it("different agentRegistry → different calldata", () => {
      const cd1 = svc.encodeSetAgentWallet({ agentId: 1n, agentWallet: AGENT_WALLET, agentRegistry: AGENT_REG, agentWalletSig: DUMMY_SIG });
      const cd2 = svc.encodeSetAgentWallet({ agentId: 1n, agentWallet: AGENT_WALLET, agentRegistry: ACCOUNT, agentWalletSig: DUMMY_SIG });
      expect(cd1).not.toBe(cd2);
    });
  });

  describe("encodeMintAgentIdentity — official ERC-8004 path", () => {
    const identityRegistry = ERC8004_ADDRESSES.testnet.identityRegistry;

    it("produces valid hex calldata", () => {
      const cd = svc.encodeMintAgentIdentity({ identityRegistry, agentURI: "ipfs://Qm..." });
      expect(cd).toMatch(/^0x[0-9a-f]+$/i);
    });

    it("different agentURI → different calldata, same selector", () => {
      const cd1 = svc.encodeMintAgentIdentity({ identityRegistry, agentURI: "ipfs://QmA" });
      const cd2 = svc.encodeMintAgentIdentity({ identityRegistry, agentURI: "ipfs://QmB" });
      expect(cd1.slice(0, 10)).toBe(cd2.slice(0, 10));
      expect(cd1).not.toBe(cd2);
    });

    it("selector differs from setAgentWallet", () => {
      const setWallet = svc.encodeSetAgentWallet({ agentId: 1n, agentWallet: AGENT_WALLET, agentRegistry: AGENT_REG, agentWalletSig: DUMMY_SIG });
      const mintIdentity = svc.encodeMintAgentIdentity({ identityRegistry, agentURI: "ipfs://Qm" });
      expect(setWallet.slice(0, 10)).not.toBe(mintIdentity.slice(0, 10));
    });
  });

  describe("encodeBindERC8004AgentWallet — official ERC-8004 path", () => {
    const identityRegistry = ERC8004_ADDRESSES.testnet.identityRegistry;

    it("produces valid hex calldata", () => {
      const cd = svc.encodeBindERC8004AgentWallet({
        identityRegistry,
        agentId: 42n,
        agentWallet: AGENT_WALLET,
        deadline: 9999999999n,
        signature: DUMMY_SIG,
      });
      expect(cd).toMatch(/^0x[0-9a-f]+$/i);
    });

    it("different deadline → different calldata", () => {
      const cd1 = svc.encodeBindERC8004AgentWallet({ identityRegistry, agentId: 1n, agentWallet: AGENT_WALLET, deadline: 100n, signature: DUMMY_SIG });
      const cd2 = svc.encodeBindERC8004AgentWallet({ identityRegistry, agentId: 1n, agentWallet: AGENT_WALLET, deadline: 200n, signature: DUMMY_SIG });
      expect(cd1).not.toBe(cd2);
    });
  });

  describe("encodeSubmitAgentReputation", () => {
    const reputationRegistry = ERC8004_ADDRESSES.testnet.reputationRegistry;
    const baseParams = {
      reputationRegistry,
      agentId: 1n,
      value: 100n,
      valueDecimals: 0,
      tag1: "quality",
      tag2: "",
      endpoint: "https://agent.example.com",
      feedbackURI: "ipfs://QmFeedback",
      feedbackHash: ethers.ZeroHash,
    };

    it("produces valid hex calldata", () => {
      const cd = svc.encodeSubmitAgentReputation(baseParams);
      expect(cd).toMatch(/^0x[0-9a-f]+$/i);
    });

    it("different value → different calldata, same selector", () => {
      const cd1 = svc.encodeSubmitAgentReputation(baseParams);
      const cd2 = svc.encodeSubmitAgentReputation({ ...baseParams, value: 50n });
      expect(cd1.slice(0, 10)).toBe(cd2.slice(0, 10));
      expect(cd1).not.toBe(cd2);
    });
  });

  describe("encodeQueryAgentReputation", () => {
    const reputationRegistry = ERC8004_ADDRESSES.testnet.reputationRegistry;

    it("produces valid hex calldata", () => {
      const cd = svc.encodeQueryAgentReputation({
        reputationRegistry,
        agentId: 1n,
        clientAddresses: [ACCOUNT],
        tag1: "quality",
        tag2: "",
      });
      expect(cd).toMatch(/^0x[0-9a-f]+$/i);
    });

    it("different clientAddresses → different calldata", () => {
      const cd1 = svc.encodeQueryAgentReputation({ reputationRegistry, agentId: 1n, clientAddresses: [ACCOUNT], tag1: "quality", tag2: "" });
      const cd2 = svc.encodeQueryAgentReputation({ reputationRegistry, agentId: 1n, clientAddresses: [AGENT_WALLET], tag1: "quality", tag2: "" });
      expect(cd1).not.toBe(cd2);
    });
  });

  describe("provider-required methods — throw when no provider given", () => {
    it("queryAgentReputation throws without provider", async () => {
      await expect(
        svc.queryAgentReputation(ACCOUNT, {
          reputationRegistry: ERC8004_ADDRESSES.testnet.reputationRegistry,
          agentId: 1n, clientAddresses: [], tag1: "", tag2: "",
        }),
      ).rejects.toThrow(/provider required/i);
    });

    it("getAgentExtensionAddress throws without provider", async () => {
      await expect(svc.getAgentExtensionAddress(ACCOUNT)).rejects.toThrow(/provider required/i);
    });
  });
});
