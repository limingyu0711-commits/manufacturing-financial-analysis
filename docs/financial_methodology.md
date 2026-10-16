# Financial Methodology

> **Synthetic Data / Simulated Company**

## Controlled sign convention

Every amount, volume, and percentage variance begins with the same convention:

```text
Variance = Actual - Budget
```

Favorability is a separate interpretation layer. Positive revenue and gross-profit variances are normally favorable; positive COGS variance is unfavorable.

## Ratio handling

Ratios are recalculated from aggregated numerators and denominators. Row-level margins are never averaged. A zero or missing denominator produces `N/A` rather than zero or infinity.

## Revenue bridge

```text
Volume Effect = (Actual Volume - Budget Volume) × Budget Unit Price
Price Effect  = Actual Volume × (Actual Unit Price - Budget Unit Price)

Revenue Variance = Volume Effect + Price Effect
```

## Gross-profit bridge

The model intentionally separates two analytical levels:

- **Company portfolio:** Budget and actual mix are based on each product line's share of total units. Volume, mix, price, and unit-cost effects reconcile to the consolidated Gross Profit variance.
- **Individual product line:** Mix is not meaningful inside a single product. Each product row therefore uses only volume, price, and unit-cost effects and reconciles independently to that product line's Gross Profit variance.

```text
Gross Profit Variance
= Volume Effect
+ Mix Effect
+ Price Effect
+ Unit Cost Effect
```

The bridge uses weighted average unit price and unit COGS for each product line over the selected period. It therefore reconciles exactly to actual gross profit less budget gross profit, subject only to floating-point tolerance.

The `Company Mix Contribution` helper in the Excel model shows each product line's contribution to the consolidated mix effect. It is an allocation aid and is not added to the product-line bridge, which would double count the product's volume movement.

## Analytical limitation

The model can demonstrate that a result is associated with volume, price, unit-cost, or product-mix changes. It cannot prove operational causes such as supplier negotiations, customer loss, downtime, or procurement disruption unless those events are explicitly represented by additional source data. Dashboard commentary will distinguish evidence from assumptions.
