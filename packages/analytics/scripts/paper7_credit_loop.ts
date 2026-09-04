/**
 * RETIRED: the legacy script impersonated contracts and called recordDebt directly,
 * so its output did not demonstrate an ERC-4337/SuperPaymaster settlement.
 *
 * Use:
 *   REPCREDIT_OUTPUT_DIR=/absolute/new/directory pnpm repcredit:e2e
 */
throw new Error(
  "paper7_credit_loop.ts is retired because it bypassed handleOps/postOp; run `pnpm repcredit:e2e` from the SDK root.",
);
