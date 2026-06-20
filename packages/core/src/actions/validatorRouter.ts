/**
 * Validator-router gating for AAStarAirAccount signature algorithms.
 *
 * Background (root-caused on-chain, v0.20.0): an AirAccount validates a signature
 * algorithm in one of two ways:
 *
 *   - INLINE — handled directly by `AAStarAirAccountBase` itself: ECDSA (0x02),
 *     P256 / passkey (0x03), and COMBINED_T1 (0x06). No external validator needed.
 *   - ROUTER-DELEGATED — every other algId (BLS 0x01, cumulative T2 0x04, T3 0x05,
 *     weighted 0x07, session 0x08, ...) is forwarded to the account's validator
 *     router. Until the router is wired, `_validateTripleSignature` / `_callBLSValidator`
 *     return `1` (validation FAIL) because `validator() == address(0)`.
 *
 * The factory does NOT auto-wire the router, so an account that approved any
 * router-delegated algId is non-functional for that algId until the owner calls
 * `setValidator(router)` (onlyOwner, SET-ONCE). This module decides, from the set of
 * approved algIds, whether that wiring step is required.
 */

/**
 * algIds handled INLINE by `AAStarAirAccountBase` — these need NO validator router.
 *   0x02 = ECDSA, 0x03 = P256 (passkey), 0x06 = COMBINED_T1.
 */
export const INLINE_ALG_IDS: readonly number[] = [0x02, 0x03, 0x06];

/**
 * True when AT LEAST ONE approved algId is router-delegated (i.e. NOT inline), meaning
 * the account cannot validate that algorithm until `setValidator(router)` is wired.
 *
 * An empty list (no algorithms approved) returns `false` — nothing to route.
 *
 * @param approvedAlgIds - the algIds approved on the account (e.g. the account record's
 *                         `approvedAlgIds`, or the InitConfig's `approvedAlgIds`).
 */
export function needsValidatorRouter(approvedAlgIds: readonly number[]): boolean {
  return approvedAlgIds.some((algId) => !INLINE_ALG_IDS.includes(algId));
}
