from __future__ import annotations

import unittest

import pandas as pd

from src.validation import validate_input_data
from tests.helpers import make_driver_frame


class ValidationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.driver_frame = make_driver_frame()

    def test_partial_valid_frame_only_warns_about_population(self) -> None:
        issues = validate_input_data(self.driver_frame)
        self.assertFalse([issue for issue in issues if issue.severity == "ERROR"])
        self.assertTrue(any(issue.rule == "expected_population" for issue in issues))

    def test_missing_driver_is_an_error(self) -> None:
        self.driver_frame.loc[0, "Actual Unit Price"] = None
        issues = validate_input_data(self.driver_frame)
        self.assertTrue(any(issue.rule == "complete_drivers" for issue in issues))

    def test_duplicate_grain_is_an_error(self) -> None:
        duplicated = pd.concat(
            [self.driver_frame, self.driver_frame.iloc[[0]]], ignore_index=True
        )
        issues = validate_input_data(duplicated)
        self.assertTrue(any(issue.rule == "unique_grain" for issue in issues))

    def test_synthetic_metadata_is_enforced(self) -> None:
        self.driver_frame.loc[0, "Data Classification"] = "Actual Company Data"
        issues = validate_input_data(self.driver_frame)
        self.assertTrue(any(issue.rule == "synthetic_metadata" for issue in issues))

    def test_negative_driver_is_rejected(self) -> None:
        self.driver_frame.loc[0, "Actual Sales Volume"] = -1
        issues = validate_input_data(self.driver_frame)
        self.assertTrue(any(issue.rule == "non_negative_drivers" for issue in issues))

    def test_non_numeric_driver_is_rejected(self) -> None:
        self.driver_frame["Actual Unit Price"] = self.driver_frame[
            "Actual Unit Price"
        ].astype(object)
        self.driver_frame.loc[0, "Actual Unit Price"] = "invalid"
        issues = validate_input_data(self.driver_frame)
        self.assertTrue(any(issue.rule == "numeric_drivers" for issue in issues))


if __name__ == "__main__":
    unittest.main()
