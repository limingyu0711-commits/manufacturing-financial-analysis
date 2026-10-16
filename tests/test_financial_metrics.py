from __future__ import annotations

import unittest

import numpy as np
import pandas as pd

from src.financial_metrics import (
    aggregate_financials,
    calculate_company_profit_bridge,
    calculate_financial_metrics,
    calculate_profit_bridge,
    safe_divide,
)
from tests.helpers import make_driver_frame


class FinancialMetricsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.driver_frame = make_driver_frame()

    def test_row_level_formulas(self) -> None:
        result = calculate_financial_metrics(self.driver_frame)

        self.assertTrue(
            np.allclose(
                result["Actual Revenue"],
                result["Actual Sales Volume"] * result["Actual Unit Price"],
            )
        )
        self.assertTrue(
            np.allclose(
                result["Actual COGS"],
                result["Actual Material Cost"]
                + result["Actual Labor Cost"]
                + result["Actual Manufacturing Overhead"],
            )
        )
        self.assertTrue(
            np.allclose(
                result["Actual Gross Profit"],
                result["Actual Revenue"] - result["Actual COGS"],
            )
        )
        self.assertTrue(
            np.allclose(
                result["Actual Gross Margin"],
                result["Actual Gross Profit"] / result["Actual Revenue"],
            )
        )

    def test_revenue_bridge_reconciles(self) -> None:
        result = calculate_financial_metrics(self.driver_frame)
        explained = result["Revenue Volume Effect"] + result["Revenue Price Effect"]
        self.assertTrue(np.allclose(explained, result["Revenue Variance"]))

    def test_aggregation_recomputes_margin(self) -> None:
        result = calculate_financial_metrics(self.driver_frame)
        grouped = aggregate_financials(result, ["Month"])

        expected = result["Actual Gross Profit"].sum() / result["Actual Revenue"].sum()
        self.assertTrue(np.isclose(grouped.loc[0, "Actual Gross Margin"], expected))

    def test_profit_bridge_reconciles(self) -> None:
        result = calculate_financial_metrics(self.driver_frame)
        bridge = calculate_profit_bridge(result)

        self.assertTrue(
            np.isclose(
                bridge["Explained Gross Profit Variance"].sum(),
                bridge["Gross Profit Variance"].sum(),
            )
        )
        self.assertTrue(
            np.allclose(
                bridge["Explained Gross Profit Variance"],
                bridge["Gross Profit Variance"],
            )
        )
        self.assertTrue(bridge["Mix Effect"].isna().all())

    def test_company_profit_bridge_includes_mix_and_reconciles(self) -> None:
        result = calculate_financial_metrics(self.driver_frame)
        bridge = calculate_company_profit_bridge(result)

        self.assertEqual(bridge.loc[0, "Analysis Level"], "Company")
        self.assertTrue(np.isfinite(bridge.loc[0, "Mix Effect"]))
        self.assertTrue(
            np.isclose(
                bridge.loc[0, "Explained Gross Profit Variance"],
                bridge.loc[0, "Gross Profit Variance"],
            )
        )

    def test_safe_divide_returns_nan_for_zero_denominator(self) -> None:
        result = safe_divide(pd.Series([10.0, 5.0]), pd.Series([0.0, 2.0]))
        self.assertTrue(np.isnan(result.iloc[0]))
        self.assertEqual(result.iloc[1], 2.5)

    def test_zero_revenue_and_budget_produce_undefined_ratios_not_infinity(self) -> None:
        zero_case = self.driver_frame.iloc[[0]].copy()
        zero_case["Budget Sales Volume"] = 0
        zero_case["Actual Sales Volume"] = 0
        result = calculate_financial_metrics(zero_case)

        self.assertTrue(np.isnan(result.loc[result.index[0], "Budget Gross Margin"]))
        self.assertTrue(np.isnan(result.loc[result.index[0], "Actual Gross Margin"]))
        self.assertTrue(np.isnan(result.loc[result.index[0], "Revenue Variance %"]))
        numeric = result.select_dtypes(include="number").to_numpy(dtype=float)
        self.assertFalse(np.isinf(numeric).any())

    def test_missing_cost_driver_propagates_instead_of_silent_imputation(self) -> None:
        missing_case = self.driver_frame.iloc[[0]].copy()
        missing_case.loc[missing_case.index[0], "Actual Material Unit Cost"] = np.nan
        result = calculate_financial_metrics(missing_case)

        self.assertTrue(np.isnan(result.iloc[0]["Actual Unit COGS"]))
        self.assertTrue(np.isnan(result.iloc[0]["Actual COGS"]))
        self.assertTrue(np.isnan(result.iloc[0]["Actual Gross Profit"]))

    def test_margin_variance_is_percentage_points(self) -> None:
        result = calculate_financial_metrics(self.driver_frame)
        expected = (
            result["Actual Gross Margin"] - result["Budget Gross Margin"]
        ) * 100
        self.assertTrue(np.allclose(result["Gross Margin Variance (pp)"], expected))


if __name__ == "__main__":
    unittest.main()
