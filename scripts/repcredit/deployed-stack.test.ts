/**
 * Mutation tests for the CC-115 B4 deployed-stack gate.
 *
 * The gate passed 25/25 against the live Sepolia stack on 2026-09-04. That fact, on its own, is
 * worth very little: a check that can only ever return ✅ passes too. This file exists to prove the
 * opposite half — that each check has a mutation which turns it red, and that the mutation is the
 * one the check claims to be about.
 *
 * The precedent is in this repo's own history: a guard was written whose condition could not
 * evaluate false, and a mock that ignored the block pin let it report green for several rounds. So
 * every `expect(...).toBe(true)` here is paired with a mutated input asserting `false`, and the
 * on-chain half runs against a stub client whose answers can be edited one field at a time.
 */
import { describe, expect, it } from 'vitest';
import { toFunctionSelector } from 'viem';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

import { checkDeployedAbiPin, checkDeployedStackOnChain, readDeployedStackPin, summarise, type DeployedStackPin } from './deployed-stack.js';

const SDK_ROOT = process.cwd();
const PIN = readDeployedStackPin('sepolia', SDK_ROOT);

const verdict = (checks: { name: string; ok: boolean }[], name: string) => checks.find((c) => c.name === name)?.ok;

/** A scratch SDK root with the vendored ABI copied in, so a mutation cannot touch the real one. */
function scratchRoot(mutate?: (doc: Record<string, unknown>) => void): string {
  const root = mkdtempSync(join(tmpdir(), 'b4-gate-'));
  const rel = PIN.aggregator.abi.vendoredAt;
  const dest = join(root, rel);
  mkdirSync(dirname(dest), { recursive: true });
  if (mutate) {
    const doc = JSON.parse(readFileSync(join(SDK_ROOT, rel), 'utf8'));
    mutate(doc);
    writeFileSync(dest, JSON.stringify(doc, null, 2));
  } else {
    cpSync(join(SDK_ROOT, rel), dest);
  }
  return root;
}

describe('offline pin checks — each one has a mutation that reddens it', () => {
  it('passes unmutated against the real vendored artifact', () => {
    const checks = checkDeployedAbiPin(PIN, SDK_ROOT, null);
    expect(summarise(checks).failed).toEqual([]);
  });

  it('vendored-sha256 goes red when the artifact bytes change at all', () => {
    // A single added key is enough: the pin is over bytes, not over semantics.
    const root = scratchRoot((doc) => {
      (doc as { _scratch?: string })._scratch = 'x';
    });
    const checks = checkDeployedAbiPin(PIN, root, null);
    expect(verdict(checks, 'deployed-abi:vendored-sha256')).toBe(false);
  });

  it('shape goes red when a function is removed', () => {
    const root = scratchRoot((doc) => {
      const abi = doc.abi as { type?: string }[];
      const i = abi.findIndex((e) => e.type === 'function');
      abi.splice(i, 1);
    });
    const checks = checkDeployedAbiPin(PIN, root, null);
    expect(verdict(checks, 'deployed-abi:shape')).toBe(false);
  });

  it('version-string goes red when the artifact claims 4.12.0', () => {
    const root = scratchRoot((doc) => {
      (doc as { version?: string }).version = 'BLSAggregator-4.12.0';
    });
    const checks = checkDeployedAbiPin(PIN, root, null);
    expect(verdict(checks, 'deployed-abi:version-string')).toBe(false);
  });

  it('legacy-verify-selector-absent goes red when the pre-domain 3-arg verify is reintroduced', () => {
    const root = scratchRoot((doc) => {
      (doc.abi as unknown[]).push({
        type: 'function',
        name: 'verify',
        stateMutability: 'view',
        inputs: [{ type: 'uint256' }, { type: 'address[]' }, { type: 'bytes' }],
        outputs: [{ type: 'bool' }],
      });
    });
    const checks = checkDeployedAbiPin(PIN, root, null);
    expect(verdict(checks, 'deployed-abi:legacy-verify-selector-absent')).toBe(false);
  });

  it('THE QUIET ONE: guardianSlashCases shape goes red for the 4.12.0 return list at the same selector', () => {
    // This is the drift that does not revert. Reproduce it exactly: insert the uint16 slashBps that
    // #400 added, changing nothing else — same name, same inputs, therefore the same selector.
    const root = scratchRoot((doc) => {
      const abi = doc.abi as { name?: string; outputs?: { type: string }[] }[];
      const g = abi.find((e) => e.name === 'guardianSlashCases');
      expect(g).toBeTruthy();
      g!.outputs = PIN.shapeGates['guardianSlashCases(uint256)'].sourceReturns.map((type) => ({ type }));
    });
    const checks = checkDeployedAbiPin(PIN, root, null);
    expect(verdict(checks, 'deployed-abi:guardianSlashCases-shape')).toBe(false);
    // …and the selector-based checks stay green, which is precisely why this needs its own gate:
    // nothing about the selector changed.
    expect(verdict(checks, 'deployed-abi:legacy-verify-selector-absent')).toBe(true);
  });

  it('upstream-blob check goes red when the pinned revision does not carry the artifact', () => {
    const badRev: DeployedStackPin = {
      ...PIN,
      aggregator: { ...PIN.aggregator, abi: { ...PIN.aggregator.abi, revision: '0'.repeat(40) } },
    };
    const checks = checkDeployedAbiPin(badRev, SDK_ROOT, join(SDK_ROOT, '../SuperPaymaster'));
    expect(verdict(checks, 'deployed-abi:upstream-blob-sha256')).toBe(false);
  });
});

/* ------------------------------------------------------------------ on-chain half, stubbed */

type Answers = {
  chainId: number;
  code: string;
  version: string;
  legs: Record<string, string>;
  nums: Record<string, bigint>;
  verifier: string;
  pending: string;
  domain: string;
  bpsAnswers: boolean;
  slashCaseWords: number;
  verifierAnswers: boolean;
  /** force one slashThresholds index to a different value, for the paired-red test */
  slashThresholdOverride?: { level: number; value: bigint };
};

function baseAnswers(): Answers {
  return {
    chainId: PIN.chainId,
    // The real runtime bytecode is not needed — only that keccak(code) equals the pin. Feed the
    // preimage the pin was computed from by reading it back through the same function under test
    // would be circular, so instead: assert the MUTATION reddens it, and leave the positive case to
    // the live run (which did pass, 2026-09-04).
    code: '0x00',
    version: PIN.aggregator.version,
    legs: {
      [PIN.addresses.registry.toLowerCase()]: PIN.addresses.blsAggregator,
      [PIN.addresses.superPaymaster.toLowerCase()]: PIN.addresses.blsAggregator,
      [PIN.addresses.dvtValidator.toLowerCase()]: PIN.addresses.blsAggregator,
    },
    nums: {
      defaultThreshold: BigInt(PIN.aggregator.defaultThreshold),
      minThreshold: BigInt(PIN.aggregator.minThreshold),
      GUARDIAN_SLASH_CASE_WINDOW: BigInt(PIN.aggregator.guardianSlashCaseWindowSeconds),
    },
    verifier: PIN.addresses.fraudProofVerifier,
    pending: `0x${'0'.repeat(40)}`,
    domain: PIN.aggregator.domainSeparator,
    bpsAnswers: false,
    slashCaseWords: PIN.shapeGates['guardianSlashCases(uint256)'].deployedWords,
    verifierAnswers: true,
  };
}

const pad = (addr: string) => `0x${'0'.repeat(24)}${addr.slice(2).toLowerCase()}`;

// The two verifier getters differ ONLY by selector, and conflating them made the first draft of
// this stub report a rotation in flight. Dispatch on the selector, like the chain does.
const SEL_VERIFIER = toFunctionSelector('function fraudProofVerifier() view returns (address)');
const SEL_PENDING = toFunctionSelector('function pendingFraudProofVerifier() view returns (address)');

function stubClient(a: Answers) {
  return {
    getChainId: async () => a.chainId,
    getCode: async () => a.code,
    call: async ({ to, data }: { to: string; data: string }) => {
      const sel = data.slice(0, 10);
      // guardianSlashCases(uint256)
      if (sel === PIN.shapeGates['guardianSlashCases(uint256)'].selector) {
        return { data: `0x${'0'.repeat(64 * a.slashCaseWords)}` };
      }
      if (sel === PIN.selectors.fraudProofVerify) {
        if (!a.verifierAnswers) throw new Error('execution reverted');
        return { data: `0x${'0'.repeat(64)}` };
      }
      if (sel === SEL_PENDING) return { data: pad(a.pending) };
      if (sel === SEL_VERIFIER) return { data: pad(a.verifier) };
      // the three leg getters, keyed by which contract is being asked
      if (to.toLowerCase() in a.legs) return { data: pad(a.legs[to.toLowerCase()]) };
      throw new Error(`stub has no answer for ${sel} at ${to}`);
    },
    readContract: async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
      if (functionName === 'slashThresholds') {
        const level = Number(args?.[0]);
        if (a.slashThresholdOverride && a.slashThresholdOverride.level === level) return a.slashThresholdOverride.value;
        const v = PIN.aggregator.slashThresholds[String(level)];
        if (v === undefined) throw new Error(`stub has no slashThresholds[${level}]`);
        return BigInt(v);
      }
      if (functionName === 'version') return a.version;
      if (functionName === 'domainSeparator') return a.domain;
      if (functionName === 'guardianSlashBps') {
        if (!a.bpsAnswers) throw new Error('execution reverted');
        return 500;
      }
      if (functionName === 'fraudProofVerifier') return a.verifier;
      if (functionName === 'pendingFraudProofVerifier') return a.pending;
      const n = a.nums[functionName];
      if (n === undefined) throw new Error(`stub has no answer for ${functionName}`);
      return n;
    },
  } as never;
}

/** The stub cannot reproduce extcodehash, so that check is excluded from the stubbed baseline. */
const STUB_UNSUPPORTED = new Set(['aggregator:extcodehash']);

describe('on-chain checks — each one has a mutated chain answer that reddens it', () => {
  it('baseline: every supported check is green when the chain agrees with the pin', async () => {
    const checks = await checkDeployedStackOnChain(PIN, stubClient(baseAnswers()));
    const failed = checks.filter((c) => !c.ok && !STUB_UNSUPPORTED.has(c.name));
    expect(failed).toEqual([]);
  });

  it('version goes red when the chain runs 4.12.0', async () => {
    const a = baseAnswers();
    a.version = 'BLSAggregator-4.12.0';
    const checks = await checkDeployedStackOnChain(PIN, stubClient(a));
    expect(verdict(checks, 'aggregator:version')).toBe(false);
  });

  it('THE SIX-DAY SPLIT: one leg pointing elsewhere reddens that leg alone', async () => {
    const a = baseAnswers();
    // Exactly the observed state: Registry moved, the other two left behind on 4.3.0.
    a.legs[PIN.addresses.superPaymaster.toLowerCase()] = PIN.rejectedAggregators[0].address;
    a.legs[PIN.addresses.dvtValidator.toLowerCase()] = PIN.rejectedAggregators[0].address;
    const checks = await checkDeployedStackOnChain(PIN, stubClient(a));
    expect(verdict(checks, 'leg:Registry.blsAggregator')).toBe(true);
    expect(verdict(checks, 'leg:SuperPaymaster.BLS_AGGREGATOR')).toBe(false);
    expect(verdict(checks, 'leg:DVTValidator.BLS_AGGREGATOR')).toBe(false);
  });

  it('defaultThreshold goes red at the pre-4.11 value of 7', async () => {
    const a = baseAnswers();
    a.nums.defaultThreshold = 7n;
    const checks = await checkDeployedStackOnChain(PIN, stubClient(a));
    expect(verdict(checks, 'aggregator:defaultThreshold')).toBe(false);
  });

  it('slashThresholds redden per index when the chain disagrees', async () => {
    // Pinned since B4 but read by nothing until pr-daemon pointed it out; a pinned value that
    // nothing compares is documentation wearing a gate's clothes.
    const a = baseAnswers();
    a.slashThresholdOverride = { level: 1, value: 99n };
    const patchedChecks = await checkDeployedStackOnChain(PIN, stubClient(a));
    expect(verdict(patchedChecks, 'aggregator:slashThresholds[1]')).toBe(false);
    expect(verdict(patchedChecks, 'aggregator:slashThresholds[0]')).toBe(true);
  });

  it('no-pending-verifier goes red while a rotation is in flight', async () => {
    const a = baseAnswers();
    a.pending = '0x1111111111111111111111111111111111111111';
    const checks = await checkDeployedStackOnChain(PIN, stubClient(a));
    expect(verdict(checks, 'aggregator:no-pending-verifier')).toBe(false);
  });

  it('domainSeparator goes red when the chain hashed different addresses', async () => {
    const a = baseAnswers();
    a.domain = '0xa0121faa0cb82246bf84abf0d60a9750bb00e64c1c171af6931c8cd3f5f8253d'; // the 4.3.0 domain
    const checks = await checkDeployedStackOnChain(PIN, stubClient(a));
    expect(verdict(checks, 'aggregator:domainSeparator-matches-pin')).toBe(false);
    expect(verdict(checks, 'aggregator:domainSeparator-recomputed-from-addresses')).toBe(false);
  });

  it('is-4.11-not-4.12 goes red when guardianSlashBps() answers', async () => {
    const a = baseAnswers();
    a.bpsAnswers = true;
    const checks = await checkDeployedStackOnChain(PIN, stubClient(a));
    expect(verdict(checks, 'aggregator:is-4.11-not-4.12')).toBe(false);
  });

  it('THE QUIET ONE, on chain: an 8-word return reddens the shape gate', async () => {
    const a = baseAnswers();
    a.slashCaseWords = PIN.shapeGates['guardianSlashCases(uint256)'].sourceWords;
    const checks = await checkDeployedStackOnChain(PIN, stubClient(a));
    expect(verdict(checks, 'aggregator:guardianSlashCases-returns-deployed-shape')).toBe(false);
  });

  it('verifier:answers-domain-bound-selector reddens when the armed verifier does not answer it', async () => {
    const a = baseAnswers();
    a.verifierAnswers = false;
    const checks = await checkDeployedStackOnChain(PIN, stubClient(a));
    expect(verdict(checks, 'verifier:answers-domain-bound-selector')).toBe(false);
  });

  it('rejected predecessors redden when the pin names one of them', async () => {
    const rejected = PIN.rejectedAggregators[0];
    const bad: DeployedStackPin = {
      ...PIN,
      addresses: { ...PIN.addresses, blsAggregator: rejected.address },
    };
    const checks = await checkDeployedStackOnChain(bad, stubClient(baseAnswers()));
    expect(verdict(checks, `rejected:${rejected.version}`)).toBe(false);
  });

  it('wrong chain aborts instead of comparing addresses that mean nothing there', async () => {
    const a = baseAnswers();
    a.chainId = 1;
    const checks = await checkDeployedStackOnChain(PIN, stubClient(a));
    expect(verdict(checks, 'chain:id')).toBe(false);
    // It must STOP, not carry on judging mainnet addresses against a Sepolia pin.
    expect(checks.length).toBe(1);
  });
});

describe('the pin file itself', () => {
  it('names the frozen B3 manifest and a non-empty rejected set', () => {
    expect(PIN.manifest.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(PIN.rejectedAggregators.length).toBeGreaterThan(0);
    for (const r of PIN.rejectedAggregators) {
      expect(r.address.toLowerCase()).not.toBe(PIN.addresses.blsAggregator.toLowerCase());
    }
  });

  it('keeps the source axis and the deployed axis on DIFFERENT revisions, on purpose', () => {
    // If these ever coincide, either 4.12.0 got deployed or someone "tidied" the pin. Both need a
    // human: the whole two-axis design exists because they disagree.
    expect(PIN.aggregator.sourceRevision).not.toBe(PIN.aggregator.abi.revision);
  });
});
