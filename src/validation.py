"""Schema and financial-integrity validation helpers."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from src.config import CONFIG, MONTHS, PRODUCT_LINES, REQUIRED_INPUT_COLUMNS


@dataclass(frozen=True)
class ValidationIssue:
    severity: str
    rule: str
    message: str


def validate_input_data(frame: pd.DataFrame) -> list[ValidationIssue]:
    """Return actionable schema and business-rule issues without mutating data."""

    issues: list[ValidationIssue] = []
    missing_columns = sorted(set(REQUIRED_INPUT_COLUMNS).difference(frame.columns))
    if missing_columns:
        issues.append(
            ValidationIssue(
                "ERROR",
                "required_columns",
                f"Missing required columns: {', '.join(missing_columns)}",
            )
        )
        return issues

    duplicate_mask = frame.duplicated(["Month", "Product Line"], keep=False)
    if duplicate_mask.any():
        issues.append(
            ValidationIssue(
                "ERROR",
                "unique_grain",
                f"Found {int(duplicate_mask.sum())} rows with duplicate month/product-line keys.",
            )
        )

    driver_columns = list(REQUIRED_INPUT_COLUMNS[5:])
    missing_driver_count = int(frame[driver_columns].isna().sum().sum())
    if missing_driver_count:
        issues.append(
            ValidationIssue(
                "ERROR",
                "complete_drivers",
                f"Found {missing_driver_count} missing driver values; no silent imputation is allowed.",
            )
        )

    numeric = frame[driver_columns].apply(pd.to_numeric, errors="coerce")
    invalid_numeric_count = int((numeric.isna() & frame[driver_columns].notna()).sum().sum())
    if invalid_numeric_count:
        issues.append(
            ValidationIssue(
                "ERROR",
                "numeric_drivers",
                f"Found {invalid_numeric_count} non-numeric driver values.",
            )
        )

    if np.isfinite(numeric.to_numpy(dtype=float, na_value=np.nan)).any():
        negative_count = int((numeric < 0).sum().sum())
        if negative_count:
            issues.append(
                ValidationIssue(
                    "ERROR",
                    "non_negative_drivers",
                    f"Found {negative_count} negative volume, price, or unit-cost values.",
                )
            )

    invalid_months = sorted(set(frame["Month"].dropna()).difference(MONTHS))
    if invalid_months:
        issues.append(
            ValidationIssue(
                "ERROR", "reporting_period", f"Unexpected months: {invalid_months}"
            )
        )

    invalid_products = sorted(
        set(frame["Product Line"].dropna()).difference(PRODUCT_LINES)
    )
    if invalid_products:
        issues.append(
            ValidationIssue(
                "ERROR",
                "product_master",
                f"Unexpected product lines: {invalid_products}",
            )
        )

    metadata_rules = {
        "Currency": CONFIG.currency,
        "Data Classification": CONFIG.data_classification,
        "Company Type": CONFIG.company_type,
    }
    for column, expected in metadata_rules.items():
        invalid_count = int(frame[column].ne(expected).sum())
        if invalid_count:
            issues.append(
                ValidationIssue(
                    "ERROR",
                    "synthetic_metadata",
                    f"{invalid_count} rows in {column!r} do not equal {expected!r}.",
                )
            )

    expected_rows = len(MONTHS) * len(PRODUCT_LINES)
    if len(frame) != expected_rows:
        issues.append(
            ValidationIssue(
                "WARNING",
                "expected_population",
                f"Expected {expected_rows} rows for a complete year; found {len(frame)}.",
            )
        )

    return issues


def assert_no_errors(issues: list[ValidationIssue]) -> None:
    """Raise one readable exception when validation produced errors."""

    errors = [issue.message for issue in issues if issue.severity == "ERROR"]
    if errors:
        raise ValueError("Data validation failed: " + " | ".join(errors))

