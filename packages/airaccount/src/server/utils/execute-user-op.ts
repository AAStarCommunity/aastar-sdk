import { ethers } from "ethers";

// AAStarAirAccountV7 v0.17.2-beta.4 bundler-compat entrypoint.
//
// The EntryPoint v0.7 routes a UserOp whose callData begins with the executeUserOp
// selector to `account.executeUserOp(userOp, userOpHash)`, which re-derives the
// signature algId in-frame. This eliminates the cross-`eth_call` transient dependency
// that previously made guard-enabled accounts fail bundler gas estimation
// (`AlgorithmNotApproved(0)`).

/** 4-byte selector of `executeUserOp((PackedUserOperation),bytes32)`. */
export const EXECUTE_USER_OP_SELECTOR = ethers
  .id("executeUserOp((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes),bytes32)")
  .slice(0, 10);

/** 4-byte selector of `execute(address,uint256,bytes)`. */
export const EXECUTE_SELECTOR = ethers.id("execute(address,uint256,bytes)").slice(0, 10);

/** 4-byte selector of `executeBatch(address[],uint256[],bytes[])`. */
export const EXECUTE_BATCH_SELECTOR = ethers
  .id("executeBatch(address[],uint256[],bytes[])")
  .slice(0, 10);

/**
 * Wrap inner `execute()` / `executeBatch()` callData with the `executeUserOp` selector so a
 * guard-enabled (v0.17.2-beta.4) account routes the bundler UserOp through `executeUserOp`.
 *
 * Only `execute` / `executeBatch` may be wrapped — the account reverts
 * `UnsupportedInnerSelector` for anything else (including a nested `executeUserOp`).
 *
 * Owner-direct (non-bundler) `execute()` does NOT need this; no-guard accounts can submit
 * bare callData. Use this only when building a bundler UserOp for a guard-enabled account.
 *
 * @param innerCallData ABI-encoded `execute`/`executeBatch` calldata (0x-prefixed)
 * @returns `executeUserOp.selector ++ innerCallData`
 * @throws if `innerCallData` is not an `execute`/`executeBatch` call
 */
export function wrapExecuteUserOp(innerCallData: string): string {
  if (!/^0x[0-9a-fA-F]*$/.test(innerCallData) || innerCallData.length < 10) {
    throw new Error("wrapExecuteUserOp: innerCallData must be 0x-prefixed calldata with a 4-byte selector");
  }
  const sel = innerCallData.slice(0, 10).toLowerCase();
  if (sel !== EXECUTE_SELECTOR && sel !== EXECUTE_BATCH_SELECTOR) {
    throw new Error(
      `wrapExecuteUserOp: only execute()/executeBatch() may be wrapped (got selector ${sel}); ` +
        "the account reverts UnsupportedInnerSelector otherwise"
    );
  }
  return ethers.concat([EXECUTE_USER_OP_SELECTOR, innerCallData]);
}

/** True if callData is already wrapped with the executeUserOp selector. */
export function isExecuteUserOpWrapped(callData: string): boolean {
  return callData.slice(0, 10).toLowerCase() === EXECUTE_USER_OP_SELECTOR;
}
