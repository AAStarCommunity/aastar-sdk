/**
 * Drop secret-bearing environment variables before any other keeper code reads them.
 * The names are removed. The values are never logged.
 */
const SECRET_ENV = /PRIVATE_KEY|MNEMONIC|KEYSTORE_PASSWORD/i;

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
