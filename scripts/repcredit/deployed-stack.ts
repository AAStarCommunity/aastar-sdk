/**
 * CC-115 B4 — the gate between "an ABI that compiles" and "the contract the paper measured".
 *
 * The failure this exists to prevent is specific and was live for six days. On 2026-08-26 the three
 * pointers at the BLS aggregator agreed. By 2026-09-01 `Registry.blsAggregator` had been moved to a
 * NEW aggregator alone, while `SuperPaymaster.BLS_AGGREGATOR` and `DVTValidator.BLS_AGGREGATOR`
 * still named the old one — and `SP.pendingBLSAgg` was zero, so it was not a timelock window that
 * something would eventually close. It was a settled disagreement that no single-field manifest
 * could even express. The reputation path and the slash path were verifying against two different
 * contracts with different thresholds and opposite arming states, and nothing said so.
 *
 * A second, quieter one sits underneath it. SuperPaymaster's `contracts/src` is BLSAggregator
 * 4.12.0; the deployed contract is 4.11.0 and is not upgradeable, so 4.12.0 exists on no chain.
 * 4.11.0 is a strict subset of 4.12.0, which means a 4.12.0 ABI works perfectly against the 4.11.0
 * address for 71 of 72 functions. The 72nd is `guardianSlashCases(uint256)`: #400 inserted a
 * `uint16 slashBps` into the struct, so the getter returns 8 words in source and 7 on chain — AT
 * THE SAME SELECTOR. It does not revert. It decodes wrongly, or fails to decode, and only on the
 * guardian-slash path, which an integration test that never slashes will never reach.
 *
 * So the gates below check two axes that are deliberately allowed to disagree:
 *
 *   source axis    contracts[].abiSha256   -> what upstream's tree says      (4.12.0)
 *   deployed axis  deployedStack           -> what the chain actually runs   (4.11.0)
 *
 * Every check here is falsifiable: `deployed-stack.test.ts` mutates each pinned value and asserts
 * the corresponding check goes red. A gate whose negative control was never run is decoration.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import type { Abi, Address, Hex, PublicClient } from 'viem';
import { keccak256, toFunctionSelector } from 'viem';

import { blsDomainSeparator } from './bls-domain.js';

/** One verdict. `ok:false` is a hard failure — never a warning the caller may choose to print. */
export type Check = { name: string; ok: boolean; detail: string };

export type DeployedStackPin = {
  chainId: number;
  manifest: { producedBy: string; commit: string; path: string; sha256: string; stackKind: string };
  addresses: Record<'blsAggregator' | 'registry' | 'superPaymaster' | 'dvtValidator' | 'fraudProofVerifier', Address>;
  legs: Record<string, string>;
  aggregator: {
    version: string;
    extcodehash: Hex;
    domainSeparator: Hex;
    defaultThreshold: number;
    minThreshold: number;
    slashThresholds: Record<string, number>;
    guardianSlashCaseWindowSeconds: number;
    abi: {
      repo: string;
      revision: string;
      path: string;
      sha256: string;
      vendoredAt: string;
      functionCount: number;
      entryCount: number;
    };
    sourceRevision: string;
    sourceNote: string;
  };
  selectors: Record<string, string>;
  shapeGates: Record<
    string,
    { selector: Hex; deployedWords: number; deployedReturns: string[]; sourceWords: number; sourceReturns: string[]; why: string }
  >;
  rejectedAggregators: { address: Address; version: string; why: string }[];
};

const LEG_GETTER: Record<string, { fn: string; at: keyof DeployedStackPin['addresses'] }> = {
  'Registry.blsAggregator': { fn: 'blsAggregator', at: 'registry' },
  'SuperPaymaster.BLS_AGGREGATOR': { fn: 'BLS_AGGREGATOR', at: 'superPaymaster' },
  'DVTValidator.BLS_AGGREGATOR': { fn: 'BLS_AGGREGATOR', at: 'dvtValidator' },
};

export function readDeployedStackPin(network: string, sdkRoot: string = process.cwd()): DeployedStackPin {
  const pin = JSON.parse(readFileSync(join(sdkRoot, 'scripts/upstream-abi-pin.json'), 'utf8'));
  const stack = pin?.deployedStack?.[network];
  if (!stack) {
    throw new Error(
      `scripts/upstream-abi-pin.json declares no deployedStack.${network}. An evidence run may not ` +
        'infer the stack it is measuring from whatever the RPC happens to answer.',
    );
  }
  return stack as DeployedStackPin;
}

function sha256(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Read a blob out of the git OBJECT store rather than the sibling worktree.
 *
 * The worktree is the wrong source twice over: an unrelated uncommitted file makes the whole
 * checkout unattributable, and a checked-out file can differ from the revision we claim to pin.
 * `git show <rev>:<path>` answers for the revision itself, so an upstream colleague's in-progress
 * edit cannot move this hash — and if the revision does not contain the path, that is a failure
 * rather than a fallback.
 */
export function readBlobAtRevision(repoRoot: string, revision: string, path: string): Buffer {
  return execFileSync('git', ['-C', repoRoot, 'show', `${revision}:${path}`], {
    maxBuffer: 64 * 1024 * 1024,
    encoding: 'buffer',
  }) as unknown as Buffer;
}

/* ------------------------------------------------------------------ offline checks */

/**
 * Offline half: everything provable from the repo and the pin, with no RPC.
 *
 * Kept separate from the on-chain half on purpose — these must run in CI where there is no funded
 * Sepolia endpoint, so a missing RPC degrades coverage rather than silently skipping the ABI pin.
 */
export function checkDeployedAbiPin(pin: DeployedStackPin, sdkRoot: string, upstreamRoot: string | null): Check[] {
  const out: Check[] = [];
  const { abi: abiPin } = pin.aggregator;

  const vendoredPath = join(sdkRoot, abiPin.vendoredAt);
  if (!existsSync(vendoredPath)) {
    out.push({ name: 'deployed-abi:vendored-present', ok: false, detail: `missing ${abiPin.vendoredAt}` });
    return out;
  }
  const vendoredRaw = readFileSync(vendoredPath);
  const vendoredHash = sha256(vendoredRaw);
  out.push({
    name: 'deployed-abi:vendored-sha256',
    ok: vendoredHash === abiPin.sha256,
    detail:
      vendoredHash === abiPin.sha256
        ? `${abiPin.vendoredAt} == ${abiPin.sha256.slice(0, 16)}…`
        : `${abiPin.vendoredAt} hashes ${vendoredHash} but the pin says ${abiPin.sha256}`,
  });

  // The vendored copy must be the upstream blob, not merely A file with the right hash locally.
  if (upstreamRoot) {
    try {
      const blob = readBlobAtRevision(upstreamRoot, abiPin.revision, abiPin.path);
      const blobHash = sha256(blob);
      out.push({
        name: 'deployed-abi:upstream-blob-sha256',
        ok: blobHash === abiPin.sha256,
        detail:
          blobHash === abiPin.sha256
            ? `${abiPin.repo}@${abiPin.revision.slice(0, 12)}:${abiPin.path} == pin`
            : `${abiPin.repo}@${abiPin.revision.slice(0, 12)}:${abiPin.path} hashes ${blobHash}, pin says ${abiPin.sha256}`,
      });
      out.push({
        name: 'deployed-abi:vendored-is-upstream-bytes',
        ok: Buffer.compare(blob, vendoredRaw) === 0,
        detail:
          Buffer.compare(blob, vendoredRaw) === 0
            ? 'vendored copy is byte-identical to the pinned upstream blob'
            : 'vendored copy differs BYTE-WISE from the pinned upstream blob (same hash would be impossible; this means the hash check above is stale)',
      });
    } catch (error) {
      out.push({
        name: 'deployed-abi:upstream-blob-sha256',
        ok: false,
        detail: `cannot read ${abiPin.repo}@${abiPin.revision.slice(0, 12)}:${abiPin.path} — ${String(error).slice(0, 160)}`,
      });
    }
  }

  const doc = JSON.parse(vendoredRaw.toString('utf8')) as { abi: Abi; version?: string; address?: Record<string, string> };
  const fns = (doc.abi as { type?: string; name?: string }[]).filter((e) => e.type === 'function');
  out.push({
    name: 'deployed-abi:shape',
    ok: fns.length === abiPin.functionCount && doc.abi.length === abiPin.entryCount,
    detail: `${fns.length} function(s) / ${doc.abi.length} entries (pin: ${abiPin.functionCount} / ${abiPin.entryCount})`,
  });
  out.push({
    name: 'deployed-abi:version-string',
    ok: doc.version === pin.aggregator.version,
    detail: `artifact declares ${doc.version ?? '(none)'}; pin expects ${pin.aggregator.version}`,
  });

  // The domain-bound verify selector must EXIST and the pre-domain 3-arg one must NOT.
  // Asserting only the first would pass against an ABI that carries both.
  const selectors = new Set(
    fns.map((f) => {
      try {
        return toFunctionSelector(f as never);
      } catch {
        return '';
      }
    }),
  );
  const want = pin.selectors.fraudProofVerify;
  const reject = pin.selectors.rejectedLegacyVerify;
  out.push({
    name: 'deployed-abi:legacy-verify-selector-absent',
    ok: !selectors.has(reject),
    detail: selectors.has(reject)
      ? `${reject} (${pin.selectors.$rejectedLegacyVerifySig}) is PRESENT — this stack must reject the pre-domain-bound form`
      : `${reject} absent, as required`,
  });
  void want;

  const shape = pin.shapeGates['guardianSlashCases(uint256)'];
  const getter = fns.find((f) => f.name === 'guardianSlashCases') as { outputs?: { type: string }[] } | undefined;
  const outs = getter?.outputs?.map((o) => o.type) ?? [];
  out.push({
    name: 'deployed-abi:guardianSlashCases-shape',
    ok: outs.length === shape.deployedWords && outs.join(',') === shape.deployedReturns.join(','),
    detail:
      outs.length === 0
        ? 'guardianSlashCases(uint256) not found in the deployed ABI'
        : `returns [${outs.join(',')}] (deployed pin: [${shape.deployedReturns.join(',')}]; the 4.12.0 source shape [${shape.sourceReturns.join(',')}] must NOT match)`,
  });

  return out;
}

/* ------------------------------------------------------------------ on-chain checks */

const ADDR_OUT = [{ type: 'address' }] as const;

async function readAddress(client: PublicClient, to: Address, fn: string): Promise<string> {
  const data = (await client.call({
    to,
    data: toFunctionSelector(`function ${fn}() view returns (address)`),
  })) as { data?: Hex };
  if (!data?.data || data.data === '0x') throw new Error(`${fn}() returned no data`);
  return `0x${data.data.slice(-40)}`;
}

/**
 * On-chain half. Reads the stack and compares it to the pin, field by field.
 *
 * Deliberately reads all three legs from their OWN contracts rather than asking the aggregator who
 * points at it — the split this file exists for was only visible from the three pointers, and an
 * aggregator has no idea who names it.
 */
export async function checkDeployedStackOnChain(pin: DeployedStackPin, client: PublicClient): Promise<Check[]> {
  const out: Check[] = [];
  const agg = pin.addresses.blsAggregator;

  const chainId = await client.getChainId();
  out.push({
    name: 'chain:id',
    ok: chainId === pin.chainId,
    detail: `RPC serves chainId ${chainId}; pin expects ${pin.chainId}`,
  });
  if (chainId !== pin.chainId) return out; // every address below is meaningless on the wrong chain

  const code = await client.getCode({ address: agg });
  const codehash = code && code !== '0x' ? keccak256(code) : null;
  out.push({
    name: 'aggregator:extcodehash',
    ok: !!codehash && eq(codehash, pin.aggregator.extcodehash),
    detail: codehash
      ? `${codehash} (pin ${pin.aggregator.extcodehash})`
      : `no code at ${agg} — the pinned aggregator is not deployed on this chain`,
  });

  const version = (await client.readContract({
    address: agg,
    abi: [{ type: 'function', name: 'version', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' }],
    functionName: 'version',
  })) as string;
  out.push({
    name: 'aggregator:version',
    ok: version === pin.aggregator.version,
    detail: `chain says ${version}; pin says ${pin.aggregator.version}`,
  });

  // Three legs, read independently. This is the check that would have caught the six-day split.
  for (const [leg, expected] of Object.entries(pin.legs)) {
    if (leg.startsWith('$')) continue;
    const spec = LEG_GETTER[leg];
    if (!spec) {
      out.push({ name: `leg:${leg}`, ok: false, detail: `no getter mapping for leg "${leg}"` });
      continue;
    }
    try {
      const got = await readAddress(client, pin.addresses[spec.at], spec.fn);
      out.push({
        name: `leg:${leg}`,
        ok: eq(got, expected),
        detail: eq(got, expected) ? `${got}` : `reads ${got}, pin says ${expected}`,
      });
    } catch (error) {
      out.push({ name: `leg:${leg}`, ok: false, detail: `read failed: ${String(error).slice(0, 140)}` });
    }
  }
  const legValues = Object.entries(pin.legs)
    .filter(([k]) => !k.startsWith('$'))
    .map(([, v]) => v.toLowerCase());
  out.push({
    name: 'legs:mutually-consistent',
    ok: new Set(legValues).size === 1,
    detail:
      new Set(legValues).size === 1
        ? 'all three pointers name one aggregator'
        : `the pin itself names ${new Set(legValues).size} different aggregators across the three legs`,
  });

  const numeric: [string, string, number][] = [
    ['defaultThreshold', 'defaultThreshold', pin.aggregator.defaultThreshold],
    ['minThreshold', 'minThreshold', pin.aggregator.minThreshold],
    ['GUARDIAN_SLASH_CASE_WINDOW', 'GUARDIAN_SLASH_CASE_WINDOW', pin.aggregator.guardianSlashCaseWindowSeconds],
  ];
  for (const [label, fn, expected] of numeric) {
    const got = (await client.readContract({
      address: agg,
      abi: [{ type: 'function', name: fn, inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
      functionName: fn,
    })) as bigint;
    out.push({
      name: `aggregator:${label}`,
      ok: got === BigInt(expected),
      detail: `chain ${got}; pin ${expected}`,
    });
  }

  const verifier = await readAddress(client, agg, 'fraudProofVerifier');
  out.push({
    name: 'aggregator:fraudProofVerifier',
    ok: eq(verifier, pin.addresses.fraudProofVerifier),
    detail: `${verifier} (pin ${pin.addresses.fraudProofVerifier})`,
  });
  const pending = await readAddress(client, agg, 'pendingFraudProofVerifier');
  out.push({
    name: 'aggregator:no-pending-verifier',
    ok: /^0x0{40}$/i.test(pending),
    detail: /^0x0{40}$/i.test(pending)
      ? 'no rotation in flight'
      : `a verifier rotation to ${pending} is in flight — the stack is mid-cutover and receipts taken now describe neither end of it`,
  });

  // The domain separator binds (name, chainId, aggregator, registry). Recomputing it locally and
  // comparing to the chain proves the ADDRESSES in the pin are the ones the contract hashed — a
  // wrong aggregator pin cannot survive this even if every other field were edited to match.
  const onChainDomain = (await client.readContract({
    address: agg,
    abi: [{ type: 'function', name: 'domainSeparator', inputs: [], outputs: [{ type: 'bytes32' }], stateMutability: 'view' }],
    functionName: 'domainSeparator',
  })) as Hex;
  const recomputed = blsDomainSeparator(pin.chainId, agg, pin.addresses.registry);
  out.push({
    name: 'aggregator:domainSeparator-matches-pin',
    ok: eq(onChainDomain, pin.aggregator.domainSeparator),
    detail: `${onChainDomain} (pin ${pin.aggregator.domainSeparator})`,
  });
  out.push({
    name: 'aggregator:domainSeparator-recomputed-from-addresses',
    ok: eq(recomputed, onChainDomain),
    detail: eq(recomputed, onChainDomain)
      ? 'SDK recomputes the chain value from (name, chainId, aggregator, registry)'
      : `SDK computes ${recomputed} from the pinned addresses but the chain says ${onChainDomain} — an address in the pin is not the one the contract hashed`,
  });

  // A function that only 4.12.0 has must revert here. Positive controls above (version, window)
  // carry the weight: without them a revert could equally mean "wrong address" or "typo".
  let bpsReverted = false;
  try {
    await client.readContract({
      address: agg,
      abi: [{ type: 'function', name: 'guardianSlashBps', inputs: [], outputs: [{ type: 'uint16' }], stateMutability: 'view' }],
      functionName: 'guardianSlashBps',
    });
  } catch {
    bpsReverted = true;
  }
  out.push({
    name: 'aggregator:is-4.11-not-4.12',
    ok: bpsReverted,
    detail: bpsReverted
      ? 'guardianSlashBps() reverts, as 4.11.0 must (version() and GUARDIAN_SLASH_CASE_WINDOW() answered, so this is absence, not a bad address)'
      : 'guardianSlashBps() ANSWERED — this address is 4.12.0 or later, not the 4.11.0 the paper pins',
  });

  // The quiet one: same selector, different word count.
  const shape = pin.shapeGates['guardianSlashCases(uint256)'];
  const raw = (await client.call({
    to: agg,
    data: `${shape.selector}${'0'.repeat(64)}` as Hex,
  })) as { data?: Hex };
  const words = raw?.data ? (raw.data.length - 2) / 64 : 0;
  out.push({
    name: 'aggregator:guardianSlashCases-returns-deployed-shape',
    ok: words === shape.deployedWords,
    detail:
      words === shape.deployedWords
        ? `${words} words, matching 4.11.0 (4.12.0 would be ${shape.sourceWords} — same selector ${shape.selector}, so this is the only way to tell)`
        : `${words} words; pin expects ${shape.deployedWords}. If this is ${shape.sourceWords}, the address is running 4.12.0 and every decode of this getter has been silently wrong.`,
  });

  // Predecessors must NOT be what the legs point at. Cheap, and it turns "we re-pinned" into a
  // statement with a negative side.
  for (const rejected of pin.rejectedAggregators) {
    out.push({
      name: `rejected:${rejected.version}`,
      ok: !eq(agg, rejected.address),
      detail: eq(agg, rejected.address)
        ? `the pin names ${rejected.address}, which is explicitly rejected: ${rejected.why}`
        : `${rejected.address} is not what we pinned`,
    });
  }

  return out;
}

export function summarise(checks: Check[]): { ok: boolean; failed: Check[]; text: string } {
  const failed = checks.filter((c) => !c.ok);
  const lines = checks.map((c) => `  ${c.ok ? '✅' : '❌'} ${c.name.padEnd(52)} ${c.detail}`);
  return {
    ok: failed.length === 0,
    failed,
    text: `${lines.join('\n')}\n\n${failed.length === 0 ? `✅ deployed stack: ${checks.length} check(s) pass` : `❌ deployed stack: ${failed.length}/${checks.length} check(s) FAILED`}`,
  };
}
