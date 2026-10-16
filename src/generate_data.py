"""Generate reproducible synthetic operating drivers for the simulated company."""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.config import CONFIG, MONTHS
from src.financial_metrics import calculate_financial_metrics
from src.validation import assert_no_errors, validate_input_data


PRODUCT_ASSUMPTIONS = {
    "Electric Motor Components": {
        "base_volume": 10_500,
        "unit_price": 92.00,
        "material": 39.00,
        "labor": 14.50,
        "overhead": 12.50,
        "annual_volume_growth": 0.025,
        "actual_volume_bias": -0.012,
        "actual_price_bias": 0.006,
        "material_sensitivity": 1.00,
    },
    "Battery Management Components": {
        "base_volume": 6_500,
        "unit_price": 145.00,
        "material": 57.00,
        "labor": 19.00,
        "overhead": 16.00,
        "annual_volume_growth": 0.085,
        "actual_volume_bias": 0.035,
        "actual_price_bias": 0.010,
        "material_sensitivity": 1.15,
    },
    "Automotive Sensors": {
        "base_volume": 15_000,
        "unit_price": 48.00,
        "material": 17.00,
        "labor": 8.00,
        "overhead": 7.00,
        "annual_volume_growth": 0.012,
        "actual_volume_bias": -0.004,
        "actual_price_bias": -0.009,
        "material_sensitivity": 0.75,
    },
}

# Typical automotive seasonality: softer start and August shutdown, stronger Q4.
SEASONAL_VOLUME = np.array(
    [0.92, 0.95, 1.00, 1.03, 1.05, 1.06, 1.01, 0.88, 1.02, 1.08, 1.10, 1.06]
)

# Temporary raw-material inflation concentrated in the middle of the year.
MATERIAL_MARKET_SHOCK = np.array(
    [0.000, 0.004, 0.012, 0.025, 0.039, 0.050, 0.045, 0.034, 0.024, 0.015, 0.008, 0.003]
)


def generate_synthetic_data(seed: int = CONFIG.random_seed) -> pd.DataFrame:
    """Return the complete 2025 month/product-line dataset.

    Random variation is deliberately small and seeded. Structural patterns are
    explicit so the resulting analysis remains explainable rather than random.
    """

    rng = np.random.default_rng(seed)
    rows: list[dict[str, object]] = []

    for product_index, (product_line, assumptions) in enumerate(
        PRODUCT_ASSUMPTIONS.items()
    ):
        for month_index, month in enumerate(MONTHS):
            year_progress = month_index / 11
            budget_growth = 1 + assumptions["annual_volume_growth"] * year_progress
            budget_volume = int(
                round(
                    assumptions["base_volume"]
                    * SEASONAL_VOLUME[month_index]
                    * budget_growth
                )
            )

            demand_noise = rng.normal(0, 0.018)
            demand_pattern = {
                "Electric Motor Components": np.array(
                    [-0.025, -0.020, -0.012, 0.005, 0.018, 0.022, 0.010, -0.015, 0.006, 0.016, 0.020, 0.012]
                ),
                "Battery Management Components": np.array(
                    [-0.010, 0.000, 0.012, 0.025, 0.035, 0.045, 0.050, 0.040, 0.058, 0.065, 0.072, 0.068]
                ),
                "Automotive Sensors": np.array(
                    [0.010, 0.006, 0.000, -0.008, -0.012, -0.006, 0.004, -0.020, -0.010, 0.004, 0.008, 0.002]
                ),
            }[product_line][month_index]
            actual_volume_factor = (
                1
                + assumptions["actual_volume_bias"]
                + demand_pattern
                + demand_noise
            )
            actual_volume = max(0, int(round(budget_volume * actual_volume_factor)))

            budget_price = assumptions["unit_price"] * (1 + 0.012 * year_progress)
            pricing_noise = rng.normal(0, 0.0035)
            actual_price = budget_price * (
                1 + assumptions["actual_price_bias"] + pricing_noise
            )

            budget_material = assumptions["material"] * (1 + 0.016 * year_progress)
            actual_material = budget_material * (
                1
                + MATERIAL_MARKET_SHOCK[month_index]
                * assumptions["material_sensitivity"]
                + rng.normal(0, 0.004)
            )
            budget_labor = assumptions["labor"] * (1 + 0.020 * year_progress)
            actual_labor = budget_labor * (
                1 + 0.020 + 0.006 * year_progress + rng.normal(0, 0.003)
            )
            budget_overhead = assumptions["overhead"] * (1 + 0.012 * year_progress)
            volume_deviation = actual_volume / budget_volume - 1
            actual_overhead = budget_overhead * (
                1 + 0.012 - 0.35 * volume_deviation + rng.normal(0, 0.004)
            )

            rows.append(
                {
                    "Month": month,
                    "Product Line": product_line,
                    "Currency": CONFIG.currency,
                    "Data Classification": CONFIG.data_classification,
                    "Company Type": CONFIG.company_type,
                    "Budget Sales Volume": budget_volume,
                    "Actual Sales Volume": actual_volume,
                    "Budget Unit Price": round(budget_price, 2),
                    "Actual Unit Price": round(actual_price, 2),
                    "Budget Material Unit Cost": round(budget_material, 2),
                    "Actual Material Unit Cost": round(actual_material, 2),
                    "Budget Labor Unit Cost": round(budget_labor, 2),
                    "Actual Labor Unit Cost": round(actual_labor, 2),
                    "Budget Overhead Unit Cost": round(budget_overhead, 2),
                    "Actual Overhead Unit Cost": round(actual_overhead, 2),
                }
            )

    drivers = pd.DataFrame(rows)
    issues = validate_input_data(drivers)
    assert_no_errors(issues)
    return calculate_financial_metrics(drivers)


if __name__ == "__main__":
    data = generate_synthetic_data()
    print(data.head().to_string(index=False))

