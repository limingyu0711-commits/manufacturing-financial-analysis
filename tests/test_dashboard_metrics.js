const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const metrics = require(path.join(__dirname, "..", "dashboard", "js", "metrics.js"));
const i18n = require(path.join(__dirname, "..", "dashboard", "js", "i18n.js"));
const payload = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "dashboard_data.json"), "utf8"),
);
const records = payload.records;

test("full-year dashboard totals reconcile to source rows", () => {
  const result = metrics.aggregate(records);
  const sourceRevenue = records.reduce((total, row) => total + row["Actual Revenue"], 0);
  const sourceGrossProfit = records.reduce(
    (total, row) => total + row["Actual Gross Profit"],
    0,
  );
  assert.ok(Math.abs(result["Actual Revenue"] - sourceRevenue) < 0.01);
  assert.ok(Math.abs(result["Actual Gross Profit"] - sourceGrossProfit) < 0.01);
});

test("month and product filter returns the exact controlled grain", () => {
  const result = metrics.filterRecords(records, {
    startMonth: "2025-04",
    endMonth: "2025-04",
    productLine: "Automotive Sensors",
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].Month, "2025-04");
  assert.equal(result[0]["Product Line"], "Automotive Sensors");
});

test("filtered gross margin uses aggregated amounts", () => {
  const filtered = metrics.filterRecords(records, {
    startMonth: "2025-01",
    endMonth: "2025-06",
    productLine: "All",
  });
  const result = metrics.aggregate(filtered);
  assert.ok(
    Math.abs(
      result["Actual Gross Margin"] -
        result["Actual Gross Profit"] / result["Actual Revenue"],
    ) < 1e-12,
  );
});

test("dashboard gross-profit bridge reconciles after filtering", () => {
  const filtered = metrics.filterRecords(records, {
    startMonth: "2025-03",
    endMonth: "2025-10",
    productLine: "All",
  });
  const bridge = metrics.profitBridge(filtered);
  assert.ok(Math.abs(bridge.explainedVariance - bridge.grossProfitVariance) < 0.01);
});

test("zero denominator returns unavailable ratio", () => {
  assert.equal(metrics.safeDivide(10, 0), null);
  assert.equal(metrics.safeDivide(0, 0), null);
});

test("bilingual labels keep finance keys stable while translating display text", () => {
  assert.equal(i18n.t("en", "grossMargin"), "Gross Margin");
  assert.equal(i18n.t("zh", "grossMargin"), "毛利率");
  assert.equal(i18n.monthLabel("en", "2025-03", true), "Mar");
  assert.equal(i18n.monthLabel("zh", "2025-03", true), "3月");
  assert.equal(i18n.productLabel("zh", "Automotive Sensors"), "汽车传感器");
  assert.equal(i18n.normalizeLanguage("unsupported"), "en");
});

test("English and Chinese dictionaries expose the same interface keys", () => {
  assert.deepEqual(
    Object.keys(i18n.dictionaries.en).sort(),
    Object.keys(i18n.dictionaries.zh).sort(),
  );
});

test("every month and product filter returns reconciled dashboard metrics", () => {
  const months = [...new Set(records.map((row) => row.Month))];
  const productLines = [...new Set(records.map((row) => row["Product Line"]))];
  for (const month of months) {
    for (const productLine of ["All", ...productLines]) {
      const filtered = metrics.filterRecords(records, {
        startMonth: month,
        endMonth: month,
        productLine,
      });
      const result = metrics.aggregate(filtered);
      const sourceRevenue = filtered.reduce(
        (total, row) => total + row["Actual Revenue"],
        0,
      );
      const sourceCogs = filtered.reduce(
        (total, row) => total + row["Actual COGS"],
        0,
      );
      assert.ok(Math.abs(result["Actual Revenue"] - sourceRevenue) < 0.01);
      assert.ok(Math.abs(result["Actual COGS"] - sourceCogs) < 0.01);

      const bridge = metrics.profitBridge(filtered);
      assert.ok(
        Math.abs(bridge.explainedVariance - bridge.grossProfitVariance) < 0.01,
      );
    }
  }
});

test("cost breakdown reconciles without duplication for every product line", () => {
  const productLines = [...new Set(records.map((row) => row["Product Line"]))];
  for (const productLine of ["All", ...productLines]) {
    const filtered = metrics.filterRecords(records, {
      startMonth: "2025-01",
      endMonth: "2025-12",
      productLine,
    });
    const summary = metrics.aggregate(filtered);
    const breakdown = metrics.costBreakdown(filtered);
    const componentTotal = breakdown.reduce((total, item) => total + item.value, 0);
    const shareTotal = breakdown.reduce((total, item) => total + item.share, 0);
    assert.ok(Math.abs(componentTotal - summary["Actual COGS"]) < 0.01);
    assert.ok(Math.abs(shareTotal - 1) < 1e-12);
  }
});

test("zero revenue and budget return unavailable ratios without infinity", () => {
  const zeroRecord = Object.fromEntries(Object.keys(records[0]).map((key) => [key, 0]));
  zeroRecord.Month = "2025-01";
  zeroRecord["Product Line"] = "Automotive Sensors";
  const result = metrics.aggregate([zeroRecord]);
  const costs = metrics.costBreakdown([zeroRecord]);

  assert.equal(result["Revenue Variance %"], null);
  assert.equal(result["Budget Gross Margin"], null);
  assert.equal(result["Actual Gross Margin"], null);
  assert.equal(result["Gross Margin Variance (pp)"], null);
  assert.ok(costs.every((item) => item.share === null));
  assert.ok(
    Object.values(result).every(
      (value) => typeof value !== "number" || Number.isFinite(value),
    ),
  );
});

test("missing additive values propagate instead of becoming zero", () => {
  const invalid = records.map((record) => ({ ...record }));
  invalid[0]["Actual Revenue"] = null;
  const result = metrics.aggregate(invalid);

  assert.equal(metrics.sum(invalid, "Actual Revenue"), null);
  assert.equal(result["Actual Revenue"], null);
  assert.equal(result["Revenue Variance"], null);
  assert.equal(result["Actual Gross Margin"], null);
});

test("invalid bridge drivers produce unavailable bridge results", () => {
  const invalid = records.map((record) => ({ ...record }));
  invalid[0]["Actual COGS"] = "not-a-number";
  const bridge = metrics.profitBridge(invalid);

  assert.equal(bridge.explainedVariance, null);
  assert.ok(Number.isFinite(bridge.grossProfitVariance));
  assert.ok(bridge.effects.some((effect) => effect.value === null));
});
