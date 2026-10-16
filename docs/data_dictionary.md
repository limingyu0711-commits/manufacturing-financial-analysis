# Data Dictionary

> **Synthetic Data / Simulated Company** — no field represents a real company.

The controlled grain is one row per `Month` and `Product Line`. The complete 2025 dataset therefore contains 36 rows.

## Dimensions and metadata

| Field | Type | Unit | Definition |
|---|---:|---|---|
| Month | string | YYYY-MM | Reporting month from 2025-01 to 2025-12 |
| Product Line | string | n/a | One of the three controlled product lines |
| Currency | string | ISO-like code | Fixed to EUR |
| Data Classification | string | n/a | Fixed to `Synthetic Data` |
| Company Type | string | n/a | Fixed to `Simulated Company` |

## Business drivers

| Field pattern | Type | Unit | Definition |
|---|---:|---|---|
| Budget / Actual Sales Volume | integer | units | Units sold in the reporting month |
| Budget / Actual Unit Price | decimal | EUR per unit | Weighted average selling price |
| Budget / Actual Material Unit Cost | decimal | EUR per unit | Direct material cost per sold unit |
| Budget / Actual Labor Unit Cost | decimal | EUR per unit | Direct manufacturing labor per sold unit |
| Budget / Actual Overhead Unit Cost | decimal | EUR per unit | Allocated manufacturing overhead per sold unit |

## Calculated financial fields

| Field pattern | Unit | Formula |
|---|---|---|
| Budget / Actual Revenue | EUR | Sales Volume × Unit Price |
| Budget / Actual Unit COGS | EUR per unit | Material Unit Cost + Labor Unit Cost + Overhead Unit Cost |
| Budget / Actual Material Cost | EUR | Sales Volume × Material Unit Cost |
| Budget / Actual Labor Cost | EUR | Sales Volume × Labor Unit Cost |
| Budget / Actual Manufacturing Overhead | EUR | Sales Volume × Overhead Unit Cost |
| Budget / Actual COGS | EUR | Material Cost + Labor Cost + Manufacturing Overhead |
| Budget / Actual Gross Profit | EUR | Revenue − COGS |
| Budget / Actual Gross Margin | ratio | Gross Profit ÷ Revenue |

## Variance fields

All base variances use `Actual − Budget`.

| Field | Unit | Interpretation |
|---|---|---|
| Revenue Variance | EUR | Positive is normally favorable |
| COGS Variance | EUR | Positive is unfavorable |
| Gross Profit Variance | EUR | Positive is normally favorable |
| Variance % | percentage | Variance ÷ absolute budget; undefined for zero budget |
| Gross Margin Variance (pp) | percentage points | Actual margin minus budget margin |
| Revenue Volume Effect | EUR | (Actual volume − Budget volume) × Budget price |
| Revenue Price Effect | EUR | Actual volume × (Actual price − Budget price) |

## Scope note

This management-accounting model treats COGS as the cost of units sold. It does not model inventory movements, work in progress, standard-cost absorption, purchase-price variance, or production-volume variance. Those exclusions are disclosed to keep the portfolio model transparent and auditable.

