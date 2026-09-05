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
 * It is a REPORT, deliberately not a gate. Turning it into one would mean encoding a rule about
 * which balances are acceptable, and that rule does not exist yet — inventing it here would be the
 * gate deciding a question it was built to inform.
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

  console.log(
    '\nNo verdict is offered. A balance is ordinary for a testnet fixture and alarming for a key\n' +
      'nobody meant to fund; telling those apart needs intent, which is not on chain. What the\n' +
      'audit can say is which notes let someone else check, and which ask to be believed.',
  );
}

if (process.argv[1]?.endsWith('audit-secret-whitelist.ts')) void main();
