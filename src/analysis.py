"""Management-reporting summaries for the synthetic manufacturing dataset."""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.financial_metrics import (
    aggregate_financials,
    calculate_company_profit_bridge,
    calculate_profit_bridge,
    safe_divide,
)


def build_company_summary(frame: pd.DataFrame) -> pd.DataFrame:
    """Return annual company KPIs with a consistent variance convention."""

    metrics = [
        ("Revenue", "Budget Revenue", "Actual Revenue", "EUR", "Higher is favorable"),
        ("COGS", "Budget COGS", "Actual COGS", "EUR", "Higher is unfavorable"),
        (
            "Gross Profit",
            "Budget Gross Profit",
            "Actual Gross Profit",
            "EUR",
            "Higher is favorable",
        ),
    ]
    rows = []
    for metric, budget_column, actual_column, unit, interpretation in metrics:
        budget = frame[budget_column].sum(min_count=1)
        actual = frame[actual_column].sum(min_count=1)
        variance = actual - budget
        rows.append(
            {
                "Metric": metric,
                "Budget": budget,
                "Actual": actual,
                "Variance": variance,
                "Variance %": safe_divide(variance, abs(budget)),
                "Unit": unit,
                "Interpretation": interpretation,
            }
        )

    budget_revenue = frame["Budget Revenue"].sum(min_count=1)
    actual_revenue = frame["Actual Revenue"].sum(min_count=1)
    budget_gp = frame["Budget Gross Profit"].sum(min_count=1)
    actual_gp = frame["Actual Gross Profit"].sum(min_count=1)
    budget_margin = safe_divide(budget_gp, budget_revenue)
    actual_margin = safe_divide(actual_gp, actual_revenue)
    rows.append(
        {
            "Metric": "Gross Margin",
            "Budget": budget_margin,
            "Actual": actual_margin,
            "Variance": (actual_margin - budget_margin) * 100,
            "Variance %": np.nan,
            "Unit": "% / pp variance",
            "Interpretation": "Positive percentage-point variance is favorable",
        }
    )
    return pd.DataFrame(rows)


def build_monthly_analysis(frame: pd.DataFrame) -> pd.DataFrame:
    """Return monthly reporting metrics and actual revenue growth."""

    monthly = aggregate_financials(frame, ["Month"]).sort_values("Month")
    monthly["Actual Revenue Growth %"] = monthly["Actual Revenue"].pct_change(
        fill_method=None
    )
    monthly.loc[monthly["Actual Revenue"].shift(1).eq(0), "Actual Revenue Growth %"] = np.nan
    return monthly


def build_product_analysis(frame: pd.DataFrame) -> pd.DataFrame:
    """Return product-line profitability and cost composition."""

    product = aggregate_financials(frame, ["Product Line"])
    product["Actual Material Cost % of COGS"] = safe_divide(
        product["Actual Material Cost"], product["Actual COGS"]
    )
    product["Actual Labor Cost % of COGS"] = safe_divide(
        product["Actual Labor Cost"], product["Actual COGS"]
    )
    product["Actual Overhead % of COGS"] = safe_divide(
        product["Actual Manufacturing Overhead"], product["Actual COGS"]
    )
    product["Actual Revenue Mix %"] = safe_divide(
        product["Actual Revenue"], product["Actual Revenue"].sum(min_count=1)
    )
    return product.sort_values("Actual Revenue", ascending=False).reset_index(drop=True)


def build_cost_breakdown(frame: pd.DataFrame) -> pd.DataFrame:
    """Return actual and budget costs by category without double counting."""

    categories = [
        ("Material", "Budget Material Cost", "Actual Material Cost"),
        ("Labor", "Budget Labor Cost", "Actual Labor Cost"),
        (
            "Manufacturing Overhead",
            "Budget Manufacturing Overhead",
            "Actual Manufacturing Overhead",
        ),
    ]
    total_actual_cogs = frame["Actual COGS"].sum(min_count=1)
    rows = []
    for category, budget_column, actual_column in categories:
        budget = frame[budget_column].sum(min_count=1)
        actual = frame[actual_column].sum(min_count=1)
        rows.append(
            {
                "Cost Category": category,
                "Budget Cost": budget,
                "Actual Cost": actual,
                "Cost Variance": actual - budget,
                "Cost Variance %": safe_divide(actual - budget, abs(budget)),
                "Actual COGS Mix %": safe_divide(actual, total_actual_cogs),
                "Favorability": "Unfavorable" if actual > budget else "Favorable",
            }
        )
    return pd.DataFrame(rows)


def build_profit_bridge(frame: pd.DataFrame) -> pd.DataFrame:
    company = calculate_company_profit_bridge(frame)
    product = calculate_profit_bridge(frame)
    columns = company.columns.tolist()
    return pd.concat([company, product[columns]], ignore_index=True)
