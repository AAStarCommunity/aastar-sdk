import { describe, it, expect, vi, beforeEach } from "vitest";
import { ethers } from "ethers";
import { AgentRegistryService } from "../services/agent-registry-service";

const REGISTRY     = "0xe1320c35485b4d7817866a8d0d8f77dd58202253"; // beta.4 AgentRegistry
const FACTORY      = "0x3a9127a5f0b4ca734d54629d0c3ad9f52739c071"; // beta.4 factory
const OWNER        = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const AGENT_WALLET = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const AGENT_KEY    = "0xcccccccccccccccccccccccccccccccccccccccc";
const GUARDIAN_2   = "0xdddddddddddddddddddddddddddddddddddddddd";
const NEW_REGISTRY = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const DUMMY_SIG    = "0x" + "ab".repeat(65);
const AGENT_ID     = ethers.id("agent-1"); // bytes32

// Canonical signatures — the selector is keccak256(sig).slice(0, 10).
// These are cross-checked against packages/core/src/abis/{AgentRegistry,AAStarAirAccountFactoryV7}.json.
const SELECTOR = (sig: string) => ethers.id(sig).slice(0, 10);

/** Build a mock provider whose eth_call returns `encoded` for every read. */
function mockReadProvider(encoded: string): ethers.Provider {
  return {
    getNetwork: vi.fn().mockResolvedValue({ chainId: 11155111n }),
    call: vi.fn().mockResolvedValue(encoded),
  } as unknown as ethers.Provider;
}

const coder = ethers.AbiCoder.defaultAbiCoder();

// Authoritative cross-check: every encoder's selector must equal the function selector
// derived from the @aastar/core JSON ABIs (not just a hand-written signature string). This
// guards against the flat-params-vs-struct-tuple class of drift between SDK and contract.
describe("AgentRegistryService — selectors match @aastar/core JSON ABIs", () => {
  it("registry + factory encoder selectors equal the core ABI selectors", async () => {
    const [{ default: registryAbi }, { default: factoryAbi }] = await Promise.all([
      import("../../../../core/src/abis/AgentRegistry.json", { with: { type: "json" } }),
      import("../../../../core/src/abis/AAStarAirAccountFactoryV7.json", { with: { type: "json" } }),
    ]);
    const reg = new ethers.Interface((registryAbi as any).abi ?? registryAbi);
    const fac = new ethers.Interface((factoryAbi as any).abi ?? factoryAbi);
    const svc = new AgentRegistryService(ethers.getDefaultProvider(), REGISTRY);

    expect(svc.encodeRegisterAgent(AGENT_WALLET, DUMMY_SIG).slice(0, 10)).toBe(reg.getFunction("registerAgent")!.selector);
    expect(svc.encodeRevokeAgent(AGENT_WALLET).slice(0, 10)).toBe(reg.getFunction("revokeAgent")!.selector);
    expect(svc.encodeDeregisterAgent(AGENT_WALLET).slice(0, 10)).toBe(reg.getFunction("deregisterAgent")!.selector);
    expect(svc.encodeSetAgentRegistry(REGISTRY).slice(0, 10)).toBe(fac.getFunction("setAgentRegistry")!.selector);
  });
});

describe("AgentRegistryService — calldata encoders", () => {
  let svc: AgentRegistryService;

  beforeEach(() => {
    svc = new AgentRegistryService(ethers.getDefaultProvider(), REGISTRY);
  });

  describe("encodeRegisterAgent", () => {
    it("matches the canonical registerAgent(address,bytes) selector", () => {
      const cd = svc.encodeRegisterAgent(AGENT_WALLET, DUMMY_SIG);
      expect(cd.slice(0, 10)).toBe(SELECTOR("registerAgent(address,bytes)"));
      expect(cd).toMatch(/^0x[0-9a-f]+$/i);
    });

    it("different agentWallet → different calldata, same selector", () => {
      const cd1 = svc.encodeRegisterAgent(AGENT_WALLET, DUMMY_SIG);
      const cd2 = svc.encodeRegisterAgent(AGENT_KEY, DUMMY_SIG);
      expect(cd1.slice(0, 10)).toBe(cd2.slice(0, 10));
      expect(cd1).not.toBe(cd2);
    });

    it("round-trips through the registry interface", () => {
      const cd = svc.encodeRegisterAgent(AGENT_WALLET, DUMMY_SIG);
      const iface = new ethers.Interface([
        "function registerAgent(address agentWallet, bytes agentWalletSig)",
      ]);
      const decoded = iface.decodeFunctionData("registerAgent", cd);
      expect(decoded[0].toLowerCase()).toBe(AGENT_WALLET.toLowerCase());
      expect(decoded[1]).toBe(DUMMY_SIG);
    });
  });

  describe("encodeRevokeAgent", () => {
    it("matches the canonical revokeAgent(address) selector", () => {
      const cd = svc.encodeRevokeAgent(AGENT_WALLET);
      expect(cd.slice(0, 10)).toBe(SELECTOR("revokeAgent(address)"));
    });
  });

  describe("encodeDeregisterAgent", () => {
    it("matches the canonical deregisterAgent(address) selector", () => {
      const cd = svc.encodeDeregisterAgent(AGENT_WALLET);
      expect(cd.slice(0, 10)).toBe(SELECTOR("deregisterAgent(address)"));
    });

    it("differs from revokeAgent selector", () => {
      const revoke = svc.encodeRevokeAgent(AGENT_WALLET);
      const dereg = svc.encodeDeregisterAgent(AGENT_WALLET);
      expect(revoke.slice(0, 10)).not.toBe(dereg.slice(0, 10));
    });
  });

  describe("encodeCreateAgentAccount — factory target", () => {
    const params = {
      agentKey: AGENT_KEY,
      agentId: AGENT_ID,
      guardian2: GUARDIAN_2,
      guardian2Sig: DUMMY_SIG,
      agentKeySig: DUMMY_SIG,
      deadline: 9_999_999_999n,
      dailyLimit: 1_000_000_000_000_000_000n,
    };

    it("matches the canonical createAgentAccount selector", () => {
      const cd = svc.encodeCreateAgentAccount(params);
      expect(cd.slice(0, 10)).toBe(
        SELECTOR("createAgentAccount(address,bytes32,address,bytes,bytes,uint48,uint256)")
      );
    });

    it("different dailyLimit → different calldata, same selector", () => {
      const cd1 = svc.encodeCreateAgentAccount(params);
      const cd2 = svc.encodeCreateAgentAccount({ ...params, dailyLimit: 5n });
      expect(cd1.slice(0, 10)).toBe(cd2.slice(0, 10));
      expect(cd1).not.toBe(cd2);
    });

    it("round-trips all 7 args", () => {
      const cd = svc.encodeCreateAgentAccount(params);
      const iface = new ethers.Interface([
        "function createAgentAccount(address agentKey, bytes32 agentId, address guardian2, bytes guardian2Sig, bytes agentKeySig, uint48 deadline, uint256 dailyLimit)",
      ]);
      const d = iface.decodeFunctionData("createAgentAccount", cd);
      expect(d[0].toLowerCase()).toBe(AGENT_KEY.toLowerCase());
      expect(d[1]).toBe(AGENT_ID);
      expect(d[2].toLowerCase()).toBe(GUARDIAN_2.toLowerCase());
      expect(BigInt(d[5])).toBe(9_999_999_999n);
      expect(BigInt(d[6])).toBe(1_000_000_000_000_000_000n);
    });
  });

  describe("encodeSetAgentRegistry — factory target", () => {
    it("matches the canonical setAgentRegistry(address) selector", () => {
      const cd = svc.encodeSetAgentRegistry(NEW_REGISTRY);
      expect(cd.slice(0, 10)).toBe(SELECTOR("setAgentRegistry(address)"));
    });
  });
});

describe("AgentRegistryService — on-chain read mocks", () => {
  it("isRegisteredAgent decodes a bool", async () => {
    const svc = new AgentRegistryService(mockReadProvider(coder.encode(["bool"], [true])), REGISTRY);
    expect(await svc.isRegisteredAgent(AGENT_WALLET)).toBe(true);
  });

  it("isValidAccount decodes a bool", async () => {
    const svc = new AgentRegistryService(
      mockReadProvider(coder.encode(["bool"], [false])),
      REGISTRY
    );
    expect(await svc.isValidAccount(AGENT_WALLET)).toBe(false);
  });

  it("getHumanOwner decodes an address", async () => {
    const svc = new AgentRegistryService(
      mockReadProvider(coder.encode(["address"], [OWNER])),
      REGISTRY
    );
    expect((await svc.getHumanOwner(AGENT_WALLET)).toLowerCase()).toBe(OWNER.toLowerCase());
  });

  it("getAgentCount decodes a uint256 as bigint", async () => {
    const svc = new AgentRegistryService(
      mockReadProvider(coder.encode(["uint256"], [3n])),
      REGISTRY
    );
    const count = await svc.getAgentCount(OWNER);
    expect(count).toBe(3n);
    expect(typeof count).toBe("bigint");
  });

  it("getAgents decodes an address[] into a plain array", async () => {
    const agents = [AGENT_WALLET, AGENT_KEY];
    const svc = new AgentRegistryService(
      mockReadProvider(coder.encode(["address[]"], [agents])),
      REGISTRY
    );
    const result = await svc.getAgents(OWNER);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0].toLowerCase()).toBe(AGENT_WALLET.toLowerCase());
    expect(result[1].toLowerCase()).toBe(AGENT_KEY.toLowerCase());
  });

  it("getAgentsPage decodes a paginated address[]", async () => {
    const svc = new AgentRegistryService(
      mockReadProvider(coder.encode(["address[]"], [[AGENT_KEY]])),
      REGISTRY
    );
    const page = await svc.getAgentsPage(OWNER, 0, 10);
    expect(page).toHaveLength(1);
    expect(page[0].toLowerCase()).toBe(AGENT_KEY.toLowerCase());
  });

  it("getAgentByIndex decodes an address", async () => {
    const svc = new AgentRegistryService(
      mockReadProvider(coder.encode(["address"], [AGENT_WALLET])),
      REGISTRY
    );
    expect((await svc.getAgentByIndex(OWNER, 0)).toLowerCase()).toBe(AGENT_WALLET.toLowerCase());
  });

  it("getAgentAccountAddress reads the predicted CREATE2 address from the factory", async () => {
    const predicted = "0x1111111111111111111111111111111111111111";
    const svc = new AgentRegistryService(
      mockReadProvider(coder.encode(["address"], [predicted])),
      REGISTRY
    );
    const addr = await svc.getAgentAccountAddress(FACTORY, OWNER, AGENT_KEY, AGENT_ID);
    expect(addr.toLowerCase()).toBe(predicted.toLowerCase());
  });

  it("getFactoryAgentRegistry reads the bound registry from the factory", async () => {
    const svc = new AgentRegistryService(
      mockReadProvider(coder.encode(["address"], [REGISTRY])),
      REGISTRY
    );
    expect((await svc.getFactoryAgentRegistry(FACTORY)).toLowerCase()).toBe(REGISTRY.toLowerCase());
  });
});
