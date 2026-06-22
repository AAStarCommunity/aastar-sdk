/**
 * DVT node configuration — the AAStar decentralized validator/relay/keeper nodes.
 *
 * Each node provides three capabilities behind one base URL:
 *  - BLS co-signing  (`POST /signature/sign`)
 *  - gasless relay   (`POST /v3/relay`)        — see {@link LaunchSaleAddresses.relayerUrls}
 *  - price keeper    (server-side, no client API)
 *
 * Config is grouped by environment so mainnet is a zero-code switch: fill `environments.mainnet`
 * and flip `active`. The SDK reads `environments[active]` for the node URLs + contract addresses.
 * Source of truth mirrors the DVT repo `deploy/sdk-dvt-config.testnet.json` (aastar-sdk#153).
 */

export interface DvtNode {
  /** Base URL (no trailing slash); endpoints are appended (`/signature/sign`, `/v3/relay`, `/health`). */
  url: string;
  /** Node identity (bytes32); cross-checked against `GET /node/info`. */
  nodeId: string;
}

export interface DvtEnvironment {
  chainId: number;
  /** AAStarBLSAlgorithm validator. */
  validator: `0x${string}`;
  entryPoint: `0x${string}`;
  dvtNodes: DvtNode[];
  capabilities: { dvtSigning: boolean; relay: boolean; keeper: boolean };
}

export interface DvtConfig {
  /** Active environment key into {@link DvtConfig.environments}. */
  active: string;
  environments: Record<string, DvtEnvironment | null>;
}

/** Default DVT config. Testnet (Sepolia) is live; mainnet is a placeholder to fill + flip `active`. */
export const DVT_CONFIG: DvtConfig = {
  active: "sepolia",
  environments: {
    sepolia: {
      chainId: 11155111,
      validator: "0xAF525A161CB17e0A1b6254ef0B8d8473bdA05174",
      entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      dvtNodes: [
        { url: "https://dvt1.aastar.io", nodeId: "0x2df775b934046ddd210828fb5096ea8a15bb18a145dae5bd94535375c319c53f" },
        { url: "https://dvt2.aastar.io", nodeId: "0xd907ad728a7091c5cc628d9c7c71ae8d69f062a39533a2890bea3c299bacd201" },
        { url: "https://dvt3.aastar.io", nodeId: "0xd4f954361cdb2b2d89a631c939b6f930de5b2c5753911d2be7fb1ecc9f17a60e" },
      ],
      capabilities: { dvtSigning: true, relay: true, keeper: true },
    },
    // Mainnet not yet deployed — fill this block + set `active: "mainnet"` for a zero-code switch.
    mainnet: null,
  },
};

/** Resolve the active (or named) DVT environment. Throws if that environment isn't configured. */
export function getDvtConfig(active?: string): DvtEnvironment {
  const key = active ?? DVT_CONFIG.active;
  const env = DVT_CONFIG.environments[key];
  if (!env) throw new Error(`DVT config: environment "${key}" is not configured`);
  return env;
}

/** Convenience: the relay base URLs for the active (or named) environment. */
export function getDvtRelayerUrls(active?: string): string[] {
  return getDvtConfig(active).dvtNodes.map((n) => n.url);
}

/** Per-node result of {@link checkDvtConnectivity}. */
export interface DvtNodeHealth {
  url: string;
  nodeId: string;
  /** All three checks passed. */
  ok: boolean;
  reachable: boolean;
  healthOk: boolean;
  relayOk: boolean;
  nodeIdMatch: boolean;
  capabilities?: Record<string, boolean>;
  errors: string[];
}

/**
 * Startup connectivity self-test (aastar-sdk#153): for each node verify `GET /health` (status ok +
 * capabilities), `GET /node/info` (nodeId matches config), and `GET /relay/health` (status ok).
 * Never throws — returns one result per node so the caller can warn / fail over.
 *
 * @param env the environment object, an environment key, or undefined (active).
 * @param fetchImpl optional fetch (for tests); defaults to global fetch.
 */
export async function checkDvtConnectivity(
  env?: DvtEnvironment | string,
  fetchImpl: typeof fetch = fetch,
): Promise<DvtNodeHealth[]> {
  const e = typeof env === "object" ? env : getDvtConfig(env);
  const getJson = async (url: string) => {
    const res = await fetchImpl(url);
    return res.json() as Promise<any>;
  };
  return Promise.all(
    e.dvtNodes.map(async (node): Promise<DvtNodeHealth> => {
      const base = node.url.replace(/\/$/, "");
      const r: DvtNodeHealth = {
        url: node.url, nodeId: node.nodeId, ok: false,
        reachable: false, healthOk: false, relayOk: false, nodeIdMatch: false, errors: [],
      };
      try {
        const h = await getJson(`${base}/health`);
        r.reachable = true;
        r.capabilities = Object.fromEntries((h.capabilities ?? []).map((c: any) => [c.name, !!c.enabled]));
        r.healthOk = h.status === "ok";
        if (!r.healthOk) r.errors.push(`/health status=${h.status}`);
        if (e.capabilities.relay && !r.capabilities.relay) r.errors.push("/health: relay capability disabled");
      } catch (err: any) {
        r.errors.push(`/health unreachable: ${err?.message ?? err}`);
        return r; // node down — skip the rest
      }
      try {
        const info = await getJson(`${base}/node/info`);
        r.nodeIdMatch = String(info.nodeId ?? "").toLowerCase() === node.nodeId.toLowerCase();
        if (!r.nodeIdMatch) r.errors.push(`/node/info nodeId mismatch (got ${info.nodeId})`);
      } catch (err: any) {
        r.errors.push(`/node/info: ${err?.message ?? err}`);
      }
      try {
        const rh = await getJson(`${base}/relay/health`);
        r.relayOk = rh.status === "ok";
        if (!r.relayOk) r.errors.push(`/relay/health status=${rh.status}`);
      } catch (err: any) {
        r.errors.push(`/relay/health: ${err?.message ?? err}`);
      }
      r.ok = r.healthOk && r.relayOk && r.nodeIdMatch;
      return r;
    }),
  );
}
