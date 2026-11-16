/**
 * Drop secret-bearing environment variables before any other keeper code reads them.
 * The names are removed. The values are never logged.
 */
const SECRET_ENV = /PRIVATE_KEY|MNEMONIC|KEYSTORE_PASSWORD|PASSPHRASE|PASSWORD/i;

export function scrubSecretEnv(env: NodeJS.ProcessEnv): string[] {
    const removed: string[] = [];
    for (const key of Object.keys(env)) {
        if (!SECRET_ENV.test(key)) continue;
        delete env[key];
        removed.push(key);
    }
    return removed;
}

/**
 * Leave each removed name set to an empty string. dotenv does not override a name that is
 * already present, so a later load of the same env file cannot put the secret back.
 */
export function pinScrubbedSecrets(env: NodeJS.ProcessEnv, names: readonly string[]): void {
    for (const name of names) env[name] = '';
}

/** The value is never included. One fixed line, and only when that name was actually removed. */
export function ignoredSecretWarning(names: readonly string[]): string | null {
    if (names.includes('KEEPER_PRIVATE_KEY')) return 'ignored KEEPER_PRIVATE_KEY from environment; keystore only';
    return null;
}

/** Names the keeper process may receive. The shell launcher allowlist matches this list. */
export const KEEPER_ENV_ALLOW = [
    'RPC_URL',
    'BUNDLER_URL',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
    'OFFICIAL_OPERATOR',
    'EXTERNAL_ETHUSD_URL',
    'KEEPER_HEALTH_INTERVAL_SEC',
    'KEEPER_VOLATILITY_THRESHOLD_BPS',
    'KEEPER_VOLATILITY_COOLDOWN_SEC',
    'KEEPER_CHAINLINK_STALE_SEC',
    'KEEPER_PAYMASTER_MISSING_ALERT_SEC',
    'KEEPER_POLL_INTERVAL',
    'KEEPER_SAFETY_MARGIN',
    'KEEPER_HEALTH_INTERVAL',
    'KEEPER_VOL_BPS',
    'KEEPER_VOL_COOLDOWN',
    'KEEPER_ETHUSD_URL',
    'KEEPER_CAST_BIN',
] as const;

const ALLOWED_ENV = new Set<string>(KEEPER_ENV_ALLOW);
const SECRET_NAME = /PRIVATE_KEY|MNEMONIC|KEYSTORE_PASSWORD|SEED|PASSPHRASE|PASSWORD/i;
const ENV_KEY = /^[A-Z][A-Z0-9_]{0,63}$/;

export function isSecretEnvName(name: string): boolean {
    return SECRET_NAME.test(name);
}

/** Names only. The scan stops after 5000 keys or 20 hits. */
export function secretEnvNames(env: NodeJS.ProcessEnv): string[] {
    const names: string[] = [];
    let seen = 0;
    for (const key in env) {
        seen += 1;
        if (seen > 5_000) return ['(env)'];
        if (!Object.prototype.hasOwnProperty.call(env, key)) continue;
        if (!isSecretEnvName(key)) continue;
        names.push(key.length > 64 ? key.slice(0, 64) : key);
        if (names.length >= 20) break;
    }
    return names;
}

/**
 * Parse a keeper env file. Unknown or secret names fail with the key, never the value.
 * The text is bounded before any per-line work.
 */
export function parseKeeperEnv(text: string): { ok: true; values: Record<string, string> } | { ok: false; key: string } {
    if (typeof text !== 'string' || text.length > 65_536) return { ok: false, key: '(file)' };
    let lines = 0;
    let start = 0;
    const values: Record<string, string> = {};
    const body = text.endsWith('\n') ? text : `${text}\n`;
    for (let i = 0; i < body.length; i++) {
        if (body.charCodeAt(i) !== 10) continue;
        lines += 1;
        if (lines > 200) return { ok: false, key: '(file)' };
        const line = body.slice(start, i).replace(/\r$/, '');
        start = i + 1;
        if (line.length > 4_096) return { ok: false, key: '(line)' };
        const trimmed = line.trim();
        if (trimmed === '' || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) return { ok: false, key: '(line)' };
        const key = trimmed.slice(0, eq).trim();
        if (!ENV_KEY.test(key)) return { ok: false, key: '(line)' };
        if (isSecretEnvName(key) || !ALLOWED_ENV.has(key)) return { ok: false, key };
        let value = trimmed.slice(eq + 1);
        if (value.length > 4_096) return { ok: false, key };
        if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        values[key] = value;
    }
    return { ok: true, values };
}
