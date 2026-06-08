#!/usr/bin/env python3
"""
CommunityFi — Agent-Based Model of community participation & sustainability (v5).

Behavioral grounding (this is the key professionalism upgrade): agents are typed by
the EMPIRICAL behavioral typology of public-goods experiments (Fischbacher, Gachter &
Fehr 2001, Economics Letters): ~50% conditional cooperators, ~30% free riders,
~14% hump-shaped, ~6% unconditional cooperators. So an agent's response to incentives
is calibrated to real experimental proportions, not invented.

Decision model: a stochastic (graded) form of Granovetter's (1978) heterogeneous-
threshold model -- weekly participation probability rises with own motivation, reward,
and PEER participation last week (social influence), and falls with friction and a
personal threshold; bounded-rational logistic choice (Kahneman 2002). Each type maps
naturally: conditional cooperators ARE threshold/peer-responsive agents; free riders
respond mainly to redeemable reward and contribute little (they consume the budget);
hump-shaped agents WITHDRAW when free-riding is high (disillusionment); unconditional
cooperators always act (the founders/core analog).

Population: a POOL of 1000 typed agents (a region/global pool); each experiment draws
a community of N=75 at random -> realistic compositional randomness + generalizability.
We report mean +/- std over many community draws (LLM Economist, Karten et al. 2025
arXiv 2507.15815, reports a single fixed-skill run; we improve on that). A0->A3 is an
ablation ladder (cf. their -21.9pp ablation). Sustainability metric = share of the
finite monthly redemption budget captured by genuine contributors.

Documented per the ODD protocol (Grimm et al. 2006/2020) in the paper appendix.
SIMULATED evidence (S). Deterministic master seed. Run: python3 communityfi_abm.py
"""
from __future__ import annotations
import os, csv
from dataclasses import dataclass
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

HERE = os.path.dirname(os.path.abspath(__file__))
MASTER_SEED = 20260528
POOL_SIZE = 1000
N_COMMUNITY = 75
N_DRAWS = 20               # community samples from the pool (report mean +/- std)
WEEKS = 156
HORIZONS = {"3mo": 13, "6mo": 26, "1yr": 52, "3yr": 156}
APATHY_W, FROZEN_W = 12, 24
BUDGET_PER_MONTH = 5000.0   # finite monthly community budget (RMB-equivalent points-value)
GAS_ALLOC = 0.15            # reserve 15% of budget for gas sponsorship (rest for redemption)
GAS_COST = 0.5              # per sponsored participation, L2 on-chain cost (cheap; ~ measured)
REDEEM_DEMAND = 0.6         # demand-driven redemption: agents hoard points part of the time
R_STAR = 300.0

# Fischbacher-Gachter-Fehr (2001) behavioral typology + proportions.
# fields: share, motivation m, skill s, social weight (peer influence),
#         reward sensitivity, base threshold theta, contribution quality, withdrawal
TYPES = {
    "conditional": dict(share=0.50, m=0.45, s=0.65, soc=0.70, rwd=0.9, theta=0.35, q=0.75, withdraw=0.0),
    "freerider":   dict(share=0.30, m=0.15, s=0.30, soc=0.10, rwd=1.4, theta=0.65, q=0.20, withdraw=0.0),
    "hump":        dict(share=0.14, m=0.40, s=0.55, soc=0.60, rwd=0.8, theta=0.40, q=0.55, withdraw=0.6),
    "unconditional": dict(share=0.06, m=0.90, s=0.88, soc=0.20, rwd=0.6, theta=0.05, q=0.90, withdraw=0.0),
}
REWARDS = [(0.55, 10), (0.25, 40), (0.15, 80), (0.05, 300)]
TIERS_REDEEM = [("coffee", 40, "points"), ("voucher", 150, "active_nft"), ("stay", 400, "star_nft")]
GAS_FRICTION = 0.15
REWARD_DROP = 0.28
HABIT_DROP, HABIT_GAIN, HABIT_DECAY = 0.20, 0.18, 0.04


@dataclass
class Arm:
    name: str; gasless: bool; redeemable: bool; gated: bool


ARMS = [
    Arm("A0 baseline",    False, False, False),
    Arm("A1 +gasless",    True,  False, False),
    Arm("A2 +redeemable", True,  True,  False),
    Arm("A3 full CommFi", True,  True,  True),
]


def build_pool(seed, fr_share=None):
    """1000 typed agents per Fischbacher proportions (fr_share overrides free-rider
    share for the composition sweep; the slack is taken from conditional cooperators)."""
    rng = np.random.default_rng(seed)
    shares = {k: v["share"] for k, v in TYPES.items()}
    if fr_share is not None:
        d = fr_share - shares["freerider"]
        shares["freerider"] = fr_share
        shares["conditional"] = max(0.05, shares["conditional"] - d)
        tot = sum(shares.values()); shares = {k: v / tot for k, v in shares.items()}
    types = rng.choice(list(shares), size=POOL_SIZE, p=[shares[k] for k in shares])
    A = {k: np.zeros(POOL_SIZE) for k in ("m", "s", "soc", "rwd", "theta", "q", "withdraw")}
    for i, t in enumerate(types):
        tp = TYPES[t]
        A["m"][i] = np.clip(rng.normal(tp["m"], 0.08), 0.02, 0.99)
        A["s"][i] = np.clip(rng.normal(tp["s"], 0.08), 0.05, 0.99)
        A["theta"][i] = np.clip(rng.normal(tp["theta"], 0.06), 0.0, 0.95)
        for k in ("soc", "rwd", "q", "withdraw"):
            A[k][i] = tp[k]
    A["type"] = types
    return A


def run_arm(arm, pop, seed):
    m, s, soc, rwd, theta0 = pop["m"], pop["s"], pop["soc"], pop["rwd"], pop["theta"]
    q, withdraw = pop["q"], pop["withdraw"]
    rng = np.random.default_rng(seed)
    n = len(m)
    habit = np.zeros(n); reputation = np.zeros(n); points = np.zeros(n)
    last_active = np.full(n, 99, dtype=int)
    parts_12w = np.zeros((n, APATHY_W), dtype=int)
    snap = {h: {} for h in HORIZONS}
    series = {"part": []}
    spent_total = spent_contrib = 0.0     # ACTUAL redemption spend (emergent, <= budget)
    gas_spent = 0.0                       # ACTUAL gas-sponsorship spend (emergent)
    gas_budget = 0.0
    prev_frac = 0.12
    contrib_share_now = 0.0

    for w in range(WEEKS):
        if w % 4 == 0:                    # monthly budget reset: reserve a gas slice
            gas_budget = GAS_ALLOC * BUDGET_PER_MONTH if arm.gasless else 0.0
        r = rng.random(); cum = 0.0
        for prob, pts in REWARDS:
            cum += prob
            if r <= cum: pay = pts; break
        reward_pull = np.zeros(n)
        if arm.redeemable:
            if arm.gated:
                qual = np.where(reputation >= R_STAR, 1.0,
                        np.where(last_active <= APATHY_W, 0.55, 0.25))
                reward_pull = REWARD_DROP * rwd * qual
            else:
                reward_pull = REWARD_DROP * rwd
        # gas is sponsored only while the reserved gas budget has funds; once exhausted
        # (or in A0) the user bears the gas friction. Gas drawn from the finite budget.
        friction = 0.0 if (arm.gasless and gas_budget > 0) else GAS_FRICTION
        # hump-shaped withdraw when participation is high but contributor-share is low
        disillusion = withdraw * max(0.0, prev_frac - 0.3) * max(0.0, 0.6 - contrib_share_now)
        util = (0.85 * m + reward_pull + soc * prev_frac + HABIT_DROP * habit
                - friction - 0.70 * theta0 - disillusion)
        p = 1.0 / (1.0 + np.exp(-5.0 * (util - 0.45)))
        join = rng.random(n) < p
        prev_frac = float(join.mean())
        if arm.gasless:                              # actual gas spend drawn from reserve
            gc = float(join.sum()) * GAS_COST
            gas_budget -= gc; gas_spent += gc

        habit = np.where(join, np.clip(habit + HABIT_GAIN, 0, 1), np.clip(habit - HABIT_DECAY, 0, 1))
        points += np.where(join, pay * (0.5 + 0.5 * q), 0.0)
        reputation += np.where(join, pay * q, 0.0)
        last_active = np.where(join, 0, last_active + 1)
        parts_12w[:, w % APATHY_W] = join

        if arm.redeemable and (w % 4 == 3):
            active_nft = parts_12w.sum(axis=1) >= 2
            star_nft = reputation >= R_STAR
            budget = (1.0 - GAS_ALLOC) * BUDGET_PER_MONTH   # redemption gets the non-gas slice
            for i in rng.permutation(n):
                if budget <= 0: break
                if rng.random() > REDEEM_DEMAND: continue   # demand-driven: agent hoards this month
                for name, cost, gate in reversed(TIERS_REDEEM):
                    if points[i] < cost or cost > budget: continue
                    if arm.gated:
                        if gate == "active_nft" and not active_nft[i]: continue
                        if gate == "star_nft" and not star_nft[i]: continue
                    points[i] -= cost; budget -= cost; spent_total += cost
                    if reputation[i] >= R_STAR: spent_contrib += cost
                    break
            contrib_share_now = (spent_contrib / spent_total) if spent_total > 0 else 0.0

        series["part"].append(float(join.mean()))
        wk = w + 1
        for h, hw in HORIZONS.items():
            if wk == hw:
                months = max(1, wk // 4)
                snap[h] = dict(
                    part=float(np.mean(series["part"][-13:])),
                    frozen=float((last_active > FROZEN_W).mean()),
                    sustain=(spent_contrib / spent_total) if spent_total > 0 else 0.0,
                    gas_pm=gas_spent / months,          # actual gas spend per month
                    redeem_pm=spent_total / months,     # actual redemption spend per month
                )
    return snap, series


def experiment(fr_share=None, n_draws=N_DRAWS):
    """Draw n_draws communities of N=75 from a 1000-agent pool; return per-arm,
    per-horizon mean+std across draws, plus pop-0 series for plotting."""
    keys = ("part", "frozen", "sustain", "gas_pm", "redeem_pm")
    agg = {a.name: {h: {k: [] for k in keys} for h in HORIZONS} for a in ARMS}
    series0 = {}
    for di in range(n_draws):
        pool = build_pool(MASTER_SEED + 31 * di, fr_share=fr_share)
        idx = np.random.default_rng(MASTER_SEED + 31 * di + 7).choice(POOL_SIZE, N_COMMUNITY, replace=False)
        comm = {k: (v[idx] if isinstance(v, np.ndarray) else v) for k, v in pool.items()}
        for arm in ARMS:
            snap, series = run_arm(arm, comm, MASTER_SEED + 31 * di + 1)
            if di == 0: series0[arm.name] = series
            for h in HORIZONS:
                for k in keys:
                    agg[arm.name][h][k].append(snap[h][k])
    return agg, series0


def main():
    print(f"Pool={POOL_SIZE} (Fischbacher types) | community N={N_COMMUNITY} | {N_DRAWS} draws | horizons={list(HORIZONS)}")
    print("Type shares: " + ", ".join(f"{k}={v['share']}" for k, v in TYPES.items()) + "\n")

    agg, series0 = experiment()
    for h in HORIZONS:
        print(f"=== {h} ({HORIZONS[h]}w) === mean+-std over {N_DRAWS} community draws")
        print(f"{'arm':16s}{'participation':>16}{'frozen':>14}{'sustain':>16}")
        for arm in ARMS:
            d = agg[arm.name][h]
            print(f"{arm.name:16s}{np.mean(d['part']):8.3f}+-{np.std(d['part']):.3f}"
                  f"{np.mean(d['frozen']):8.3f}+-{np.std(d['frozen']):.3f}"
                  f"{np.mean(d['sustain']):9.3f}+-{np.std(d['sustain']):.3f}")
        print()

    # budget vs ACTUAL spend (budget is a reserve; actual is emergent -- hoarding & cheap gas)
    print(f"Budget vs ACTUAL monthly spend @1yr  (total budget={BUDGET_PER_MONTH:.0f}, "
          f"gas reserve={GAS_ALLOC*BUDGET_PER_MONTH:.0f}, redeem reserve={(1-GAS_ALLOC)*BUDGET_PER_MONTH:.0f})")
    for arm in ARMS:
        d = agg[arm.name]["1yr"]
        print(f"  {arm.name:16s} actual gas/mo={np.mean(d['gas_pm']):6.1f}  "
              f"actual redeem/mo={np.mean(d['redeem_pm']):7.1f}")
    print()

    # composition sweep: vary the pool free-rider share -> find the failure boundary
    print("Composition sweep @1yr: pool free-rider share -> A3 sustainability & participation")
    print(f"{'fr_share':>9}{'A3_part':>9}{'A3_sustain':>12}{'A2_sustain':>12}")
    sweep = []
    for frs in (0.15, 0.30, 0.45, 0.60, 0.75):
        a, _ = experiment(fr_share=frs, n_draws=8)
        p3 = np.mean(a["A3 full CommFi"]["1yr"]["part"])
        s3 = np.mean(a["A3 full CommFi"]["1yr"]["sustain"])
        s2 = np.mean(a["A2 +redeemable"]["1yr"]["sustain"])
        sweep.append((frs, p3, s3, s2))
        print(f"{frs:9.2f}{p3:9.3f}{s3:12.3f}{s2:12.3f}")

    # figure
    fig, ax = plt.subplots(1, 2, figsize=(12, 4))
    for arm in ARMS:
        ax[0].plot(series0[arm.name]["part"], label=arm.name)
    for h, hw in HORIZONS.items():
        ax[0].axvline(hw, ls=":", c="grey", lw=0.6)
    ax[0].set(xlabel="Week", ylabel="Weekly participation", title="Participation (one community draw)")
    ax[0].legend(fontsize=8)
    frs_x = [x[0] for x in sweep]
    ax[1].plot(frs_x, [x[2] for x in sweep], "o-", label="A3 sustain (gated)")
    ax[1].plot(frs_x, [x[3] for x in sweep], "s--", label="A2 sustain (ungated)")
    ax[1].set(xlabel="Pool free-rider share", ylabel="Contributor budget-share @1yr",
              title="Sustainability vs free-rider share (failure boundary)")
    ax[1].legend(fontsize=8)
    plt.tight_layout()
    fig_p = os.path.join(HERE, "..", "images", "fig_abm_participation.png")
    plt.savefig(fig_p, dpi=150); plt.close()
    print("\nwrote", os.path.normpath(fig_p))

    with open(os.path.join(HERE, "communityfi_abm_results.csv"), "w", newline="") as fh:
        wtr = csv.writer(fh); wtr.writerow(["arm", "horizon", "metric", "mean", "std"])
        for arm in ARMS:
            for h in HORIZONS:
                for k in ("part", "frozen", "sustain"):
                    v = agg[arm.name][h][k]
                    wtr.writerow([arm.name, h, k, f"{np.mean(v):.4f}", f"{np.std(v):.4f}"])
    with open(os.path.join(HERE, "communityfi_abm_sensitivity.csv"), "w", newline="") as fh:
        wtr = csv.writer(fh); wtr.writerow(["fr_share", "A3_part", "A3_sustain", "A2_sustain"])
        wtr.writerows([[f"{a:.2f}", f"{b:.4f}", f"{c:.4f}", f"{d:.4f}"] for a, b, c, d in sweep])


if __name__ == "__main__":
    main()
