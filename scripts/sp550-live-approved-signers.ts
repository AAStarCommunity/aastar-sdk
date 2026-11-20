/**
 * The only addresses a live run may sign with, by chain id (Daybreak #468 H1, DSR 2026-11-19). A finite scan of public
 * keys cannot prove a key is private; this table is the guarantee instead. It is committed and changes only through a
 * reviewed PR: the run config's expectSigner and --live-signer must name an address listed here for the run's chain,
 * and neither can add one. The public-key scan (sp550-live-signer.ts isPublicTestAccount) stays as a second line.
 *
 * Sepolia: the paper rehearsal owner (account 0xE8Eaad6A…898b = SimpleAccountFactory v0.7 getAddress(owner, salt 0)).
 * OP Sepolia: the same owner, for the op-sepolia-rc8 rehearsal (DSR 2026-11-21); the same quiet-period rule applies.
 * OP Mainnet gets its address in a separate PR once the author names it.
 */
export const SP550_LIVE_APPROVED_SIGNERS: Readonly<Record<number, readonly string[]>> = Object.freeze({
    11155111: Object.freeze(['0x51Ac694981b6CEa06aA6c51751C227aac5F6b8A3']),
    11155420: Object.freeze(['0x51Ac694981b6CEa06aA6c51751C227aac5F6b8A3']),
});

/** Why `address` may not sign live on `chainId`, or undefined when the table lists it. */
export function liveSignerApprovalProblem(chainId: number, address: string, table: Readonly<Record<number, readonly string[]>> = SP550_LIVE_APPROVED_SIGNERS): string | undefined {
    const listed = Object.prototype.hasOwnProperty.call(table, chainId) ? table[chainId] : undefined;
    if (!listed || listed.length === 0) return `mode live: no approved signer for chain ${chainId} (scripts/sp550-live-approved-signers.ts; add one through a reviewed PR)`;
    if (!listed.some((a) => a.toLowerCase() === address.toLowerCase())) return `mode live: ${address} is not an approved signer for chain ${chainId} (scripts/sp550-live-approved-signers.ts; the config and the command line cannot add one)`;
    return undefined;
}
