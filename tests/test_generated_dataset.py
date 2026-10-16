from __future__ import annotations

import unittest

import numpy as np

from src.analysis import (
    build_company_summary,
    build_cost_breakdown,
    build_monthly_analysis,
    build_product_analysis,
    build_profit_bridge,
)
from src.config import MONTHS, PRODUCT_LINES
from src.generate_data import generate_synthetic_data
from src.validation import validate_input_data


class GeneratedDatasetTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.data = generate_synthetic_data()

    def test_complete_population_and_unique_grain(self) -> None:
        self.assertEqual(len(self.data), len(MONTHS) * len(PRODUCT_LINES))
        self.assertFalse(self.data.duplicated(["Month", "Product Line"]).any())

    def test_generated_inputs_pass_validation(self) -> None:
        issues = validate_input_data(self.data)
        self.assertFalse([issue for issue in issues if issue.severity == "ERROR"])

    def test_all_primary_financial_identities(self) -> None:
        for scenario in ("Budget", "Actual"):
            self.assertTrue(
                np.allclose(
                    self.data[f"{scenario} Revenue"],
                    self.data[f"{scenario} Sales Volume"]
                    * self.data[f"{scenario} Unit Price"],
                )
            )
            self.assertTrue(
                np.allclose(
                    self.data[f"{scenario} COGS"],
                    self.data[f"{scenario} Material Cost"]
                    + self.data[f"{scenario} Labor Cost"]
                    + self.data[f"{scenario} Manufacturing Overhead"],
                )
            )
            self.assertTrue(
                np.allclose(
                    self.data[f"{scenario} Gross Profit"],
                    self.data[f"{scenario} Revenue"] - self.data[f"{scenario} COGS"],
                )
            )

    def test_reports_reconcile_to_source(self) -> None:
        monthly = build_monthly_analysis(self.data)
        product = build_product_analysis(self.data)
        self.assertTrue(
            np.isclose(monthly["Actual Revenue"].sum(), self.data["Actual Revenue"].sum())
        )
        self.assertTrue(
            np.isclose(product["Actual COGS"].sum(), self.data["Actual COGS"].sum())
        )

    def test_cost_breakdown_has_no_double_counting(self) -> None:
        cost = build_cost_breakdown(self.data)
        self.assertTrue(
            np.isclose(cost["Actual Cost"].sum(), self.data["Actual COGS"].sum())
        )

    def test_profit_bridge_reconciles(self) -> None:
        bridge = build_profit_bridge(self.data)
        company = bridge.loc[bridge["Analysis Level"].eq("Company")]
        products = bridge.loc[bridge["Analysis Level"].eq("Product Line")]
        self.assertEqual(len(company), 1)
        self.assertEqual(len(products), len(PRODUCT_LINES))
        self.assertTrue(
            np.isclose(
                company.iloc[0]["Explained Gross Profit Variance"],
                self.data["Actual Gross Profit"].sum()
                - self.data["Budget Gross Profit"].sum(),
            )
        )
        self.assertTrue(
            np.allclose(
                bridge["Explained Gross Profit Variance"],
                bridge["Gross Profit Variance"],
            )
        )
        self.assertTrue(products["Mix Effect"].isna().all())

    def test_company_summary_contains_controlled_metrics(self) -> None:
        summary = build_company_summary(self.data)
        self.assertEqual(
            summary["Metric"].tolist(),
            ["Revenue", "COGS", "Gross Profit", "Gross Margin"],
        )


if __name__ == "__main__":
    unittest.main()
