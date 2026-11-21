# OP Sepolia: why the S3b inline-renewal cell is not run (numbers)

**This is a calculation, not an execution result.** It uses chain reads at one block and the contract's own formulas. No operation was sent to produce it. DSR ruled (B) on 2026-11-21: S3b does not run on OP networks (`skipS3b` in the run config), and the run reports it as NOT RUN.

## Inputs (OP Sepolia, chain 11155420, block 51717913, Tenderly public gateway)

| Read | Value |
|---|---|
| `SuperPaymaster(0x3C73…31E7).cachedPrice()` | 155745662987, 8 decimals (1557.46 USD/ETH) |
| `aPNTsPriceUSD()` | 2e16 (0.02 USD) |
| `protocolFeeBPS()` | 1000 |
| Validation buffer | 1000 bps (SDK `SUPER_PAYMASTER_VALIDATION_BUFFER_BPS`, as SuperPaymaster.sol:343-344) |
| Base fee | 250 wei |
| `eth_feeHistory` priority rewards, p50 over 10 blocks (the SDK default) | `[0, 0, 1e6, 0, 1.5e6, 1.5e6, 0, 0, 1.5e6, 1.5e6]`. The SDK takes the median, which for an even count is the mean of the two middle values: 5e5. 5 of the 10 blocks are 0. |
| `eth_feeHistory` priority rewards, p75 over 20 blocks (the op-sepolia-rc8 config) | Median 5e5. 10 of the 20 blocks are 0. |
| `xPNTsTokenV2` `SP_CAP_FLOOR` | 250e18 aPNTs, a contract constant (xPNTsV2Base.sol:32). An SP allowance or user total below it reverts `BelowFloor` (xPNTsTokenV2Ext.sol:114, :123). |

`maxFeePerGas` is 2 × base fee + priority, which here is 500,500 wei.

## The reservation a0 (per op)

SP reserves `Amax = ceil(ceil(maxCost × price × 1e18 / (10^dec × aPNTsPriceUSD)) × (1 + fee + buffer))`, where `maxCost = (PVG + VGL + CGL + pmVGL + pmPostOp) × maxFeePerGas`.
- The sum of the limits is **estimated**, not measured, at 1.2e6–2.0e6 gas. The real value is the bundler's estimate × 1.5, with postOp at least 500k.
- That gives maxCost 6.0e11–1.0e12 wei, and **Amax ≈ 0.056e18–0.094e18 aPNTs**.

## The actual charge (per op)

SP's postOp charges `ceil(((actualGasCost + bufWei) × price × 1e18 / (10^dec × aPNTsPriceUSD)) × (1 + fee))`. Here `bufWei = (cPostop 450000 + cWrap 5000 + ceil((callGas + postOpGas) × 10%)) × actualUserOpFeePerGas` (SuperPaymaster.sol:467-480). The unused part of the reservation is refunded (xPNTsTokenV2.sol:265), so the allowance's `used` grows by the charge only.

The inputs are ranges:
- `actualGasUsed` is **337,807–406,110**. This is SP's fork measurement of its SP arm (fork of OP Sepolia block 51716429, deploy commit 99a38d8d), not an SDK run.
- `postOpGas` is taken as 500k–750k and `callGas` as 50k–100k.
- The price is base fee + priority = 500,250 wei.

The charge is **0.036e18–0.041e18 aPNTs per op**.

## When a renewal would be needed

SP_RENEW is needed and allowed only when `cap − used < Amax ≤ cap`: previewLock returns INSUFFICIENT without the renewal and OK with it (xPNTsTokenV2.sol:193-220). A renewal resets `used` and keeps `cap` (xPNTsTokenV2.sol:237-243). The cap is at least 250e18. Starting from `used = 0` at the floor, the allowance therefore needs about **250e18 / charge ≈ 6,200–6,900 default-fee ops** before an op needs a renewal. The `maxOps` bound is at most 32, and the SP planner's budget gate allows far fewer.

## Why the alternatives were not taken (DSR, 2026-11-21)
- **(A) Raise the S3b op's maxFeePerGas so that Amax reaches the cap.** The planner prices its budget gate at `PC_PRICE_CAP` 3500 USD (fixed with deploy commit 99a38d8d), not at cachedPrice. An Amax of about 250e18 at cachedPrice is about 562e18 at the cap price. Even at the smallest N (5), `(N+5) × Amax ≈ 5620e18 > 5000e18`.
- **(E) Lower the allowance to the reservation's scale.** The contract refuses a cap below 250e18 (see above).
- **A third-party transfer to consume the shared user total.** Not considered: it would arrange a real transfer only to create the renewal condition.

## What this means
On a low-fee chain, a user at the floor allowance makes thousands of sponsored ops before any renewal is needed.

The renewal path was not executed on the OP deployment. What covers it:
- unit tests;
- the SP 5.5.0 rc.4 run on a **local fork** of Sepolia, 2026-11-11 (`docs/sp550-cutover/fork-rehearsal/live-e2e-rc4.txt`). SP_RENEW was carried in "S3b spend 1/8" on that fork.

This repo holds no record of a live (non-fork) SP_RENEW transaction.
