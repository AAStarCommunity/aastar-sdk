import { privateKeyToAccount } from 'viem/accounts';

/**
 * Who signs for the keeper, decided once at startup, after .env.<network> is loaded and before any network read.
 *
 * keeper.ts loads .env.<network> with dotenv, and on Sepolia PRIVATE_KEY_SUPPLIER / PRIVATE_KEY / DEPLOYER_ACCOUNT
 * there belong to the deployer EOA. Any fallback to them made a keeper started without its own key sign with the
 * deployer and move its nonce (deploy-day rule, DSR 2026-11-17). So there is no fallback of any kind:
 * - privateKey mode: KEEPER_PRIVATE_KEY, or refuse.
 * - cast mode: an explicit --keystore or --cast-account, or refuse.
 * - --dry-run sends nothing: privateKey mode needs no key for it; cast mode still names its account.
 * An explicitly supplied key or account is not identity-checked here; refusing a known privileged signer is the
 * signer guard's job (#447).
 */
export type KeeperMode = 'cast' | 'privateKey';

/** Thrown for a configuration the keeper refuses at startup. The top-level handler does not notify Telegram for it. */
export class KeeperStartupRefusal extends Error {}

/** `--mode` as given (any case), or the default from whether --keystore was passed. Unknown values refuse. */
export function parseKeeperMode(raw: string | undefined, hasKeystore: boolean): KeeperMode {
    // Absent --mode picks the default; an explicitly empty one is a missing value, never a silent default.
    if (raw === undefined) return hasKeystore ? 'cast' : 'privateKey';
    if (raw.trim() === '') throw new KeeperStartupRefusal('--mode needs a value');
    const m = raw.toLowerCase();
    if (m === 'privatekey') return 'privateKey';
    if (m === 'cast') return 'cast';
    // The value is not echoed: a mistyped variable can put a secret here.
    throw new KeeperStartupRefusal('unknown --mode value (expected privateKey or cast; the value is not shown)');
}

export function keeperKeyFrom(env: Record<string, string | undefined>): `0x${string}` | undefined {
    const key = env.KEEPER_PRIVATE_KEY;
    return key ? (key as `0x${string}`) : undefined;
}

export type KeeperSigner =
    | { mode: 'privateKey'; key: `0x${string}` | undefined; address: `0x${string}` | undefined }
    | { mode: 'cast'; keystorePath: string | undefined; castAccount: string | undefined };

/**
 * The signer the keeper will use, or a KeeperStartupRefusal. Reads only `args` and `env`; no network.
 * cast mode takes the account from --cast-account only (DEPLOYER_ACCOUNT is not read).
 */
export function resolveKeeperSigner(a: {
    mode: KeeperMode; dryRun: boolean; env: Record<string, string | undefined>;
    keystorePath: string | undefined; castAccount: string | undefined;
}): KeeperSigner {
    if (a.mode === 'privateKey') {
        const key = keeperKeyFrom(a.env);
        if (!key && !a.dryRun) {
            throw new KeeperStartupRefusal('privateKey mode requires KEEPER_PRIVATE_KEY (the keeper\'s own key). PRIVATE_KEY_SUPPLIER / PRIVATE_KEY are not read: on Sepolia they are the deployer.');
        }
        let address: `0x${string}` | undefined;
        try { address = key ? privateKeyToAccount(key).address : undefined; } catch { throw new KeeperStartupRefusal('KEEPER_PRIVATE_KEY is not a valid private key'); }
        return { mode: 'privateKey', key, address };
    }
    if (!a.keystorePath && a.castAccount?.startsWith('0x')) {
        throw new KeeperStartupRefusal('cast mode: when providing an address, use --keystore <path> instead of --cast-account');
    }
    if (!a.keystorePath && !a.castAccount) {
        throw new KeeperStartupRefusal('cast mode requires --keystore or --cast-account. DEPLOYER_ACCOUNT is not read: it names the deployer.');
    }
    return { mode: 'cast', keystorePath: a.keystorePath, castAccount: a.castAccount };
}

/** Every flag keeper.ts reads without a value. */
export const BOOLEAN_FLAGS = [
    '--disable-paymaster', '--disable-superpaymaster', '--dry-run', '--help', '--logo', '--no-logo', '--no-paymaster',
    '--no-superpaymaster', '--once', '-h',
] as const;

/** The parsed command line. Built only by parseKeeperArgs; every read of an option goes through it. */
export interface KeeperArgs {
    value(flag: string): string | undefined;
    flag(flag: string): boolean;
}

/**
 * Strict parse of keeper.ts's argv (the npm `--` separator already removed). Refuses at startup, before anything else:
 * an argument that is not a known flag (including lookalikes such as `--dryrun`), any `--flag=value` form (no keeper
 * flag accepts it, so `--dry-run=true` cannot silently mean a live run), a repeated flag (no "first one wins"), a
 * positional argument, and a value flag without its value. `--dry-run` is then exactly `args.flag('--dry-run')`.
 */
/**
 * Refusal messages echo an unknown option only when it reads like an option name (lowercase letters and '-',
 * no digits). A key, address or URL pasted after `--` contains digits or other characters, so it is reported by
 * position only and never printed.
 */
const OPTION_LIKE = /^--[a-z][a-z-]{0,40}$/;

export function parseKeeperArgs(argv: readonly string[]): KeeperArgs {
    const values = new Map<string, string>();
    const flags = new Set<string>();
    const seen = new Set<string>();
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!;
        // Never echo the argument: an operator who pastes a key here must not see it printed into logs.
        if (!a.startsWith('--') && a !== '-h') throw new KeeperStartupRefusal(`unexpected positional argument at position ${i + 1} (not shown)`);
        if (a.includes('=')) {
            const name = a.slice(0, a.indexOf('='));
            const known = (VALUE_FLAGS as readonly string[]).includes(name) || (BOOLEAN_FLAGS as readonly string[]).includes(name);
            throw new KeeperStartupRefusal(known
                ? `${name}=… is not accepted: pass "${name}" and its value as separate arguments`
                : `an --option=value argument at position ${i + 1} is not accepted (not shown)`);
        }
        const isValue = (VALUE_FLAGS as readonly string[]).includes(a);
        if (!isValue && !(BOOLEAN_FLAGS as readonly string[]).includes(a)) {
            throw new KeeperStartupRefusal(OPTION_LIKE.test(a) ? `unknown option ${a}` : `unknown option at position ${i + 1} (not shown)`);
        }
        if (seen.has(a)) throw new KeeperStartupRefusal(`${a} is given more than once`);
        seen.add(a);
        if (isValue) {
            assertFlagValues([a, argv[i + 1] as string], [a]);
            values.set(a, argv[++i]!);
        } else {
            flags.add(a);
        }
    }
    return { value: (f) => values.get(f), flag: (f) => flags.has(f) };
}

/** Every flag keeper.ts reads with a value. One present without a value (end of argv, or another --flag next) refuses. */
export const VALUE_FLAGS = [
    '--cast-account', '--chainlink-stale-sec', '--external-ethusd-url', '--health-interval', '--keystore',
    '--max-base-fee-gwei', '--max-updates-per-day', '--mode', '--network', '--paymaster', '--paymaster-missing-alert',
    '--paymaster-operator', '--poll-interval', '--safety-margin', '--superpaymaster', '--volatility-cooldown',
    '--volatility-threshold-bps',
] as const;

export function assertFlagValues(args: readonly string[], flags: readonly string[] = VALUE_FLAGS): void {
    for (let i = 0; i < args.length; i++) {
        if (!flags.includes(args[i]!)) continue;
        const v = args[i + 1];
        // No keeper value starts with '-': a value like `-h` or `--once` is a swallowed option, not a value.
        if (v === undefined || v === '' || v.trim() === '' || v.startsWith('-')) throw new KeeperStartupRefusal(`${args[i]} needs a value`);
    }
}

/** The wallet account for privateKey mode: built from the resolved signer and nothing else. */
export function keeperAccountFor(signer: KeeperSigner) {
    return signer.mode === 'privateKey' && signer.key ? privateKeyToAccount(signer.key) : null;
}

/** The `cast send` signer arguments: from the resolved signer and nothing else (keystore wins over an account). */
export function castSignerArgs(signer: { keystorePath?: string; castAccount?: string }): string[] {
    if (signer.keystorePath) return ['--keystore', signer.keystorePath];
    if (signer.castAccount) return ['--account', signer.castAccount];
    throw new KeeperStartupRefusal('cast mode requires --keystore or --cast-account');
}
