#!/usr/bin/env python3
"""
CommunityFi — Incentive-Compatibility & Sybil-Resistance Simulation
===================================================================

Parameterised economic analysis (upgrades Section 5.2.6 from analytical-only
to a quantitative, reproducible result). It evaluates three security
questions for the reputation-backed credit mechanism:

  (1) Collusion safety   : Under what credit cap is corrupting a DVT
                           supermajority unprofitable for an attacker?
  (2) Sybil unprofitability : Is large-scale Sybil credit-drain net-negative
                           once stake + lock costs are charged?
  (3) Collusion probability : How does decentralisation (validator count N)
                           drive down the probability of a successful
                           >=2/3 collusion under a per-guardian honesty rate?

Model (deliberately conservative — favours the attacker):
  - Threshold m = ceil(2/3 N) honest guardians required for a valid update.
  - To forge a reputation update an attacker must corrupt >= m guardians.
  - A rational guardian accepts a bribe only above its expected loss
    rho * S_op (stake slashed with detection probability rho), so the
    attacker's lower-bound corruption cost is  m * rho * S_op.
  - Forged reputation is monetised by drawing the maximum credit C_max and
    defaulting (never settling). Net collusion profit:
        Pi_collude = C_max - m * rho * S_op
    => Incentive-compatible (attack unprofitable) iff
        C_max < m * rho * S_op  =  ceil(2/3 N) * rho * S_op
  - Sybil path (no collusion): credit is NOT free — it requires DVT-attested
    reputation R, which an honest DVT grants only for genuine work. To draw
    credit C(R) an attacker must therefore produce attested contributions
    whose effort-cost is e per unit. The credit map C(R) is SUB-LINEAR
    (diminishing returns), while effort cost e*R is linear, so the
    genuine-work drain profit
        Pi_work(R) = C(R)*usd_per_tx - e*R - stake_usd
    is bounded and turns negative beyond a reputation threshold. The binding
    assumption is attestation quality: e must exceed the credit value granted
    per contribution. We sweep e to expose this threshold.
  - Token price converts GToken stake and credit (gas units) to a common
    unit (USD) so the comparison is meaningful.

All numbers are parameterised; defaults follow the paper's configuration
(S_op=50 GTokens, S_user=0.3 GTokens). Outputs: a 3-panel figure and a
machine-readable results table (CSV + console).

Run:  python3 incentive_sim.py
"""
import csv
import math
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

rng = np.random.default_rng(20260526)

# ----------------------------------------------------------------------------
# Default parameters (paper configuration)
# ----------------------------------------------------------------------------
P = {
    "S_op_gtoken": 50.0,        # operator/guardian min stake (GToken)
    "S_user_gtoken": 0.3,       # end-user min stake (GToken)
    "gtoken_usd": 0.15,         # GToken price (USD) — matches GToken model
    "rho": 0.8,                 # slash/detection probability for collusion
    "r_lock": 0.10,             # annual opportunity cost of locked stake
    "T_lock_years": 0.25,       # stake lock duration (years) ~ 3 months
    "gas_per_tx": 167830,       # measured credit-mode gas (Exp 5, T2.1)
    "gas_price_gwei": 0.01,     # OP Mainnet typical L2 gas price (gwei)
    "eth_usd": 3000.0,          # ETH price (USD) for gas->USD conversion
    "C_max_tx": 400,            # max credit at saturation (sponsored tx)
    "R_half": 50,               # reputation at half-saturation (sub-linear)
}

def usd_per_tx(p=P):
    """USD value of one sponsored transaction's gas (what a defaulter steals)."""
    eth = p["gas_per_tx"] * p["gas_price_gwei"] * 1e-9
    return eth * p["eth_usd"]

def threshold(N):
    return math.ceil(2.0 * N / 3.0)

# ----------------------------------------------------------------------------
# (1) Collusion safety: maximum incentive-compatible credit cap C_max (USD)
# ----------------------------------------------------------------------------
def max_safe_credit_usd(N, S_op_gtoken, rho, p=P):
    """C_max must stay below m * rho * S_op (in USD) for collusion to be
    unprofitable."""
    m = threshold(N)
    return m * rho * S_op_gtoken * p["gtoken_usd"]

# ----------------------------------------------------------------------------
# (2) Genuine-work Sybil: credit is gated by attested reputation R.
#     Sub-linear credit map C(R); linear effort cost e*R. Drain profit bounded.
# ----------------------------------------------------------------------------
def credit_tx(R, p=P):
    """Sub-linear (saturating) credit map: C(R) = C_max * R/(R + R_half)."""
    return p["C_max_tx"] * R / (R + p["R_half"])

def work_drain_profit_usd(R, e_usd_per_contrib, p=P):
    """Attacker profit from earning reputation R via attested work then
    defaulting on the drawn credit."""
    extracted = credit_tx(R, p) * usd_per_tx(p)
    stake_usd = p["S_user_gtoken"] * p["gtoken_usd"]
    return extracted - e_usd_per_contrib * R - stake_usd

# ----------------------------------------------------------------------------
# (3) Monte Carlo: probability a >=2/3 collusion is *available* to an attacker
#     given each guardian independently corruptible w.p. (1 - h)
# ----------------------------------------------------------------------------
def collusion_probability(N, h, trials=200000):
    m = threshold(N)
    corrupt = rng.binomial(N, 1.0 - h, size=trials)
    return float(np.mean(corrupt >= m))

# ----------------------------------------------------------------------------
# Run analyses + figure
# ----------------------------------------------------------------------------
def main():
    here = os.path.dirname(os.path.abspath(__file__))
    img_dir = os.path.normpath(os.path.join(here, "..", "images"))
    os.makedirs(img_dir, exist_ok=True)

    tx_usd = usd_per_tx()
    Ns = np.arange(4, 205, 2)

    # (1) safe credit cap curves for three stake levels
    fig, ax = plt.subplots(1, 3, figsize=(16, 4.4))
    for S_op in (10.0, 50.0, 100.0):
        cap = [max_safe_credit_usd(n, S_op, P["rho"]) for n in Ns]
        ax[0].plot(Ns, cap, label=f"S_op = {S_op:.0f} GToken")
    ax[0].set_xlabel("Validator count N")
    ax[0].set_ylabel("Max incentive-compatible credit cap (USD)")
    ax[0].set_title("(a) Collusion-safe credit ceiling\n$C_{max} < \\lceil 2N/3 \\rceil\\,\\rho\\,S_{op}$")
    ax[0].legend(); ax[0].grid(True, alpha=0.3)

    # (2) Genuine-work drain profit vs reputation R, swept over effort cost e
    Rs = np.arange(1, 301, 2)
    for e in (0.001, 0.005, 0.02):
        prof = [work_drain_profit_usd(R, e) for R in Rs]
        ax[1].plot(Rs, prof, label=f"effort e = ${e:.3f}/contrib")
    ax[1].axhline(0, color="k", lw=0.8)
    ax[1].set_xlabel("Attested reputation R (verified contributions)")
    ax[1].set_ylabel("Genuine-work drain profit (USD)")
    ax[1].set_title("(b) Sub-linear credit bounds work-drain\n"
                    "$C(R)=C_{max}R/(R{+}R_{half})$; profit < 0 once "
                    "$e \\geq$ credit/contrib")
    ax[1].legend(); ax[1].grid(True, alpha=0.3)

    # (3) Monte Carlo collusion probability vs N for honesty levels
    mc_rows = []
    for h in (0.70, 0.80, 0.90):
        probs = [collusion_probability(int(n), h) for n in Ns]
        ax[2].semilogy(Ns, np.clip(probs, 1e-7, 1), label=f"honesty h = {h:.2f}")
        for n in (7, 37, 100, 200):
            mc_rows.append((h, n, collusion_probability(n, h)))
    ax[2].set_xlabel("Validator count N")
    ax[2].set_ylabel("P(>=2/3 corruptible)  [log]")
    ax[2].set_title("(c) Collusion availability vs decentralisation")
    ax[2].legend(); ax[2].grid(True, alpha=0.3, which="both")

    fig.tight_layout()
    out_png = os.path.join(img_dir, "fig_incentive_compatibility.png")
    fig.savefig(out_png, dpi=300, bbox_inches="tight")
    print(f"[fig] wrote {out_png}")

    # ---- results table (CSV + console) ----
    table = []
    table.append(("usd_per_sponsored_tx", f"{tx_usd:.4e}", "USD value a defaulter steals per tx"))
    for N in (7, 37, 100, 200):
        cap = max_safe_credit_usd(N, P["S_op_gtoken"], P["rho"])
        table.append((f"safe_credit_cap_N{N}_USD", f"{cap:,.2f}",
                      f"max IC credit cap at N={N}, S_op=50, rho=0.8 "
                      f"(= {cap/tx_usd:,.0f} sponsored tx)"))
    # break-even effort: smallest e making max work-drain profit <= 0
    Rsweep = np.arange(1, 1001)
    for e in (0.001, 0.005, 0.02):
        maxprof = max(work_drain_profit_usd(R, e) for R in Rsweep)
        table.append((f"max_work_drain_profit_e{e:.3f}_USD", f"{maxprof:.4f}",
                      "max genuine-work drain profit over R (>0 => attack viable)"))
    for h, n, pr in mc_rows:
        table.append((f"collusion_prob_h{h:.2f}_N{n}", f"{pr:.2e}",
                      "Monte Carlo P(>=2/3 corruptible)"))

    out_csv = os.path.join(here, "incentive_sim_results.csv")
    with open(out_csv, "w", newline="") as f:
        w = csv.writer(f); w.writerow(("metric", "value", "note"))
        w.writerows(table)
    print(f"[csv] wrote {out_csv}\n")
    print(f"{'metric':40s} {'value':>16s}  note")
    for k, v, note in table:
        print(f"{k:40s} {v:>16s}  {note}")

if __name__ == "__main__":
    main()
