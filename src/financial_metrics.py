"""Traceable financial calculations used by Python reports and the dashboard."""

from __future__ import annotations

from typing import Final

import numpy as np
import pandas as pd

from src.config import REQUIRED_INPUT_COLUMNS


BUDGET: Final[str] = "Budget"
ACTUAL: Final[str] = "Actual"


def safe_divide(
    numerator: pd.Series | np.ndarray | float | int,
    denominator: pd.Series | np.ndarray | float | int,
) -> pd.Series | np.ndarray | float:
    """Divide while returning NaN for zero or missing denominators.

    The function deliberately does not convert undefined results to zero because
    a zero ratio would be a financial statement rather than a missing result.
    """

    if isinstance(numerator, pd.Series) or isinstance(denominator, pd.Series):
        numerator_series = (
            numerator
            if isinstance(numerator, pd.Series)
            else pd.Series(numerator, index=denominator.index)
        )
        denominator_series = (
            denominator
            if isinstance(denominator, pd.Series)
            else pd.Series(denominator, index=numerator_series.index)
        )
        denominator_series = denominator_series.where(denominator_series.ne(0))
        return numerator_series.div(denominator_series)

    numerator_array = np.asarray(numerator, dtype=float)
    denominator_array = np.asarray(denominator, dtype=float)
    result = np.full(np.broadcast(numerator_array, denominator_array).shape, np.nan)
    np.divide(
        numerator_array,
        denominator_array,
        out=result,
        where=np.isfinite(denominator_array) & (denominator_array != 0),
    )
    if result.ndim == 0:
        return float(result)
    return result


def _check_columns(frame: pd.DataFrame, required: tuple[str, ...]) -> None:
    missing = sorted(set(required).difference(frame.columns))
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")


def calculate_financial_metrics(frame: pd.DataFrame) -> pd.DataFrame:
    """Calculate row-level budget, actual, profitability, and variance metrics.

    Input rows must represent one month/product-line combination. Cost driver
    columns are unit costs; generated cost columns are total costs.
    """

    _check_columns(frame, REQUIRED_INPUT_COLUMNS)
    result = frame.copy()

    for scenario in (BUDGET, ACTUAL):
        volume = result[f"{scenario} Sales Volume"]
        unit_price = result[f"{scenario} Unit Price"]

        result[f"{scenario} Revenue"] = volume * unit_price

        component_unit_columns = [
            f"{scenario} Material Unit Cost",
            f"{scenario} Labor Unit Cost",
            f"{scenario} Overhead Unit Cost",
        ]
        result[f"{scenario} Unit COGS"] = result[component_unit_columns].sum(
            axis=1, min_count=len(component_unit_columns)
        )

        result[f"{scenario} Material Cost"] = (
            volume * result[f"{scenario} Material Unit Cost"]
        )
        result[f"{scenario} Labor Cost"] = (
            volume * result[f"{scenario} Labor Unit Cost"]
        )
        result[f"{scenario} Manufacturing Overhead"] = (
            volume * result[f"{scenario} Overhead Unit Cost"]
        )

        component_total_columns = [
            f"{scenario} Material Cost",
            f"{scenario} Labor Cost",
            f"{scenario} Manufacturing Overhead",
        ]
        result[f"{scenario} COGS"] = result[component_total_columns].sum(
            axis=1, min_count=len(component_total_columns)
        )
        result[f"{scenario} Gross Profit"] = (
            result[f"{scenario} Revenue"] - result[f"{scenario} COGS"]
        )
        result[f"{scenario} Gross Margin"] = safe_divide(
            result[f"{scenario} Gross Profit"], result[f"{scenario} Revenue"]
        )

    variance_pairs = {
        "Sales Volume Variance": ("Actual Sales Volume", "Budget Sales Volume"),
        "Revenue Variance": ("Actual Revenue", "Budget Revenue"),
        "COGS Variance": ("Actual COGS", "Budget COGS"),
        "Gross Profit Variance": ("Actual Gross Profit", "Budget Gross Profit"),
    }
    for output_column, (actual_column, budget_column) in variance_pairs.items():
        result[output_column] = result[actual_column] - result[budget_column]
        result[f"{output_column} %"] = safe_divide(
            result[output_column], result[budget_column].abs()
        )

    result["Gross Margin Variance (pp)"] = (
        result["Actual Gross Margin"] - result["Budget Gross Margin"]
    ) * 100

    result["Revenue Volume Effect"] = (
        result["Actual Sales Volume"] - result["Budget Sales Volume"]
    ) * result["Budget Unit Price"]
    result["Revenue Price Effect"] = result["Actual Sales Volume"] * (
        result["Actual Unit Price"] - result["Budget Unit Price"]
    )

    return result


def aggregate_financials(
    frame: pd.DataFrame, group_by: list[str] | tuple[str, ...]
) -> pd.DataFrame:
    """Aggregate additive metrics and recompute ratios from aggregated values."""

    additive_columns = [
        column
        for column in (
            "Budget Sales Volume",
            "Actual Sales Volume",
            "Budget Revenue",
            "Actual Revenue",
            "Budget Material Cost",
            "Actual Material Cost",
            "Budget Labor Cost",
            "Actual Labor Cost",
            "Budget Manufacturing Overhead",
            "Actual Manufacturing Overhead",
            "Budget COGS",
            "Actual COGS",
            "Budget Gross Profit",
            "Actual Gross Profit",
            "Revenue Volume Effect",
            "Revenue Price Effect",
        )
        if column in frame.columns
    ]
    grouped = (
        frame.groupby(list(group_by), dropna=False, observed=True)[additive_columns]
        .sum(min_count=1)
        .reset_index()
    )

    grouped["Revenue Variance"] = grouped["Actual Revenue"] - grouped["Budget Revenue"]
    grouped["Revenue Variance %"] = safe_divide(
        grouped["Revenue Variance"], grouped["Budget Revenue"].abs()
    )
    grouped["COGS Variance"] = grouped["Actual COGS"] - grouped["Budget COGS"]
    grouped["COGS Variance %"] = safe_divide(
        grouped["COGS Variance"], grouped["Budget COGS"].abs()
    )
    grouped["Gross Profit Variance"] = (
        grouped["Actual Gross Profit"] - grouped["Budget Gross Profit"]
    )
    grouped["Gross Profit Variance %"] = safe_divide(
        grouped["Gross Profit Variance"], grouped["Budget Gross Profit"].abs()
    )
    grouped["Budget Gross Margin"] = safe_divide(
        grouped["Budget Gross Profit"], grouped["Budget Revenue"]
    )
    grouped["Actual Gross Margin"] = safe_divide(
        grouped["Actual Gross Profit"], grouped["Actual Revenue"]
    )
    grouped["Gross Margin Variance (pp)"] = (
        grouped["Actual Gross Margin"] - grouped["Budget Gross Margin"]
    ) * 100
    return grouped


def _profit_bridge_product_base(frame: pd.DataFrame) -> pd.DataFrame:
    """Return product-level totals and unit economics used by both bridges."""

    required = (
        "Product Line",
        "Budget Sales Volume",
        "Actual Sales Volume",
        "Budget Revenue",
        "Actual Revenue",
        "Budget COGS",
        "Actual COGS",
        "Budget Gross Profit",
        "Actual Gross Profit",
    )
    _check_columns(frame, required)

    product = (
        frame.groupby("Product Line", observed=True)[list(required[1:])]
        .sum(min_count=1)
        .reset_index()
    )
    product["Budget Unit Gross Profit"] = safe_divide(
        product["Budget Gross Profit"], product["Budget Sales Volume"]
    )
    product["Budget Unit Price"] = safe_divide(
        product["Budget Revenue"], product["Budget Sales Volume"]
    )
    product["Actual Unit Price"] = safe_divide(
        product["Actual Revenue"], product["Actual Sales Volume"]
    )
    product["Budget Unit COGS"] = safe_divide(
        product["Budget COGS"], product["Budget Sales Volume"]
    )
    product["Actual Unit COGS"] = safe_divide(
        product["Actual COGS"], product["Actual Sales Volume"]
    )
    return product


def calculate_profit_bridge(frame: pd.DataFrame) -> pd.DataFrame:
    """Create an exact product-line volume/price/unit-cost bridge.

    Product mix is a portfolio concept, so it is not assigned to an individual
    product line. Each product row reconciles independently using its own
    volume, selling-price, and unit-cost effects.
    """

    product = _profit_bridge_product_base(frame)

    product["Volume Effect"] = (
        product["Actual Sales Volume"] - product["Budget Sales Volume"]
    ) * product["Budget Unit Gross Profit"]
    product["Mix Effect"] = np.nan
    product["Price Effect"] = product["Actual Sales Volume"] * (
        product["Actual Unit Price"] - product["Budget Unit Price"]
    )
    product["Unit Cost Effect"] = -product["Actual Sales Volume"] * (
        product["Actual Unit COGS"] - product["Budget Unit COGS"]
    )
    product["Explained Gross Profit Variance"] = product[
        ["Volume Effect", "Price Effect", "Unit Cost Effect"]
    ].sum(axis=1, min_count=3)
    product["Gross Profit Variance"] = (
        product["Actual Gross Profit"] - product["Budget Gross Profit"]
    )
    product["Reconciliation Difference"] = (
        product["Explained Gross Profit Variance"]
        - product["Gross Profit Variance"]
    )
    product["Analysis Level"] = "Product Line"
    product["Scope Note"] = (
        "Product mix is not applicable to a single product line; "
        "volume, price and unit-cost effects reconcile independently."
    )
    return product


def calculate_company_profit_bridge(frame: pd.DataFrame) -> pd.DataFrame:
    """Create the exact company volume/mix/price/unit-cost portfolio bridge."""

    product = _profit_bridge_product_base(frame)
    budget_total_volume = product["Budget Sales Volume"].sum(min_count=1)
    actual_total_volume = product["Actual Sales Volume"].sum(min_count=1)

    product["Budget Mix"] = safe_divide(
        product["Budget Sales Volume"], budget_total_volume
    )
    product["Actual Mix"] = safe_divide(
        product["Actual Sales Volume"], actual_total_volume
    )

    weighted_budget_unit_gp = (
        product["Budget Mix"] * product["Budget Unit Gross Profit"]
    ).sum(min_count=1)
    total_volume_effect = (
        actual_total_volume - budget_total_volume
    ) * weighted_budget_unit_gp

    mix_effect = (
        actual_total_volume
        * (product["Actual Mix"] - product["Budget Mix"])
        * product["Budget Unit Gross Profit"]
    ).sum(min_count=1)
    price_effect = (
        product["Actual Sales Volume"]
        * (product["Actual Unit Price"] - product["Budget Unit Price"])
    ).sum(min_count=1)
    unit_cost_effect = (
        -product["Actual Sales Volume"]
        * (product["Actual Unit COGS"] - product["Budget Unit COGS"])
    ).sum(min_count=1)
    gross_profit_variance = (
        product["Actual Gross Profit"].sum(min_count=1)
        - product["Budget Gross Profit"].sum(min_count=1)
    )
    explained = total_volume_effect + mix_effect + price_effect + unit_cost_effect

    return pd.DataFrame(
        [
            {
                "Analysis Level": "Company",
                "Product Line": "All Product Lines",
                "Budget Sales Volume": budget_total_volume,
                "Actual Sales Volume": actual_total_volume,
                "Budget Revenue": product["Budget Revenue"].sum(min_count=1),
                "Actual Revenue": product["Actual Revenue"].sum(min_count=1),
                "Budget COGS": product["Budget COGS"].sum(min_count=1),
                "Actual COGS": product["Actual COGS"].sum(min_count=1),
                "Budget Gross Profit": product["Budget Gross Profit"].sum(
                    min_count=1
                ),
                "Actual Gross Profit": product["Actual Gross Profit"].sum(
                    min_count=1
                ),
                "Volume Effect": total_volume_effect,
                "Mix Effect": mix_effect,
                "Price Effect": price_effect,
                "Unit Cost Effect": unit_cost_effect,
                "Explained Gross Profit Variance": explained,
                "Gross Profit Variance": gross_profit_variance,
                "Reconciliation Difference": explained - gross_profit_variance,
                "Scope Note": (
                    "Company portfolio bridge; mix is measured across product lines."
                ),
            }
        ]
    )
