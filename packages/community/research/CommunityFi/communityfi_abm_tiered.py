#!/usr/bin/env python3
"""
CommunityFi — Tiered Community-Service Redemption ablation (v7 extension).

Extends the v6 ABM (communityfi_abm.py) with a 4-tier community-service redemption
portfolio that goes BEYOND gas sponsorship to general community resources (idle
capacity such as snacks, merch, venue time, conference seats). Quantifies the
marginal contribution of each tier to participant activation and to the
contributor share of the finite community budget.

Tiers (cost in points; gate determines who can redeem):
  snack       10 pts  open       Anyone; activates passive members via a low-friction perk
  merch       50 pts  credit     Needs >=1 contribution in last 24w (basic credit threshold)
  venue      150 pts  active_nft Active participant (>=2 contributions in 12w)
  conference 400 pts  star_nft   Top reputation (rep >= R_STAR), gates a high-value service

Ladder ablation (under the FULL A3 mechanism -- gasless + redeemable + gated):
  T1: snack only
  T2: snack + merch
  T3: snack + merch + venue
  T4: snack + merch + venue + conference  (full portfolio)

Run: python3 communityfi_abm_tiered.py
Reuses constants and the typed-agent pool from communityfi_abm.py so results are
directly comparable to the v6 A0--A3 backbone (which is NOT modified).
"""
from __future__ import annotations
import os, csv
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from communityfi_abm import (
    MASTER_SEED, POOL_SIZE, N_COMMUNITY, N_DRAWS, WEEKS, HORIZONS,
    APATHY_W, FROZEN_W, BUDGET_PER_MONTH, GAS_ALLOC, GAS_COST,
    REDEEM_DEMAND, R_STAR, REWARDS, GAS_FRICTION, REWARD_DROP,
    HABIT_DROP, HABIT_GAIN, HABIT_DECAY, build_pool,
    WEEKLY_CHURN_RATE, BURNOUT_DECAY, MONTHLY_RECRUITS,
    INITIAL_PREV_FRAC, PERMANENT_LEFT_MARKER, TYPES,
)

HERE = os.path.dirname(os.path.abspath(__file__))

# 4 community-service tiers — semantic names matching the paper's idle-resource narrative
COMMUNITY_TIERS = [
    ("snack",      10,  "open"),
    ("merch",      50,  "credit"),
    ("venue",      150, "active_nft"),
    ("conference", 400, "star_nft"),
]

# Progressive enablement ladder under the full A3 mechanism
LADDER = [
    ("T1 snack only",         ["snack"]),
    ("T2 +merch",             ["snack", "merch"]),
    ("T3 +venue",             ["snack", "merch", "venue"]),
    ("T4 +conference",        ["snack", "merch", "venue", "conference"]),
]


def run_tiered(pop, seed, enabled_tiers):
    """Run the full A3 mechanism (gasless + redeemable + gated) with redemption
    restricted to `enabled_tiers`. Includes the same v7 long-horizon dynamics as
    the backbone ABM (permanent churn, burnout decay, monthly recruitment, zero-
    bootstrap social influence) so tier-ladder numbers stay calibrated against
    Fritsch et al. 2024 / arXiv:2204.01176 alongside the A0--A3 results."""
    tiers = [(n, c, g) for (n, c, g) in COMMUNITY_TIERS if n in enabled_tiers]
    m = pop["m"].copy(); s = pop["s"].copy(); soc = pop["soc"].copy()
    rwd = pop["rwd"].copy(); theta0 = pop["theta"].copy()
    q = pop["q"].copy(); withdraw = pop["withdraw"].copy()
    m_base = m.copy()
    rng = np.random.default_rng(seed)
    n = len(m)
    habit = np.zeros(n); reputation = np.zeros(n); points = np.zeros(n)
    last_active = np.full(n, 99, dtype=int)
    parts_12w = np.zeros((n, APATHY_W), dtype=int)
    no_reward_streak = np.zeros(n, dtype=int)
    left = np.zeros(n, dtype=bool)
    snap = {h: {} for h in HORIZONS}
    series_part = []
    spent_total = spent_contrib = 0.0
    gas_spent = 0.0; gas_budget = 0.0
    prev_frac = INITIAL_PREV_FRAC; contrib_share_now = 0.0
    tier_count = {n_: 0 for (n_, _, _) in COMMUNITY_TIERS}
    tier_spend = {n_: 0.0 for (n_, _, _) in COMMUNITY_TIERS}
    tier_to_contrib = {n_: 0.0 for (n_, _, _) in COMMUNITY_TIERS}
    reengaged = 0

    for w in range(WEEKS):
        if w % 4 == 0:
            gas_budget = GAS_ALLOC * BUDGET_PER_MONTH
        r = rng.random(); cum = 0.0
        for prob, pts in REWARDS:
            cum += prob
            if r <= cum:
                pay = pts; break

        qual = np.where(reputation >= R_STAR, 1.0,
                np.where(last_active <= APATHY_W, 0.55, 0.25))
        reward_pull = REWARD_DROP * rwd * qual
        friction = 0.0 if gas_budget > 0 else GAS_FRICTION
        disillusion = withdraw * max(0.0, prev_frac - 0.3) * max(0.0, 0.6 - contrib_share_now)
        util = (0.85 * m + reward_pull + soc * prev_frac + HABIT_DROP * habit
                - friction - 0.70 * theta0 - disillusion)
        p = 1.0 / (1.0 + np.exp(-5.0 * (util - 0.45)))
        join_raw = rng.random(n) < p
        join = join_raw & ~left

        was_frozen = (last_active > FROZEN_W) & ~left
        reengaged += int(np.sum(join & was_frozen))
        prev_frac = float(join.mean())

        gc = float(join.sum()) * GAS_COST
        gas_budget -= gc; gas_spent += gc

        habit = np.where(join, np.clip(habit + HABIT_GAIN, 0, 1),
                                np.clip(habit - HABIT_DECAY, 0, 1))
        points += np.where(join, pay * (0.5 + 0.5 * q), 0.0)
        reputation += np.where(join, pay * q, 0.0)
        last_active = np.where(join, 0, last_active + 1)
        parts_12w[:, w % APATHY_W] = join
        credit_eligible = last_active <= 2 * APATHY_W

        # --- v7 long-horizon dynamics (identical to communityfi_abm.run_arm) -
        no_reward_streak = np.where(join, no_reward_streak + 1, no_reward_streak)
        m = np.maximum(m - BURNOUT_DECAY * (no_reward_streak / 12.0) * join,
                       0.3 * m_base)
        churn_draw = rng.random(n) < WEEKLY_CHURN_RATE
        new_left = churn_draw & ~left
        left = left | new_left
        last_active = np.where(new_left, PERMANENT_LEFT_MARKER, last_active)
        if (w % 4 == 0) and MONTHLY_RECRUITS > 0:
            departed_idx = np.where(left)[0]
            n_replace = min(MONTHLY_RECRUITS, len(departed_idx))
            if n_replace > 0:
                replace = rng.choice(departed_idx, size=n_replace, replace=False)
                shares = {k: v["share"] for k, v in TYPES.items()}
                new_types = rng.choice(list(shares), size=n_replace,
                                       p=[shares[k] for k in shares])
                for j, t in zip(replace, new_types):
                    tp = TYPES[t]
                    m[j] = np.clip(rng.normal(tp["m"], 0.08), 0.02, 0.99)
                    m_base[j] = m[j]
                    s[j] = np.clip(rng.normal(tp["s"], 0.08), 0.05, 0.99)
                    theta0[j] = np.clip(rng.normal(tp["theta"], 0.06), 0.0, 0.95)
                    soc[j] = tp["soc"]; rwd[j] = tp["rwd"]; q[j] = tp["q"]
                    withdraw[j] = tp["withdraw"]
                    habit[j] = 0.0; reputation[j] = 0.0; points[j] = 0.0
                    last_active[j] = 99; left[j] = False
                    no_reward_streak[j] = 0
                    parts_12w[j, :] = 0
        # -------------------------------------------------------------------

        if w % 4 == 3:
            active_nft = parts_12w.sum(axis=1) >= 2
            star_nft = reputation >= R_STAR
            budget = (1.0 - GAS_ALLOC) * BUDGET_PER_MONTH
            for i in rng.permutation(n):
                if budget <= 0: break
                if left[i]: continue
                if rng.random() > REDEEM_DEMAND: continue
                for (name, cost, gate) in reversed(tiers):
                    if points[i] < cost or cost > budget: continue
                    if gate == "credit" and not credit_eligible[i]: continue
                    if gate == "active_nft" and not active_nft[i]: continue
                    if gate == "star_nft" and not star_nft[i]: continue
                    points[i] -= cost; budget -= cost
                    spent_total += cost
                    tier_count[name] += 1
                    tier_spend[name] += cost
                    no_reward_streak[i] = 0
                    if reputation[i] >= R_STAR:
                        spent_contrib += cost
                        tier_to_contrib[name] += cost
                    break
            contrib_share_now = (spent_contrib / spent_total) if spent_total > 0 else 0.0

        series_part.append(float(join.mean()))
        wk = w + 1
        for h, hw in HORIZONS.items():
            if wk == hw:
                months = max(1, wk // 4)
                still_here = ~left
                n_here = max(1, int(still_here.sum()))
                is_frozen = still_here & (last_active > FROZEN_W)
                active_now_share = float(join[still_here].mean()) if n_here > 0 else 0.0
                snap[h] = dict(
                    part=float(np.mean(series_part[-13:])),
                    active=active_now_share,
                    frozen=float(is_frozen.sum() / n_here),
                    departed=float(left.mean()),
                    sustain=(spent_contrib / spent_total) if spent_total > 0 else 0.0,
                    reengaged_pm=reengaged / months,
                )
    return snap, tier_count, tier_spend, tier_to_contrib


def main():
    print(f"Tier-ladder ablation (under full A3 mechanism)")
    print(f"Tiers: {[(n, c, g) for n, c, g in COMMUNITY_TIERS]}")
    print(f"Ladder: {[n for n, _ in LADDER]}")
    print(f"Pool={POOL_SIZE} | community N={N_COMMUNITY} | {N_DRAWS} draws | horizons={list(HORIZONS)}\n")

    keys = ("part", "active", "frozen", "departed", "sustain", "reengaged_pm")
    agg = {name: {h: {k: [] for k in keys} for h in HORIZONS} for name, _ in LADDER}
    tier_count_agg = {name: {t: [] for t, _, _ in COMMUNITY_TIERS} for name, _ in LADDER}
    tier_spend_agg = {name: {t: [] for t, _, _ in COMMUNITY_TIERS} for name, _ in LADDER}
    tier_contrib_agg = {name: {t: [] for t, _, _ in COMMUNITY_TIERS} for name, _ in LADDER}

    for di in range(N_DRAWS):
        pool = build_pool(MASTER_SEED + 31 * di)
        idx = np.random.default_rng(MASTER_SEED + 31 * di + 7).choice(POOL_SIZE, N_COMMUNITY, replace=False)
        comm = {k: (v[idx] if isinstance(v, np.ndarray) else v) for k, v in pool.items()}
        for (name, tiers_on) in LADDER:
            snap, tc, ts, tcontrib = run_tiered(comm, MASTER_SEED + 31 * di + 1, tiers_on)
            for h in HORIZONS:
                for k in keys:
                    agg[name][h][k].append(snap[h][k])
            for t in tier_count_agg[name]:
                tier_count_agg[name][t].append(tc[t])
                tier_spend_agg[name][t].append(ts[t])
                tier_contrib_agg[name][t].append(tcontrib[t])

    print(f"{'ladder':22s}{'active(now)':>12}{'frozen':>10}{'departed':>10}{'sustain':>10}{'re-eng/mo':>12}")
    for (name, _) in LADDER:
        d = agg[name]["1yr"]
        print(f"{name:22s}{np.mean(d['active']):12.3f}{np.mean(d['frozen']):10.3f}"
              f"{np.mean(d['departed']):10.3f}{np.mean(d['sustain']):10.3f}{np.mean(d['reengaged_pm']):12.2f}")

    print(f"\nPer-tier redemption breakdown @3yr (full T4 portfolio):")
    print(f"  {'tier':12s}{'count':>10}{'spend(pts)':>12}{'contrib-share':>16}")
    full = "T4 +conference"
    for t, _, _ in COMMUNITY_TIERS:
        c = np.mean(tier_count_agg[full][t])
        s = np.mean(tier_spend_agg[full][t])
        share = np.mean([tier_contrib_agg[full][t][i] / tier_spend_agg[full][t][i]
                         if tier_spend_agg[full][t][i] > 0 else 0.0
                         for i in range(len(tier_spend_agg[full][t]))])
        print(f"  {t:12s}{c:10.1f}{s:12.0f}{share:16.2%}")

    # CSV: ladder × horizon outcomes
    with open(os.path.join(HERE, "communityfi_abm_tier_ladder.csv"), "w", newline="") as fh:
        w = csv.writer(fh); w.writerow(["ladder", "horizon", "metric", "mean", "std"])
        for (name, _) in LADDER:
            for h in HORIZONS:
                for k in keys:
                    v = agg[name][h][k]
                    w.writerow([name, h, k, f"{np.mean(v):.4f}", f"{np.std(v):.4f}"])

    # CSV: per-tier breakdown across the whole ladder
    with open(os.path.join(HERE, "communityfi_abm_tier_breakdown.csv"), "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["ladder", "tier", "count_mean", "spend_mean", "contrib_share_mean"])
        for (name, _) in LADDER:
            for t, _, _ in COMMUNITY_TIERS:
                c = tier_count_agg[name][t]
                s = tier_spend_agg[name][t]
                shares = [tier_contrib_agg[name][t][i] / s[i] if s[i] > 0 else 0.0
                          for i in range(len(s))]
                w.writerow([name, t, f"{np.mean(c):.2f}", f"{np.mean(s):.2f}", f"{np.mean(shares):.4f}"])

    # Figure: 2 panels — ladder outcomes + per-tier role under T4
    fig, ax = plt.subplots(1, 2, figsize=(12, 4.2))
    names = [n for (n, _) in LADDER]
    short = [n.split(" ")[0] for n in names]
    fr = [np.mean(agg[n]["1yr"]["frozen"]) for n in names]
    su = [np.mean(agg[n]["1yr"]["sustain"]) for n in names]
    pt = [np.mean(agg[n]["1yr"]["active"]) for n in names]
    x = np.arange(len(names))
    ax[0].bar(x - 0.27, fr, width=0.27, label="Frozen share (lower better)", color="#c44")
    ax[0].bar(x,       pt, width=0.27, label="Active among current members", color="#48a")
    ax[0].bar(x + 0.27, su, width=0.27, label="Contributor budget-share",    color="#4a8")
    ax[0].set_xticks(x); ax[0].set_xticklabels(short)
    ax[0].set_ylim(0, 1)
    ax[0].set_title("(a) Tier-ladder ablation @ 1 yr (under full A3 mechanism)")
    ax[0].set_ylabel("Mean (over 20 community draws)")
    ax[0].legend(fontsize=8, loc="lower right")

    tier_names = [t for t, _, _ in COMMUNITY_TIERS]
    full = "T4 +conference"
    counts = [np.mean(tier_count_agg[full][t]) for t in tier_names]
    cshare = [np.mean([tier_contrib_agg[full][t][i] / tier_spend_agg[full][t][i]
                        if tier_spend_agg[full][t][i] > 0 else 0.0
                        for i in range(len(tier_spend_agg[full][t]))])
              for t in tier_names]
    to_contrib = [c * s for c, s in zip(counts, cshare)]
    to_other = [c * (1 - s) for c, s in zip(counts, cshare)]
    xpos = np.arange(len(tier_names))
    ax[1].bar(xpos, to_contrib, label="To contributors (rep >= R*)", color="#4a8")
    ax[1].bar(xpos, to_other, bottom=to_contrib, label="To others", color="#aab")
    ax[1].set_xticks(xpos); ax[1].set_xticklabels(tier_names)
    ax[1].set_title("(b) Per-tier redemption (3 yr, T4 full portfolio)")
    ax[1].set_ylabel("Redemption count (mean)")
    ax[1].legend(fontsize=8)
    plt.tight_layout()
    fig_out_dir = os.environ.get(
        "FIG_OUT_DIR",
        "/Users/jason/Dev/jhfnetboy/DSR-Research-Flow/writing/paper7-CommunityFi/images",
    )
    os.makedirs(fig_out_dir, exist_ok=True)
    fig_p = os.path.join(fig_out_dir, "fig_abm_tiered.png")
    plt.savefig(fig_p, dpi=150); plt.close()
    print(f"\nwrote {os.path.normpath(fig_p)}")


if __name__ == "__main__":
    main()
