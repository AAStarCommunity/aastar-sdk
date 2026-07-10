import { type Account, type Hex, isHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * Node-only resolution of an **operator/funder EOA signer** for the DVT onboarding flow from the two
 * key sources DVT `register-node.mjs` supports: a raw private key held in an env var, and a
 * `forge cast wallet` account/keystore. This exists so an operator can reuse an existing `cast wallet`
 * setup instead of pasting a bare private key.
 *
 * NOTE — scope: `cast wallet` manages secp256k1 **Ethereum** keys only. The DVT node's **BLS** secret key
 * (which generates the public key being registered) cannot live in a cast wallet; supply it as
 * `blsSecretKey` hex (e.g. from its own env var) to {@link onboardDvtNode}.
 *
 * SECURITY: the `cast` path decrypts the keystore and reads the raw private key into this process's memory
 * so viem can sign transactions. Only run it on a host the operator controls. Prefer the `env` path in CI.
 * The keystore password is passed to `cast` via a MINIMAL child env (`ETH_PASSWORD`) — never on argv (which
 * is visible in `ps`) — and the child receives only `PATH`/`HOME`/`FOUNDRY_DIR`, not the parent's full env.
 */
export type EoaKeySource =
    | { type: 'privateKey'; privateKey: Hex }
    | {
          /**
           * Read the private key from an environment variable. Without `var`, the first non-empty of
           * `OPERATOR_PRIVATE_KEY`, `ETH_PRIVATE_KEY`, `PRIVATE_KEY` is used.
           */
          type: 'env';
          var?: string;
      }
    | {
          /**
           * Export the key via `cast wallet private-key <args>` (Foundry). `args` mirrors the DVT script's
           * `CAST_WALLET_ARGS`, e.g. `['--account', 'dvt-op']` or `['--keystore', './ks.json']`. A `password`,
           * when given, is passed to cast via the `ETH_PASSWORD` child env var (NOT argv) so keystore
           * decryption is non-interactive without exposing the password in the process list.
           */
          type: 'cast';
          args: string[];
          password?: string;
      };

const ENV_KEY_FALLBACKS = ['OPERATOR_PRIVATE_KEY', 'ETH_PRIVATE_KEY', 'PRIVATE_KEY'] as const;

/** Normalize a hex private key to a `0x`-prefixed 32-byte value, throwing on anything malformed. */
function normalizePrivateKey(raw: string, origin: string): Hex {
    const trimmed = raw.trim();
    const hex = (trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`) as Hex;
    if (!isHex(hex) || hex.length !== 66) {
        throw new Error(`resolveEoaPrivateKey: ${origin} is not a 32-byte hex private key`);
    }
    return hex;
}

/** Resolve the raw private key hex from an {@link EoaKeySource}. Node-only for the `cast` source. */
export async function resolveEoaPrivateKey(source: EoaKeySource): Promise<Hex> {
    if (source.type === 'privateKey') {
        return normalizePrivateKey(source.privateKey, 'privateKey');
    }

    if (source.type === 'env') {
        const names = source.var ? [source.var] : ENV_KEY_FALLBACKS;
        for (const name of names) {
            const val = process.env[name];
            if (val && val.trim()) return normalizePrivateKey(val, `env ${name}`);
        }
        throw new Error(
            `resolveEoaPrivateKey: no private key in env (${names.join(', ')})`,
        );
    }

    // cast: `cast wallet private-key <args>` — dynamically import node child_process so this module
    // stays importable in non-node bundles (the call throws there instead of failing at import time).
    const { execFileSync } = await import('node:child_process');
    const args = ['wallet', 'private-key', ...source.args];
    // Minimal child env: only what cast needs to locate/decrypt a keystore. The password goes through
    // ETH_PASSWORD (never argv → not visible in `ps`); the parent's other secrets are NOT forwarded.
    const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME };
    if (process.env.FOUNDRY_DIR) env.FOUNDRY_DIR = process.env.FOUNDRY_DIR;
    if (source.password) env.ETH_PASSWORD = source.password;
    let out: string;
    try {
        out = execFileSync('cast', args, { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        const err = e as { stderr?: Buffer | string; message?: string };
        const stderr = err.stderr ? err.stderr.toString() : (err.message ?? '');
        throw new Error(`resolveEoaPrivateKey: \`cast wallet private-key\` failed — ${stderr.trim()}`);
    }
    // cast prints the key (0x + 64 hex), possibly with surrounding whitespace/log lines; take the last hex token.
    const match = out.match(/0x[0-9a-fA-F]{64}/);
    if (!match) throw new Error('resolveEoaPrivateKey: could not parse a private key from `cast` output');
    return normalizePrivateKey(match[0], 'cast output');
}

/** Resolve an {@link EoaKeySource} into a viem {@link Account} ready to build a WalletClient. */
export async function resolveEoaAccount(source: EoaKeySource): Promise<Account> {
    return privateKeyToAccount(await resolveEoaPrivateKey(source));
}
