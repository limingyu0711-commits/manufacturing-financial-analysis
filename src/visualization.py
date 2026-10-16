"""Static Matplotlib visuals for report review and portfolio documentation."""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd


BRAND_BLUE = "#163A5F"
ACCENT_BLUE = "#2F75B5"
ACCENT_ORANGE = "#D9792B"
ACCENT_TEAL = "#2A7F76"
GRID = "#D9E1E8"


def _style_axes(axis: plt.Axes) -> None:
    axis.spines[["top", "right"]].set_visible(False)
    axis.grid(axis="y", color=GRID, linewidth=0.7, alpha=0.8)
    axis.set_axisbelow(True)


def create_static_charts(
    monthly: pd.DataFrame,
    product: pd.DataFrame,
    cost: pd.DataFrame,
    output_dir: Path,
) -> list[Path]:
    """Create three compact, presentation-ready PNG charts."""

    output_dir.mkdir(parents=True, exist_ok=True)
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10})
    outputs: list[Path] = []

    fig, axis = plt.subplots(figsize=(10, 5.2))
    x = range(len(monthly))
    axis.plot(x, monthly["Budget Revenue"] / 1_000_000, label="Budget", color=ACCENT_BLUE, linewidth=2)
    axis.plot(x, monthly["Actual Revenue"] / 1_000_000, label="Actual", color=ACCENT_ORANGE, linewidth=2.4)
    axis.set_xticks(list(x), [month[-2:] for month in monthly["Month"]])
    axis.set_xlabel("Month in 2025")
    axis.set_ylabel("Revenue (EUR m)")
    axis.set_title("Monthly Revenue: Budget vs Actual", loc="left", color=BRAND_BLUE, fontweight="bold")
    axis.legend(frameon=False, ncol=2, loc="upper left")
    _style_axes(axis)
    fig.tight_layout()
    path = output_dir / "monthly_revenue.png"
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    outputs.append(path)

    plot_product = product.sort_values("Actual Gross Margin")
    fig, axis = plt.subplots(figsize=(10, 5.2))
    axis.barh(plot_product["Product Line"], plot_product["Actual Gross Margin"] * 100, color=ACCENT_TEAL)
    axis.set_xlabel("Actual Gross Margin (%)")
    axis.set_title("Profitability by Product Line", loc="left", color=BRAND_BLUE, fontweight="bold")
    axis.xaxis.set_major_formatter(lambda value, _: f"{value:.0f}%")
    _style_axes(axis)
    fig.tight_layout()
    path = output_dir / "product_profitability.png"
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    outputs.append(path)

    fig, axis = plt.subplots(figsize=(8, 5.2))
    axis.bar(cost["Cost Category"], cost["Actual Cost"] / 1_000_000, color=[ACCENT_BLUE, ACCENT_ORANGE, ACCENT_TEAL])
    axis.set_ylabel("Actual Cost (EUR m)")
    axis.set_title("Actual COGS Breakdown", loc="left", color=BRAND_BLUE, fontweight="bold")
    axis.tick_params(axis="x", rotation=10)
    _style_axes(axis)
    fig.tight_layout()
    path = output_dir / "cost_breakdown.png"
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    outputs.append(path)

    return outputs

