/**
 * Which upstream revision a RepCredit gate is supposed to be verifying — and who gets to say so.
 *
 * CC-50 round-5 LOW-1. The ABI side pins its upstreams in `scripts/upstream-abi-pin.json`, a file
 * committed to THIS repo. The YAAA side used to take its expected revision from the environment
 * alone (`REPCREDIT_YAAA_REV`), so a local run with the variable unset verified against whatever
 * happened to be checked out and reported green — measurably: the checkout had moved several DVT
 * commits past the revision the report claimed, and nothing said so.
 *
 * The rule this module encodes:
 *
 *   - REQUIRED / RELEASE mode (`REPCREDIT_YAAA_HTTP_TEST=1`): the in-repo pin is authoritative.
 *     No pin ⇒ the run is not authorised. An env var that disagrees with the pin ⇒ hard failure,
 *     not a silent redirect. That also makes a drift between the pin and the ref CI checks out
 *     impossible to miss, because CI sets both.
 *   - LOCAL mode: `REPCREDIT_YAAA_REV` may narrow the run to another commit (a cross-repo round is
 *     usually in flight), but the resolved revision and its ORIGIN are always reported, so a local
 *     green states what it was green against.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type RevisionOrigin = 'scripts/upstream-abi-pin.json' | 'REPCREDIT_YAAA_REV' | 'none';

export type DeclaredRevision = {
  /** The revision this run must verify against, or null when none is declared. */
  rev: string | null;
  from: RevisionOrigin;
  /** Set when the request itself is illegitimate (release mode with no pin, or an env override). */
  conflict: string | null;
};

/** The reviewed revision this repo commits to for a non-foundry upstream (e.g. the DVT node). */
export function readPinnedServiceRevision(service: string, sdkRoot: string = process.cwd()): string | null {
  try {
    const pin = JSON.parse(readFileSync(join(sdkRoot, 'scripts/upstream-abi-pin.json'), 'utf8')) as {
      services?: Record<string, { revision?: string }>;
    };
    return pin.services?.[service]?.revision ?? null;
  } catch {
    return null;
  }
}

/** Either revision may be an abbreviation of the other; anything else is a disagreement. */
function sameRevision(a: string, b: string): boolean {
  return a.startsWith(b) || b.startsWith(a);
}

export function resolveDeclaredRevision(input: {
  required: boolean;
  envRev: string | null;
  pinnedRev: string | null;
}): DeclaredRevision {
  const { required, envRev, pinnedRev } = input;
  if (required) {
    if (!pinnedRev) {
      return {
        rev: null,
        from: 'none',
        conflict:
          'required/release mode needs a reviewed revision in scripts/upstream-abi-pin.json ' +
          '(services["YetAnotherAA-Validator"].revision); an environment variable alone cannot ' +
          'authorise a release-grade verification',
      };
    }
    if (envRev && !sameRevision(envRev, pinnedRev)) {
      return {
        rev: pinnedRev,
        from: 'scripts/upstream-abi-pin.json',
        conflict:
          `REPCREDIT_YAAA_REV=${envRev} disagrees with the reviewed revision ${pinnedRev} pinned in ` +
          'scripts/upstream-abi-pin.json. In required/release mode the in-repo pin wins: update the pin ' +
          'in the commit that reviews the new revision (and the ref CI checks out) rather than ' +
          'overriding it from the environment',
      };
    }
    return { rev: pinnedRev, from: 'scripts/upstream-abi-pin.json', conflict: null };
  }
  if (envRev) return { rev: envRev, from: 'REPCREDIT_YAAA_REV', conflict: null };
  return { rev: pinnedRev, from: pinnedRev ? 'scripts/upstream-abi-pin.json' : 'none', conflict: null };
}
