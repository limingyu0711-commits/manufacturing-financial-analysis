# Second-Round Quality Optimization Report

> **Synthetic Data / Simulated Company**  
> Completed: 2026-10-16

## Result

All five independent-review findings were addressed. The current deliverables reconcile across Python, CSV, Dashboard JSON, JavaScript calculations, and the Excel workbook.

## Corrections completed

1. **Gross Margin precision** — annual Budget Gross Margin is 32.521968% and Actual Gross Margin is 31.618260%; CSV retains six-decimal ratio precision and Excel/Dashboard display 32.52% and 31.62%.
2. **Formula-driven Excel** — editable volume, price, and unit-cost drivers feed Excel formulas for Revenue, cost components, COGS, Gross Profit, Gross Margin, and variances. Python now invokes the workbook builder during regeneration.
3. **Gross Profit bridge** — the company portfolio bridge includes product mix. Product-line bridges exclude mix and each reconcile independently using volume, price, and unit-cost effects.
4. **Dashboard data quality** — missing or invalid additive values propagate as unavailable; they are not silently converted to zero.
5. **Regression verification** — 30 Python tests, 12 JavaScript tests, and 7 embedded Excel Audit controls pass.

## Remaining scope limitations

- All data is synthetic and does not represent a real company.
- Product mix is meaningful only at the consolidated portfolio level; the Excel helper column shows product contributions to company mix but does not add mix to individual product bridges.
- The static Dashboard does not connect to a database or ERP system.
- GitHub Pages deployment remains optional and was not performed in this local-only delivery.
