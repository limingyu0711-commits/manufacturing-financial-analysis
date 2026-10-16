(function attachFinanceMetrics(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.FinanceMetrics = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createFinanceMetrics() {
  "use strict";

  const toFiniteNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const sum = (records, field) => {
    if (!records.length) return 0;
    let total = 0;
    for (const record of records) {
      const value = toFiniteNumber(record[field]);
      if (value === null) return null;
      total += value;
    }
    return total;
  };

  const subtract = (left, right) =>
    Number.isFinite(left) && Number.isFinite(right) ? left - right : null;

  const sumComputed = (records, calculation) => {
    let total = 0;
    for (const record of records) {
      const value = calculation(record);
      if (!Number.isFinite(value)) return null;
      total += value;
    }
    return total;
  };

  const safeDivide = (numerator, denominator) => {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return null;
    }
    return numerator / denominator;
  };

  const filterRecords = (records, filters) => {
    const { startMonth, endMonth, productLine } = filters;
    return records.filter((record) => {
      const inPeriod = record.Month >= startMonth && record.Month <= endMonth;
      const inProduct = productLine === "All" || record["Product Line"] === productLine;
      return inPeriod && inProduct;
    });
  };

  const aggregate = (records) => {
    const fields = [
      "Budget Sales Volume",
      "Actual Sales Volume",
      "Budget Revenue",
      "Actual Revenue",
      "Budget Material Cost",
      "Actual Material Cost",
      "Budget Labor Cost",
      "Actual Labor Cost",
      "Budget Manufacturing Overhead",
      "Actual Manufacturing Overhead",
      "Budget COGS",
      "Actual COGS",
      "Budget Gross Profit",
      "Actual Gross Profit",
      "Revenue Volume Effect",
      "Revenue Price Effect",
    ];
    const result = Object.fromEntries(fields.map((field) => [field, sum(records, field)]));
    result["Revenue Variance"] = subtract(
      result["Actual Revenue"],
      result["Budget Revenue"],
    );
    result["Revenue Variance %"] = safeDivide(
      result["Revenue Variance"],
      Math.abs(result["Budget Revenue"]),
    );
    result["COGS Variance"] = subtract(result["Actual COGS"], result["Budget COGS"]);
    result["Gross Profit Variance"] = subtract(
      result["Actual Gross Profit"],
      result["Budget Gross Profit"],
    );
    result["Gross Profit Variance %"] = safeDivide(
      result["Gross Profit Variance"],
      Math.abs(result["Budget Gross Profit"]),
    );
    result["Budget Gross Margin"] = safeDivide(
      result["Budget Gross Profit"],
      result["Budget Revenue"],
    );
    result["Actual Gross Margin"] = safeDivide(
      result["Actual Gross Profit"],
      result["Actual Revenue"],
    );
    result["Gross Margin Variance (pp)"] =
      result["Actual Gross Margin"] === null || result["Budget Gross Margin"] === null
        ? null
        : (result["Actual Gross Margin"] - result["Budget Gross Margin"]) * 100;
    return result;
  };

  const groupBy = (records, field) => {
    const groups = new Map();
    records.forEach((record) => {
      const key = record[field];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    });
    return [...groups.entries()].map(([key, rows]) => ({ key, rows }));
  };

  const monthlyAnalysis = (records) =>
    groupBy(records, "Month")
      .sort((left, right) => left.key.localeCompare(right.key))
      .map(({ key, rows }) => ({ Month: key, ...aggregate(rows) }));

  const productAnalysis = (records) =>
    groupBy(records, "Product Line")
      .map(({ key, rows }) => ({ "Product Line": key, ...aggregate(rows) }))
      .sort((left, right) => right["Actual Revenue"] - left["Actual Revenue"]);

  const costBreakdown = (records) => {
    const total = sum(records, "Actual COGS");
    return [
      { label: "Material", value: sum(records, "Actual Material Cost"), color: "#3a82b8" },
      { label: "Labor", value: sum(records, "Actual Labor Cost"), color: "#d9792b" },
      {
        label: "Manufacturing overhead",
        value: sum(records, "Actual Manufacturing Overhead"),
        color: "#2a8e9d",
      },
    ].map((item) => ({ ...item, share: safeDivide(item.value, total) }));
  };

  const profitBridge = (records) => {
    const products = productAnalysis(records).map((product) => {
      const budgetVolume = product["Budget Sales Volume"];
      const actualVolume = product["Actual Sales Volume"];
      return {
        ...product,
        budgetUnitGrossProfit: safeDivide(product["Budget Gross Profit"], budgetVolume),
        budgetUnitPrice: safeDivide(product["Budget Revenue"], budgetVolume),
        actualUnitPrice: safeDivide(product["Actual Revenue"], actualVolume),
        budgetUnitCogs: safeDivide(product["Budget COGS"], budgetVolume),
        actualUnitCogs: safeDivide(product["Actual COGS"], actualVolume),
      };
    });
    const budgetTotalVolume = sum(products, "Budget Sales Volume");
    const actualTotalVolume = sum(products, "Actual Sales Volume");
    const weightedBudgetUnitGrossProfit = sumComputed(products, (product) => {
      const budgetMix = safeDivide(product["Budget Sales Volume"], budgetTotalVolume);
      return budgetMix === null || product.budgetUnitGrossProfit === null
        ? null
        : budgetMix * product.budgetUnitGrossProfit;
    });

    const volume =
      Number.isFinite(actualTotalVolume) &&
      Number.isFinite(budgetTotalVolume) &&
      Number.isFinite(weightedBudgetUnitGrossProfit)
        ? (actualTotalVolume - budgetTotalVolume) * weightedBudgetUnitGrossProfit
        : null;
    const mix = sumComputed(products, (product) => {
      const budgetMix = safeDivide(product["Budget Sales Volume"], budgetTotalVolume);
      const actualMix = safeDivide(product["Actual Sales Volume"], actualTotalVolume);
      return budgetMix === null ||
        actualMix === null ||
        product.budgetUnitGrossProfit === null ||
        !Number.isFinite(actualTotalVolume)
        ? null
        : actualTotalVolume * (actualMix - budgetMix) * product.budgetUnitGrossProfit;
    });
    const price = sumComputed(products, (product) =>
      product.actualUnitPrice === null || product.budgetUnitPrice === null
        ? null
        : product["Actual Sales Volume"] *
          (product.actualUnitPrice - product.budgetUnitPrice),
    );
    const unitCost = sumComputed(products, (product) =>
      product.actualUnitCogs === null || product.budgetUnitCogs === null
        ? null
        : -product["Actual Sales Volume"] *
          (product.actualUnitCogs - product.budgetUnitCogs),
    );
    const effects = [
      { label: "Volume", value: volume },
      { label: "Product mix", value: mix },
      { label: "Price", value: price },
      { label: "Unit cost", value: unitCost },
    ];
    return {
      effects,
      explainedVariance: effects.every((effect) => Number.isFinite(effect.value))
        ? effects.reduce((total, effect) => total + effect.value, 0)
        : null,
      grossProfitVariance: subtract(
        sum(records, "Actual Gross Profit"),
        sum(records, "Budget Gross Profit"),
      ),
    };
  };

  return {
    aggregate,
    costBreakdown,
    filterRecords,
    monthlyAnalysis,
    productAnalysis,
    profitBridge,
    safeDivide,
    sum,
  };
});
