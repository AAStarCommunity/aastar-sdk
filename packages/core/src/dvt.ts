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
      // The validator the ROUTER mounts at algId 0x01, measured — not the one that merely still answers.
      //
      // FU-12. This said `0x539B9681…` and called it "router.getAlgorithm(0x01) on-chain verified",
      // which had stopped being true: measured on Sepolia, `router.getAlgorithm(0x01)` returns
      // `0x7ac7E9d4…` (= `CANONICAL_ADDRESSES[11155111].aaStarBLSAlgorithm`, v0.33.0). `0x539B…` is
      // still deployed (13610 bytes of code, same `registry()`), and all three nodeIds below report
      // `isRegistered = true` on BOTH — so neither "it has code" nor "it knows my node" distinguishes
      // the live validator from the superseded one. Only the router does. `dvt.onchain.test.ts` now
      // holds this field to that reading rather than to a literal that can quietly go stale again.
      validator: "0x7ac7E9d471742FA4397Beef0B5b11fbD22D196a9",
      entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      // Fallback nodeIds only — the live co-sign path reads nodeIds DYNAMICALLY from each node's
      // `/signature/sign` response. Do NOT hand-guess them; read them from the nodes.
      //
      // On how these ids come about, measured rather than inferred from the ABI. `registerPublicKey`
      // does take the nodeId as an ARGUMENT — but on this validator that path is closed:
      // `requireStake()` is `true`, and a 128-byte key reverts with "Staking on: use
      // registerWithProof", which derives `nodeId = keccak256(pubkey)`. So the ids ARE derived today.
      // The argument-shaped door exists and is bolted by a governance flag, not by the signature —
      // which is why FU-34 tracks the READING of `requireStake()`, not the shape of the ABI.
      dvtNodes: [
        { url: "https://dvt1.aastar.io", nodeId: "0x1f5e41c69465733eeb19341d95853ee6d9295a9e6698f5398d70e509be8f326d" },
        { url: "https://dvt2.aastar.io", nodeId: "0xe3a4a3af3973b65bc95dd962e767e17592dfb331f3544209676271b188fd9f80" },
        { url: "https://dvt3.aastar.io", nodeId: "0x96d64ba8240694153c757707732a11ff175380065ddacb6406094c9d5fa5cfce" },
      ],
      capabilities: { dvtSigning: true, relay: true, keeper: true },
    },
    /**
     * Local mirror of the Sepolia nodes, for running DVT-dependent E2E when the public tunnels
     * are down (dvt1/2/3.aastar.io returned HTTP 530 on 2026-08-18 — the cloudflared tunnel, not
     * the nodes: the services bind 127.0.0.1:3001-3003 and the tunnel container forwards to them).
     *
     * The `nodeId`s are IDENTICAL to `sepolia` ON PURPOSE, and that is the whole point: on-chain
     * verification checks the aggregate against the PUBLIC KEYS REGISTERED ON THE VALIDATOR, so a
     * local instance must sign with the ALREADY-REGISTERED BLS private keys. Freshly generated
     * "test" keys would need registering on 0x539B — which is the shared production whole-set
     * validator, so that would enlarge its node set for everyone. Reuse, never mint.
     *
     * Same key signing in two places does not conflict: BLS is deterministic over (key, message),
     * so both produce byte-identical partials.
     *
     * Bring the nodes up (DVT repo, no tunnel/autoheal):
     *   docker compose -f docker-compose.testnet.yml up dvt-node-1 dvt-node-2 dvt-node-3
     * Then point the SDK at them for the run:
     *   AASTAR_DVT_ENV=testnet-local pnpm exec tsx tests/regression/onchain-evidence/tier3-composite-e2e.ts
     *
     * Mirrors the DVT repo's `deploy/sdk-dvt-config.testnet.json` `environments` block.
     */
    "testnet-local": {
      chainId: 11155111,
      // Same validator as `sepolia` — this environment changes WHERE the nodes are reached, never
      // what verifies them (see the nodeId note above: the keys are the already-registered ones).
      validator: "0x7ac7E9d471742FA4397Beef0B5b11fbD22D196a9",
      entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      dvtNodes: [
        { url: "http://127.0.0.1:3001", nodeId: "0x1f5e41c69465733eeb19341d95853ee6d9295a9e6698f5398d70e509be8f326d" },
        { url: "http://127.0.0.1:3002", nodeId: "0xe3a4a3af3973b65bc95dd962e767e17592dfb331f3544209676271b188fd9f80" },
        { url: "http://127.0.0.1:3003", nodeId: "0x96d64ba8240694153c757707732a11ff175380065ddacb6406094c9d5fa5cfce" },
      ],
      // relay:false — this environment exists for local co-signing only. Leaving it true would let
      // getDvtRelayerUrlsForChain hand localhost URLs to the gasless relay pool for chain 11155111.
      capabilities: { dvtSigning: true, relay: false, keeper: false },
    },
    // Mainnet not yet deployed — fill this block + set `active: "mainnet"` for a zero-code switch.
    mainnet: null,
  },
};

/**
 * Resolve the active (or named) DVT environment. Throws if that environment isn't configured.
 * Precedence: explicit `active` arg > `AASTAR_DVT_ENV` env var > `DVT_CONFIG.active` default.
 * The env var makes switching the DEFAULT a zero-release change (no need to pass `active` everywhere).
 */
export function getDvtConfig(active?: string): DvtEnvironment {
  const envOverride = typeof process !== 'undefined' ? process.env?.AASTAR_DVT_ENV : undefined;
  const key = active ?? envOverride ?? DVT_CONFIG.active;
  const env = DVT_CONFIG.environments[key];
  if (!env) throw new Error(`DVT config: environment "${key}" is not configured`);
  return env;
}

/** Convenience: the relay base URLs for the active (or named) environment. */
export function getDvtRelayerUrls(active?: string): string[] {
  return getDvtConfig(active).dvtNodes.map((n) => n.url);
}

/**
 * Relay base URLs for a specific chainId (the relay-capable DVT environment matching it).
 * Single source of truth for the gasless-relay pool — `TokenSaleClient` reads this instead of
 * duplicating URLs. Returns `[]` if no relay-capable environment matches the chain.
 */
export function getDvtRelayerUrlsForChain(chainId: number): string[] {
  for (const env of Object.values(DVT_CONFIG.environments)) {
    if (env && env.chainId === chainId && env.capabilities.relay) {
      return env.dvtNodes.map((n) => n.url);
    }
  }
  return [];
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
        // FU-35. The config DECLARES capabilities; /health REPORTS them. Every declared capability
        // is checked against what the node says about itself — previously only `relay` was, so a
        // config claiming `dvtSigning` against a node that had it turned off looked healthy, and the
        // failure surfaced later as a co-signature that never arrived.
        //
        // Only the declared→reported direction is an error. A node offering MORE than the config
        // claims is not a fault: capabilities are a floor on what this environment needs, not an
        // inventory of the node.
        for (const cap of ["dvtSigning", "relay", "keeper"] as const) {
          if (e.capabilities[cap] && !r.capabilities[cap]) {
            r.errors.push(`/health: ${cap} capability declared in config but disabled on the node`);
          }
        }
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
        // Probed regardless — knowing an undeclared relay is broken is useful — but it is only an
        // ERROR when this environment claims relay. `testnet-local` deliberately runs without it.
        const rh = await getJson(`${base}/relay/health`);
        r.relayOk = rh.status === "ok";
        if (!r.relayOk && e.capabilities.relay) r.errors.push(`/relay/health status=${rh.status}`);
      } catch (err: any) {
        if (e.capabilities.relay) r.errors.push(`/relay/health: ${err?.message ?? err}`);
      }
      // `ok` now means "no recorded problem", which is what every caller already assumed it meant.
      //
      // It did not. `errors` and `ok` were computed independently: a node whose declared capability
      // was reported disabled collected an error and was still `ok === true`. Nothing consumed the
      // errors, so the mismatch was invisible — a status field and a diagnosis field that can
      // contradict each other, where the summary is the one people read.
      //
      // `relayOk` is folded in through the same route rather than as a separate term: it counts only
      // when the environment claims relay (`testnet-local` runs without it by design), and when it
      // does claim relay a failure is already in `errors`.
      r.ok = r.healthOk && r.nodeIdMatch && r.errors.length === 0;
      return r;
    }),
  );
}
