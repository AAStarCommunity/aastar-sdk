# guardian audit D2: liveness recovery (FU-100, FU-101)

Invariant, unchanged: a range is COMPLETE only when it was fully verified. INCOMPLETE stays the fail-safe answer.
This change only removes two ways a correct keeper could be stuck in INCOMPLETE forever.

## FU-100: verified finalized anchors

**Problem.** Each clipped scan walked parent hashes from `to + 1` to finalized on both providers. Cost per scan
was `finalized - to`, and a gap above `maxAnchorBlocks` was INCOMPLETE on every run, with no progress kept.

**Approach.** An anchor is `{ scope, block, hash }`: a header that both providers linked by parentHash to their own
finalized header (or to an older anchor) during an earlier scan. It is stored in the same store as the checkpoint.
- Use: the scan picks the lowest anchor with `to <= block <= min(finalized A, finalized B)` and walks only
  `to + 1 .. anchor.block`. The walk reads the header at `anchor.block` on both providers. If either hash differs from
  the stored hash, the scan throws `FinalityConflictError` (a reorg below finalized, or a corrupt store). Nothing commits.
- Record: every successful walk records anchors at heights divisible by 1024, plus its top, where both providers
  returned the same hash. Anchors below the new checkpoint are dropped. At most 1024 are kept (thinned evenly).
- Large gap: when the reference (lowest usable anchor, else finalized) is more than `maxAnchorBlocks` above `to`,
  the scan walks `maxAnchorBlocks` headers down from the reference, links them, stores the lowest one as a new anchor,
  and returns INCOMPLETE without scanning logs. The next scan continues from there. A keeper any distance behind
  recovers in `gap / maxAnchorBlocks` runs; after that each scan walks at most about 1024 headers.
- Storage: `StoreSnapshot.anchors` and `Commit.anchors` (optional). An anchor write is part of the normal CAS commit,
  so it is atomic with the checkpoint and fails on a stale revision. A descent stores anchors through a commit with
  `next: null` and no rows; a failure there is swallowed (the cache is optional) and the scan stays INCOMPLETE.
- Scope binding: anchors carry the store scope (which hashes chainId). The scanner ignores anchors of another scope,
  malformed rows, and rows above either finalized height. Stores must reject an anchor whose scope differs from the
  commit scope (ScopeChangedError).

**Rejected.** A single anchor at finalized does not help: the tip still has to be linked to it (same walk). Storing
every header is unbounded. Splitting the walk across runs without persisting it repeats the walk forever.

**Stays fail-closed.** The tip is still linked by parentHash to a header that both providers called finalized, now
or earlier. A disagreeing anchor throws. A store without anchor support (`snapshot().anchors` undefined) gets
exactly the old behaviour: full walk, INCOMPLETE above the bound, no writes on INCOMPLETE.

## FU-101: gas-derived receipt budget

**Problem.** Fixed caps (1024 logs per receipt, 16384 per block, 1 MiB per receipt, 32 MiB per block, 64 KiB data)
are below what the chain allows. Anyone can collide the bloom and then exceed a cap, so the block is never verified.

**Approach.** Derive the budget from the block's `gasLimit` (both providers must agree on it). Execution gas consumed in
a block is at most `2 * gasLimit` (gas refunds return at most half of a transaction's consumed gas; London lowered
that to a fifth). A log costs at least `375 + 375 * topics + 8 * dataBytes`. So per block: logs <= `2G / 375`,
data+topic bytes <= `2G / 8`, transactions <= `2G / 21000` (+1 for the OP system transaction), and one receipt can
be the whole block. Every component is `max(old fixed cap, derived)`, so no block that passed before fails now.
`G` is clamped to `maxProofGas` (default 100M, at most 1e9) to keep memory bounded: at 100M a block may carry
533k logs and about 27 MB of payload. Copies stay bounded by that: receipts are copied once per provider (strings are
shared, not duplicated), and only logs of watched addresses are normalised and compared; other logs are validated in
place and proven through receiptsRoot. A block above the budget is INCOMPLETE with a block-specific reason that says
whether the gas limit was missing, above `maxProofGas`, or the block broke the gas bound.
The bound assumes the EVM gas schedule (LOG 375/topic 375/byte 8, intrinsic 21000) and that the block gas limit
counts post-refund gas. A chain that charges less, or a fork that changes either rule, can only make a valid block
exceed the budget: that block is INCOMPLETE (liveness), never a false COMPLETE, because the proof is the receiptsRoot match.

**Rejected.** An "unverifiable block" state that lets the checkpoint pass after a decision: it adds a path where an
unverified block can be skipped, and the gas bound already makes every valid block within `maxProofGas` verifiable.
Raising the fixed numbers: any fixed number below the gas bound can be exceeded on purpose.

**Stays fail-closed.** The budget only decides whether a proof is attempted. Soundness still comes from both providers'
receipts encoding to the agreed receiptsRoot. A lying gasLimit can only raise work up to `maxProofGas`, or cause
INCOMPLETE. Range-log reads (`eth_getLogs` for a watched address) keep their fixed caps; see the follow-up note.

## What a third-party store implements

Optional. To get the cache: return `anchors: []` from `snapshot()` on a fresh store; persist `Commit.anchors` (a full
replacement set, absent means unchanged) in the same atomic write as the rest of the commit; reject the whole commit
with ScopeChangedError when an anchor's scope differs from `change.scope`; return copies. `runStoreConformance` checks
this (`anchors/*` cells), and reports them `skipped` with detail "no anchor cache" for a store without support.
