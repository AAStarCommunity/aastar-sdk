/**
 * The keeper's signing key in privateKey mode: KEEPER_PRIVATE_KEY and nothing else.
 *
 * keeper.ts loads .env.<network> with dotenv before it reads this, and on Sepolia PRIVATE_KEY_SUPPLIER /
 * PRIVATE_KEY in that file are the deployer EOA. Falling back to them made a keeper started without
 * KEEPER_PRIVATE_KEY sign with the deployer, moving its nonce (deploy-day rule, DSR 2026-11-17).
 */
export function keeperKeyFrom(env: Record<string, string | undefined>): `0x${string}` | undefined {
    const key = env.KEEPER_PRIVATE_KEY;
    return key ? (key as `0x${string}`) : undefined;
}

/** Why privateKey mode cannot start, or null. A dry run sends nothing and needs no key. */
export function keeperKeyProblem(args: { mode: string; dryRun: boolean; key: string | undefined }): string | null {
    if (args.mode !== 'privateKey' || args.dryRun || args.key) return null;
    return 'privateKey mode requires KEEPER_PRIVATE_KEY (the keeper\'s own key). PRIVATE_KEY_SUPPLIER / PRIVATE_KEY are not read: on Sepolia they are the deployer.';
}
