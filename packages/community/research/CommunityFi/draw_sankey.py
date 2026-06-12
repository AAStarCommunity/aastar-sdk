#!/usr/bin/env python3
"""
Sankey visualization of how a finite community budget flows through the
4-tier redemption portfolio (T4) into contributor vs non-contributor pockets,
under the full A3 (gasless + redeemable + identity-gated) mechanism.

Uses the per-tier spend and per-tier contributor-share recorded in
communityfi_abm_tier_breakdown.csv (3-year totals, mean over 20 community
draws). Renders to <paper_repo>/images/fig_abm_sankey.png at 300 dpi.

Run: python3 draw_sankey.py [OUT_PATH]
Requires: matplotlib (no plotly).
"""
import os, sys, csv
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, PathPatch
from matplotlib.path import Path

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "communityfi_abm_tier_breakdown.csv")

DEFAULT_OUT = "/Users/jason/Dev/jhfnetboy/DSR-Research-Flow/writing/paper7-CommunityFi/images/fig_abm_sankey.png"
OUT = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT

rows = [r for r in csv.DictReader(open(SRC)) if r["ladder"] == "T4 +conference"]
order = ["snack", "merch", "venue", "conference"]
tiers = {r["tier"]: (float(r["spend_mean"]), float(r["contrib_share_mean"])) for r in rows}
total = sum(s for s, _ in tiers.values())
shares = {t: s / total for t, (s, _) in tiers.items()}

COL = {
    "budget": "#caa23a",
    "snack": "#6bb6c8",
    "merch": "#7c9ec3",
    "venue": "#a37cc3",
    "conference": "#c45c8a",
    "contrib": "#4a8c5c",
    "other": "#8a90a3",
}

fig, ax = plt.subplots(figsize=(11, 6.2))
ax.set_xlim(0, 12); ax.set_ylim(0, 10); ax.axis("off")

LEFT_X = 1.0; LEFT_W = 0.7
TIER_X = 5.0; TIER_W = 0.7
RIGHT_X = 10.0; RIGHT_W = 0.7
TOTAL_H = 8.0; PAD = 0.15

ax.add_patch(Rectangle((LEFT_X, 1.0), LEFT_W, TOTAL_H, color=COL["budget"], alpha=0.95))
ax.text(LEFT_X + LEFT_W / 2, 9.4, "Community budget\n(redemption pool)",
        ha="center", va="bottom", fontsize=10, fontweight="bold")
ax.text(LEFT_X + LEFT_W / 2, 5.0, "100%",
        ha="center", va="center", fontsize=11, color="white", fontweight="bold", rotation=90)

y = 1.0
tier_geom = {}
for t in order:
    h = shares[t] * TOTAL_H
    ax.add_patch(Rectangle((TIER_X, y), TIER_W, h, color=COL[t], alpha=0.92))
    pct = 100 * shares[t]
    ax.text(TIER_X + TIER_W / 2, y + h / 2, f"{t}\n{pct:.0f}%",
            ha="center", va="center", fontsize=9, fontweight="bold", color="white")
    tier_geom[t] = (y, h)
    y += h + PAD

contrib_total = sum(tiers[t][0] * tiers[t][1] for t in order)
contrib_share = contrib_total / total
contrib_h = contrib_share * TOTAL_H
other_h = (1 - contrib_share) * TOTAL_H

ax.add_patch(Rectangle((RIGHT_X, 1.0 + other_h + PAD), RIGHT_W, contrib_h,
                       color=COL["contrib"], alpha=0.93))
ax.text(RIGHT_X + RIGHT_W / 2, 1.0 + other_h + PAD + contrib_h / 2,
        f"Contributors\n(rep $\\geq R^*$)\n{100 * contrib_share:.0f}%",
        ha="center", va="center", fontsize=10, fontweight="bold", color="white")

ax.add_patch(Rectangle((RIGHT_X, 1.0), RIGHT_W, other_h, color=COL["other"], alpha=0.9))
ax.text(RIGHT_X + RIGHT_W / 2, 1.0 + other_h / 2,
        f"Others\n{100 * (1 - contrib_share):.0f}%",
        ha="center", va="center", fontsize=10, fontweight="bold", color="white")


def ribbon(x0, y0, h0, x1, y1, h1, color, alpha=0.45):
    mid = (x0 + x1) / 2
    verts = [(x0, y0 + h0), (mid, y0 + h0), (mid, y1 + h1), (x1, y1 + h1),
             (x1, y1), (mid, y1), (mid, y0), (x0, y0), (x0, y0 + h0)]
    codes = [Path.MOVETO, Path.CURVE4, Path.CURVE4, Path.LINETO,
             Path.LINETO, Path.CURVE4, Path.CURVE4, Path.LINETO, Path.CLOSEPOLY]
    ax.add_patch(PathPatch(Path(verts, codes), facecolor=color, edgecolor="none", alpha=alpha))


budget_cursor = 1.0
for t in order:
    h = shares[t] * TOTAL_H
    y0_tier, h_tier = tier_geom[t]
    ribbon(LEFT_X + LEFT_W, budget_cursor, h, TIER_X, y0_tier, h_tier, COL[t])
    budget_cursor += h

contrib_cursor = 1.0 + other_h + PAD
other_cursor = 1.0
for t in order:
    y0_tier, h_tier = tier_geom[t]
    share = tiers[t][1]
    h_to_contrib = h_tier * share
    h_to_other = h_tier * (1 - share)
    ribbon(TIER_X + TIER_W, y0_tier + h_to_other, h_to_contrib,
           RIGHT_X, contrib_cursor, h_to_contrib, COL["contrib"])
    contrib_cursor += h_to_contrib
    ribbon(TIER_X + TIER_W, y0_tier, h_to_other,
           RIGHT_X, other_cursor, h_to_other, COL["other"])
    other_cursor += h_to_other

ax.set_title("Budget flow under the full T4 portfolio (3-year totals, mean over 20 draws)",
             fontsize=11, fontweight="bold")
ax.text(6.0, 0.4,
        "Per-tier contributor share: snack ~38%, merch ~33%, venue ~71%, conference 100%   |   "
        "Overall: ~82% of the budget reaches contributors.",
        ha="center", va="center", fontsize=8.5, color="#444")

plt.tight_layout(pad=0.5)
fig.savefig(OUT, dpi=300, bbox_inches="tight", facecolor="white")
print("wrote", OUT)
