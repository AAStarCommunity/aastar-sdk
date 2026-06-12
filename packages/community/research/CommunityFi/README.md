# CommunityFi — Research Artifacts

Reproducible agent-based simulation and economic-security analysis for the paper

> **CommunityFi: Reputation-Backed Credit for Sustainable Gasless Participation in Ethereum Account Abstraction**
> Huifeng Jiao, Nathapon Udomlertsakul (International College of Digital Innovation, Chiang Mai University)

Public, permissively-licensed (Apache-2.0) so anyone can verify, replicate, or extend the results in the paper. The paper cites this directory as the canonical home of the data and code.

## What's in here

```
communityfi_abm.py                  — backbone ABM (A0–A3 ablation, 1000-agent pool)
communityfi_abm_tiered.py           — 4-tier community-service redemption extension (T1–T4 ladder)
incentive_sim.py                    — incentive-compatibility / Sybil-resistance simulation

communityfi_abm_results.csv         — per-arm × per-horizon outcomes (mean ± std over 20 draws)
communityfi_abm_sensitivity.csv     — composition sweep (free-rider share → A3 vs A2 sustainability)
communityfi_abm_tier_ladder.csv     — tier-ladder ablation outcomes (T1–T4 × {3mo, 6mo, 1yr, 3yr})
communityfi_abm_tier_breakdown.csv  — per-tier redemption breakdown (count, spend, contributor-share)
incentive_sim_results.csv           — incentive-compatibility numerical results
```

Detailed model description (ODD protocol + behavioral typology + calibration sources) lives in [`EXPERIMENT_DESIGN.md`](./EXPERIMENT_DESIGN.md).

## Run

```bash
cd packages/community/research/CommunityFi
python3 communityfi_abm.py            # ~2 s, regenerates A0–A3 results + Figure 13
python3 communityfi_abm_tiered.py     # ~5 s, regenerates tier-ladder results + Figure 14
python3 incentive_sim.py              # ~1 s, regenerates Figure 11
```

Outputs are written next to the scripts (CSVs) and into the sibling `images/` directory used by the manuscript build. Deterministic master seeds: `20260528` (ABM), `20260526` (incentive). Requires `numpy`, `matplotlib`; no other dependencies.

## Headline results (1 yr horizon, mean over 20 community draws of N = 75)

| Arm | Participation | Frozen share | Contributor budget-share |
|:---|---:|---:|---:|
| A0 baseline (no mechanism) | 0.20 | 0.26 | 0.00 |
| A1 +gasless | 0.51 | 0.16 | 0.00 |
| A2 +redeemable (ungated) | 0.76 | 0.00 | 0.79 |
| A3 full CommunityFi (identity-gated) | 0.69 | 0.09 | **0.83** |

3-year contributor budget-share under A3: **~0.93**. Per-tier breakdown under the full T4 portfolio: open (snack) ~38% to contributors / credit (merch) ~33% / reputation (venue) ~71% / top (conference) **100%**.

## Falsifiable boundary

A composition sweep over the pool free-rider share (`communityfi_abm_sensitivity.csv`) shows the identity-gating advantage of A3 over A2 grows from ~2 percentage points in cooperative communities to ~15 in free-rider-heavy ones, but **collapses at ~75% free-rider share** (A3 participation falls to ~0.23). The mechanism cannot rescue a community whose composition is overwhelmingly extractive — this is reported in the paper as a stated failure mode.

## License

Apache 2.0 (same as the rest of `aastar-sdk`).
