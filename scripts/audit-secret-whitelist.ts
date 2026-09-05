/**
 * What each whitelisted key actually is — evidence, not a verdict.
 *
 * WHY THIS EXISTS
 * ---------------
 * `security-scan.ts` carries 22 whitelisted private keys. Eleven are labelled `Anvil #0`…`#9`:
 * publicly documented development keys that anyone can verify in seconds. The other eleven say
 * `Test Key` or `Dummy Key`, which is not provenance — it is an assertion that whoever wrote it
 * knew. That is the same shape as the remembered `EXPECTED_SDK_PATHS = 37` this repo replaced: a
 * fact that lives only in someone's memory, and that nothing can re-derive.
 *
 * A whitelist entry is a decision to STOP looking at something. When its justification cannot be
 * checked, the decision cannot be reviewed either — and a leaked key would sit behind exactly such
 * an entry, indistinguishable from a fixture.
 *
 * WHAT THIS TOOL DOES AND DOES NOT DO
 * -----------------------------------
 * It derives each key's ADDRESS and reports on-chain activity, so an entry can be judged on evidence
 * instead of on its label. It never prints a private key, and it makes no judgement: "has a balance
 * on Sepolia" is normal for a testnet fixture and alarming for a key nobody meant to fund. Which of
 * those it is depends on intent, and intent is not on chain.
 *
 * ONE HALF IS A REPORT, THE OTHER HALF IS A GATE
 * ----------------------------------------------
 * A first version of this file called the whole thing a report, on the grounds that judging a
 * balance needs a policy nobody has written. That reasoning is sound — and it covers only half of
 * what this file does. The other half, "can a third party check this note", is ALREADY a decision,
 * already written down as {@link SELF_JUSTIFYING}: `Anvil #3` is verifiable by anyone, `Test Key` is
 * not, and telling those apart needs no balance policy at all. Letting the undecidability of the
 * first half cover the second was a category error, caught in review.
 *
 * So the balance readings stay a report, and the count of unverifiable entries is a ceiling: it may
 * not grow. Same shape as `maxGated` in `test-inventory.test.ts` — lock the status quo, make raising
 * it a deliberate edit, and let that edit be where someone asks "why can nobody verify this new
 * key?". It does not adjudicate the existing eleven, and it does not adjudicate any balance.
 *
 * WHY A CEILING RATHER THAN LEAVING IT IN THE REPORT
 * -------------------------------------------------
 * This script arrived with an npm script and no CI wiring — the exact state `security-scan.ts`
 * turned out to be in: present, with tests that run, never once executed against the repository.
 * A report with no consumer decays into a file.
 *
 * WHY THERE IS NO `--file` FLAG (a security property, not a missing feature)
 * -------------------------------------------------------------------------
 * The scanned path is fixed. With a flag this becomes "hand me any file containing private keys and
 * I will derive the addresses and query a chain about them" — and even printing no key, it would
 * still tell an external RPC WHICH ADDRESSES someone is interested in. Anyone tempted to add the
 * flag as an obvious convenience should read this paragraph first.
 *
 * Usage:  pnpm exec tsx scripts/audit-secret-whitelist.ts [--rpc <url>]
 */
import { readFileSync } from 'node:fs';
import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const SCANNER = 'scripts/security-scan.ts';

export interface WhitelistEntry {
  key: `0x${string}`;
  note: string;
  /** Whether the note lets a third party re-derive what this key is. */
  selfJustifying: boolean;
}

/** Notes that identify a key by a publicly documented source. */
const SELF_JUSTIFYING = /anvil\s*#\d+|hardhat\s*#\d+|well[- ]known|zero key/i;

export function parseWhitelist(source: string): WhitelistEntry[] {
  return [...source.matchAll(/'(0x[a-fA-F0-9]{64})',\s*\/\/\s*(.*)/g)].map((m) => ({
    key: m[1] as `0x${string}`,
    note: m[2].trim(),
    selfJustifying: SELF_JUSTIFYING.test(m[2]),
  }));
}

async function main() {
  const argv = process.argv.slice(2);
  const rpc = argv.includes('--rpc')
    ? argv[argv.indexOf('--rpc') + 1]
    : process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';

  const entries = parseWhitelist(readFileSync(SCANNER, 'utf8'));
  // Printed before any finding: a run that parsed nothing and a run that found nothing look the
  // same otherwise, and this repo has been caught by that shape more than once tonight.
  console.log(`\n== secret-whitelist audit — ${entries.length} entries in ${SCANNER} ==`);
  if (entries.length === 0) {
    console.error('audit-secret-whitelist: parsed 0 entries. The whitelist format changed.');
    process.exit(1);
  }

  const client = createPublicClient({ transport: http(rpc) });
  const opaque = entries.filter((e) => !e.selfJustifying);

  /**
   * How many entries currently cannot be verified by a third party. A CEILING, not a target: the
   * eleven that exist are not adjudicated here, but a twelfth has to be argued for.
   */
  const MAX_OPAQUE_ENTRIES = 11;
  console.log(`   ${entries.length - opaque.length} self-justifying (a third party can verify the note)`);
  console.log(`   ${opaque.length} opaque — the note asserts what it is without letting anyone check\n`);

  for (const entry of entries) {
    let address: string;
    try {
      address = privateKeyToAccount(entry.key).address;
    } catch {
      console.log(`  ?  ${entry.note.padEnd(16)} (not a valid secp256k1 key — likely a placeholder)`);
      continue;
    }
    const [balance, nonce] = await Promise.all([
      client.getBalance({ address: address as `0x${string}` }),
      client.getTransactionCount({ address: address as `0x${string}` }),
    ]);
    const used = nonce > 0 || balance > 0n;
    console.log(
      `  ${entry.selfJustifying ? '✓' : '?'}  ${entry.note.padEnd(16)} ${address}  ` +
        `${used ? `USED: ${balance} wei, ${nonce} tx` : 'never used on this chain'}`,
    );
  }

  if (opaque.length > MAX_OPAQUE_ENTRIES) {
    console.error(
      `\n❌ ${opaque.length} whitelist entries cannot be verified by a third party; the ceiling is ` +
        `${MAX_OPAQUE_ENTRIES}.\n` +
        '   A new key was whitelisted with a note that only asserts what it is. Either give it a note\n' +
        '   someone else can check (where it came from, or a public source), or raise the ceiling in\n' +
        '   this file in the same commit and say why.\n' +
        '   This does not judge the existing entries, and it does not judge any balance.',
    );
    process.exit(1);
  }

  console.log(
    '\nNo verdict is offered on the BALANCES. A balance is ordinary for a testnet fixture and alarming for a key\n' +
      'nobody meant to fund; telling those apart needs intent, which is not on chain. What the\n' +
      'audit can say is which notes let someone else check, and which ask to be believed.',
  );
}

if (process.argv[1]?.endsWith('audit-secret-whitelist.ts')) void main();
