# Phase 4 — Financial Accuracy and Functional Test Report

> **Synthetic Data / Simulated Company**  
> Test scope: 2025 manufacturing financial dataset, Python analysis outputs, Excel workbook, and static Dashboard.

## Executive result

**PASS** — all automated financial and Dashboard tests passed. The exported CSV, Dashboard JSON, and Excel workbook reconcile to the same controlled dataset. Browser checks found no console errors or responsive-layout overflow.

| Test layer | Result | Coverage |
|---|---:|---|
| Python financial and artifact tests | **30 / 30 passed** | Formulas, validation, aggregation, exported files, Excel formulas, precision, edge cases |
| JavaScript Dashboard tests | **12 / 12 passed** | Filters, KPI aggregation, cost composition, bridge reconciliation, bilingual labels, zero/missing/invalid values |
| Browser functional checks | **Passed** | Desktop, mobile, filters, EN/中文 switch, language persistence, console |
| Excel Audit sheet | **7 / 7 PASS** | Population, duplicate keys, missing inputs, revenue, COGS, gross profit, company bridge |

## Controlled financial checks

The project applies one variance convention throughout:

```text
Variance = Actual - Budget
```

| Control | Validation method | Result |
|---|---|---|
| Revenue | Sales Volume × Unit Price | PASS |
| Total COGS | Material + Labor + Manufacturing Overhead | PASS |
| Gross Profit | Revenue − COGS | PASS |
| Gross Margin | Gross Profit ÷ Revenue | PASS |
| Gross Margin Variance | Actual margin − Budget margin, in percentage points | PASS |
| Product totals | Sum of product lines = company total | PASS |
| Monthly totals | Sum of months = full-year total | PASS |
| Cost classification | Cost components sum once to COGS | PASS |
| Revenue bridge | Volume effect + price effect = revenue variance | PASS |
| Company gross-profit bridge | Volume + mix + price + unit cost = gross-profit variance | PASS |
| Product-line gross-profit bridge | Volume + price + unit cost = each product's gross-profit variance | PASS |

The maximum exported row-level difference for Revenue, COGS, and Gross Profit is below **EUR 0.01**. Exported gross-margin ratios match recalculated ratios within the six-decimal reporting precision.

## Cross-file reconciliation

The test suite reads the deliverables a reviewer will open, rather than validating only in-memory Python results.

- CSV population: **36 unique month/product-line records**
- Reporting dimensions: **12 months × 3 product lines**
- Dashboard JSON: controlled KPI fields match CSV values by month and product line
- Excel Summary: Revenue, COGS, Gross Profit, and Gross Margin match CSV annual totals
- Excel formulas: editable Data drivers feed all calculated fields and reporting sheets
- Excel sensitivity: changing one Actual Sales Volume cell updates linked consolidated Revenue, then restores exactly
- Excel Audit: all seven embedded controls report **PASS**
- Synthetic-data metadata: enforced as `Synthetic Data / Simulated Company`

## Edge-case controls

| Scenario | Expected handling | Result |
|---|---|---|
| Zero budget denominator | Variance percentage is unavailable | PASS |
| Zero revenue | Gross margin is unavailable | PASS |
| Missing cost driver | Downstream COGS and profit remain missing; no silent imputation | PASS |
| Missing required driver | Validation error | PASS |
| Non-numeric driver | Validation error | PASS |
| Negative volume, price, or unit cost | Validation error | PASS |
| Duplicate month/product key | Validation error | PASS |
| Invalid company-data classification | Validation error | PASS |
| Undefined ratios | No infinity is produced | PASS |
| Missing Dashboard amount | KPI and dependent ratios remain unavailable, not zero | PASS |
| Invalid Dashboard bridge driver | Explained bridge remains unavailable | PASS |

## Dashboard filter tests

Automated JavaScript tests cover every single-month selection across all three product lines and the consolidated company view.

For each selection, the tests verify:

- source-row count and controlled filter grain;
- actual Revenue and COGS aggregation;
- Gross Margin calculated from aggregated amounts;
- cost component total and share reconciliation;
- gross-profit bridge reconciliation;
- safe handling of zero Revenue and zero Budget values.

## Browser functional checks

| Check | Evidence | Result |
|---|---|---|
| English interface | Full-year KPIs, charts, tables, commentary render | PASS |
| Chinese interface | Static and dynamic content translate | PASS |
| Filter state during language switch | 2025-03 to 2025-10 and Battery Management Components retained | PASS |
| Filtered record count | 8 monthly product records | PASS |
| Language persistence | Chinese restored after browser reload | PASS |
| Desktop layout | 1280 px viewport; no horizontal overflow | PASS |
| Mobile layout | 390 × 844 px viewport; no horizontal overflow | PASS |
| Browser console | No errors or warnings | PASS |

## Reproduction commands

```bash
python -m unittest discover -s tests -v
node --test tests/test_dashboard_metrics.js
```

The Dashboard browser checks can be repeated by serving the static directory:

```bash
python -m http.server 8000 --directory dashboard
```

Then open `http://127.0.0.1:8000/`.

## Interpretation boundary

These tests demonstrate internal calculation consistency, controlled aggregation, and correct Dashboard behavior. They do not validate the data against a real company because the entire project intentionally uses synthetic data.

## Final GitHub readiness verification

- A clean Python 3.12 virtual environment installed every version in `requirements-lock.txt` successfully.
- `python -m src.run_analysis --skip-workbook` regenerated 36 controlled records, reports, charts, and Dashboard data in that clean environment.
- The same environment passed all 30 Python tests; Node.js passed all 12 JavaScript tests without installing any npm runtime dependencies.
- GitHub Pages workflow YAML parsed successfully.
- `index.html`, CSS, JavaScript files, and the English preview image all returned HTTP 200 from a local static server.
- All Dashboard resource references are relative; no root-absolute asset path can break under the repository Pages URL.
