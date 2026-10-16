from __future__ import annotations

import pandas as pd

from src.config import CONFIG, PRODUCT_LINES


def make_driver_frame() -> pd.DataFrame:
    """Return a compact valid input frame shared by unit tests."""

    rows = []
    for index, product_line in enumerate(PRODUCT_LINES):
        rows.append(
            {
                "Month": "2025-01",
                "Product Line": product_line,
                "Currency": CONFIG.currency,
                "Data Classification": CONFIG.data_classification,
                "Company Type": CONFIG.company_type,
                "Budget Sales Volume": 100 + index * 20,
                "Actual Sales Volume": 110 + index * 20,
                "Budget Unit Price": 50 + index * 10,
                "Actual Unit Price": 52 + index * 10,
                "Budget Material Unit Cost": 20 + index,
                "Actual Material Unit Cost": 21 + index,
                "Budget Labor Unit Cost": 8 + index,
                "Actual Labor Unit Cost": 8.5 + index,
                "Budget Overhead Unit Cost": 7 + index,
                "Actual Overhead Unit Cost": 7.5 + index,
            }
        )
    return pd.DataFrame(rows)

