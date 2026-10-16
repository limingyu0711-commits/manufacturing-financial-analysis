"""Controlled project configuration for the simulated company."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ProjectConfig:
    """Stable assumptions shared by generation, analysis, and reporting."""

    company_name: str = "Apex Mobility Components Ltd."
    company_type: str = "Simulated Company"
    data_classification: str = "Synthetic Data"
    currency: str = "EUR"
    reporting_year: int = 2025
    random_seed: int = 20251016


CONFIG = ProjectConfig()

PRODUCT_LINES: tuple[str, ...] = (
    "Electric Motor Components",
    "Battery Management Components",
    "Automotive Sensors",
)

MONTHS: tuple[str, ...] = tuple(f"2025-{month:02d}" for month in range(1, 13))

IDENTIFIER_COLUMNS: tuple[str, ...] = (
    "Month",
    "Product Line",
    "Currency",
    "Data Classification",
    "Company Type",
)

DRIVER_COLUMNS: tuple[str, ...] = (
    "Budget Sales Volume",
    "Actual Sales Volume",
    "Budget Unit Price",
    "Actual Unit Price",
    "Budget Material Unit Cost",
    "Actual Material Unit Cost",
    "Budget Labor Unit Cost",
    "Actual Labor Unit Cost",
    "Budget Overhead Unit Cost",
    "Actual Overhead Unit Cost",
)

REQUIRED_INPUT_COLUMNS: tuple[str, ...] = IDENTIFIER_COLUMNS + DRIVER_COLUMNS

