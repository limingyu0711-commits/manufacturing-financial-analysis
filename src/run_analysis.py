"""Command-line entry point for Phase 2 data and analysis outputs."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess

import pandas as pd

from src.analysis import (
    build_company_summary,
    build_cost_breakdown,
    build_monthly_analysis,
    build_product_analysis,
    build_profit_bridge,
)
from src.generate_data import generate_synthetic_data
from src.visualization import create_static_charts


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def _round_for_export(frame: pd.DataFrame) -> pd.DataFrame:
    """Apply reporting precision without converting numeric values to text."""

    result = frame.copy()
    for column in result.select_dtypes(include="number").columns:
        precision = 6 if ("%" in column or "Margin" in column or "Mix" in column) else 2
        if "Volume" in column and "%" not in column and "Effect" not in column:
            precision = 0
        result[column] = result[column].round(precision)
    if "Metric" in result.columns:
        gross_margin = result["Metric"].eq("Gross Margin")
        for column in ("Budget", "Actual", "Variance"):
            if column in result.columns:
                result.loc[gross_margin, column] = frame.loc[
                    gross_margin, column
                ].round(6)
    return result


def _build_excel_workbook(output_root: Path) -> None:
    """Regenerate the formula-driven Excel model from the exported payload."""

    node_executable = os.environ.get("MFA_NODE_BIN") or shutil.which("node")
    if node_executable is None:
        raise RuntimeError(
            "Node.js and the Codex-bundled @oai/artifact-tool package are "
            "required to build the Excel workbook. In a public environment, "
            "rerun with '--skip-workbook'."
        )
    builder = output_root / "scripts" / "build_workbook.mjs"
    subprocess.run(
        [node_executable, str(builder)],
        cwd=output_root,
        check=True,
    )


def run(
    output_root: Path = PROJECT_ROOT, *, build_workbook: bool = True
) -> dict[str, object]:
    """Generate the controlled dataset, analysis tables, charts, and JSON payload."""

    data_dir = output_root / "data"
    reports_dir = output_root / "reports"
    charts_dir = reports_dir / "charts"
    data_dir.mkdir(parents=True, exist_ok=True)
    reports_dir.mkdir(parents=True, exist_ok=True)

    data = generate_synthetic_data()
    summary = build_company_summary(data)
    monthly = build_monthly_analysis(data)
    product = build_product_analysis(data)
    cost = build_cost_breakdown(data)
    bridge = build_profit_bridge(data)

    export_frames = {
        "data": _round_for_export(data),
        "summary": _round_for_export(summary),
        "monthly": _round_for_export(monthly),
        "product": _round_for_export(product),
        "cost": _round_for_export(cost),
        "bridge": _round_for_export(bridge),
    }

    export_frames["data"].to_csv(
        data_dir / "manufacturing_financial_data.csv", index=False
    )
    export_frames["summary"].to_csv(reports_dir / "financial_summary.csv", index=False)
    export_frames["monthly"].to_csv(reports_dir / "monthly_analysis.csv", index=False)
    export_frames["product"].to_csv(
        reports_dir / "product_performance.csv", index=False
    )
    export_frames["cost"].to_csv(reports_dir / "cost_breakdown.csv", index=False)
    export_frames["bridge"].to_csv(
        reports_dir / "gross_profit_bridge.csv", index=False
    )

    dashboard_payload = {
        "metadata": {
            "dataClassification": "Synthetic Data",
            "companyType": "Simulated Company",
            "currency": "EUR",
            "reportingPeriod": "2025-01 to 2025-12",
        },
        "records": export_frames["data"].where(pd.notna(export_frames["data"]), None).to_dict(orient="records"),
    }
    with (data_dir / "dashboard_data.json").open("w", encoding="utf-8") as handle:
        json.dump(dashboard_payload, handle, ensure_ascii=False, indent=2)

    dashboard_js_dir = output_root / "dashboard" / "js"
    dashboard_js_dir.mkdir(parents=True, exist_ok=True)
    with (dashboard_js_dir / "dashboard-data.js").open("w", encoding="utf-8") as handle:
        handle.write("window.DASHBOARD_DATA = ")
        json.dump(dashboard_payload, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write(";\n")

    workbook_payload = {
        name: json.loads(frame.to_json(orient="records"))
        for name, frame in export_frames.items()
    }
    work_dir = output_root / "work"
    work_dir.mkdir(parents=True, exist_ok=True)
    with (work_dir / "workbook_payload.json").open("w", encoding="utf-8") as handle:
        json.dump(workbook_payload, handle, ensure_ascii=False)

    chart_paths = create_static_charts(monthly, product, cost, charts_dir)
    if build_workbook:
        _build_excel_workbook(output_root)
    return {
        "rows": len(data),
        "summary": summary,
        "monthly": monthly,
        "product": product,
        "cost": cost,
        "bridge": bridge,
        "charts": chart_paths,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Regenerate the synthetic manufacturing finance outputs."
    )
    parser.add_argument(
        "--skip-workbook",
        action="store_true",
        help=(
            "Skip the optional formula-driven Excel build. Use this in public "
            "environments without the Codex-bundled @oai/artifact-tool package."
        ),
    )
    arguments = parser.parse_args()
    results = run(build_workbook=not arguments.skip_workbook)
    print(f"Generated {results['rows']} synthetic month/product-line records.")
