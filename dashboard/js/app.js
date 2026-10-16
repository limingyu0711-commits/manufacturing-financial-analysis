(function initializeDashboard() {
  "use strict";

  const data = window.DASHBOARD_DATA;
  const metrics = window.FinanceMetrics;
  const i18n = window.DashboardI18n;
  if (!data || !metrics || !i18n) {
    document.body.innerHTML = "<p>Dashboard data could not be loaded.</p>";
    return;
  }

  const records = data.records;
  const months = [...new Set(records.map((record) => record.Month))].sort();
  const productLines = [...new Set(records.map((record) => record["Product Line"]))].sort();
  let currentLanguage = "en";
  try {
    currentLanguage = i18n.normalizeLanguage(
      window.localStorage.getItem("manufacturingDashboardLanguage"),
    );
  } catch (_error) {
    currentLanguage = "en";
  }

  const elements = Object.fromEntries(
    [
      "start-month",
      "end-month",
      "product-line",
      "reset-filters",
      "selected-period",
      "selected-product",
      "record-count",
      "revenue-kpi",
      "revenue-detail",
      "gross-profit-kpi",
      "gross-profit-detail",
      "gross-margin-kpi",
      "gross-margin-detail",
      "variance-kpi",
      "variance-detail",
      "revenue-chart",
      "cost-donut",
      "cogs-total",
      "cost-legend",
      "product-table-body",
      "bridge-chart",
      "commentary-list",
      "empty-state",
    ].map((id) => [id, document.getElementById(id)]),
  );

  const formatCurrency = (value, compact = true) => {
    if (value === null || !Number.isFinite(value)) return "N/A";
    if (compact) {
      const absolute = Math.abs(value);
      const sign = value < 0 ? "−" : "";
      if (absolute >= 1_000_000) {
        return `${sign}€${(absolute / 1_000_000).toFixed(2)}${currentLanguage === "zh" ? "百万" : "m"}`;
      }
      if (absolute >= 1_000) {
        return `${sign}€${(absolute / 1_000).toFixed(2)}${currentLanguage === "zh" ? "千" : "k"}`;
      }
      return `${sign}€${absolute.toFixed(0)}`;
    }
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "EUR",
      notation: "standard",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value, digits = 1) =>
    value === null || !Number.isFinite(value)
      ? "N/A"
      : `${(value * 100).toFixed(digits)}%`;
  const formatPp = (value) =>
    value === null || !Number.isFinite(value)
      ? "N/A"
      : `${value >= 0 ? "+" : ""}${value.toFixed(1)}${currentLanguage === "zh" ? " 个百分点" : " pp"}`;
  const signedCurrency = (value) =>
    value === null || !Number.isFinite(value)
      ? "N/A"
      : `${value >= 0 ? "+" : "−"}${formatCurrency(Math.abs(value))}`;

  const translate = (key) => i18n.t(currentLanguage, key);
  const monthLabel = (month, short = false) => i18n.monthLabel(currentLanguage, month, short);
  const productLabel = (productLine) => i18n.productLabel(currentLanguage, productLine);
  const costLabel = (label) =>
    translate(
      {
        Material: "material",
        Labor: "labor",
        "Manufacturing overhead": "manufacturingOverhead",
      }[label] || label,
    );
  const effectLabel = (label) =>
    translate(
      {
        Volume: "volume",
        "Product mix": "productMix",
        Price: "price",
        "Unit cost": "unitCost",
      }[label] || label,
    );
  const versusBudget = (value) =>
    currentLanguage === "zh"
      ? `${translate("vsBudget")} ${value}`
      : `${value} ${translate("vsBudget")}`;

  function applyStaticTranslations() {
    document.documentElement.lang = currentLanguage === "zh" ? "zh-CN" : "en";
    document.title = translate("browserTitle");
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = translate(element.dataset.i18n);
    });
    document.querySelector(".language-toggle").setAttribute(
      "aria-label",
      currentLanguage === "zh" ? "语言选择" : "Language selection",
    );
    document.querySelectorAll("[data-language]").forEach((button) => {
      const isSelected = button.dataset.language === currentLanguage;
      button.setAttribute("aria-pressed", String(isSelected));
    });
    elements["start-month"].setAttribute(
      "aria-label",
      currentLanguage === "zh" ? "开始月份" : "Start month",
    );
    elements["end-month"].setAttribute(
      "aria-label",
      currentLanguage === "zh" ? "结束月份" : "End month",
    );
    elements["product-line"].setAttribute(
      "aria-label",
      currentLanguage === "zh" ? "产品线" : "Product line",
    );
    elements["revenue-chart"].setAttribute("aria-label", translate("revenueChartLabel"));
    elements["cost-donut"].setAttribute("aria-label", translate("costChartLabel"));

    [...elements["start-month"].options].forEach((option) => {
      option.textContent =
        currentLanguage === "zh"
          ? `2025年${monthLabel(option.value)}`
          : `${monthLabel(option.value)} 2025`;
    });
    [...elements["end-month"].options].forEach((option) => {
      option.textContent =
        currentLanguage === "zh"
          ? `2025年${monthLabel(option.value)}`
          : `${monthLabel(option.value)} 2025`;
    });
    [...elements["product-line"].options].forEach((option) => {
      option.textContent =
        option.value === "All" ? translate("allProductLines") : productLabel(option.value);
    });
  }

  function populateFilters() {
    months.forEach((month) => {
      const label =
        currentLanguage === "zh" ? `2025年${monthLabel(month)}` : `${monthLabel(month)} 2025`;
      const startOption = new Option(label, month);
      const endOption = new Option(label, month);
      elements["start-month"].add(startOption);
      elements["end-month"].add(endOption);
    });
    elements["start-month"].value = months[0];
    elements["end-month"].value = months.at(-1);

    elements["product-line"].add(new Option(translate("allProductLines"), "All"));
    productLines.forEach((productLine) =>
      elements["product-line"].add(new Option(productLabel(productLine), productLine)),
    );
  }

  function updateKpi(elementId, detailId, value, detail, status) {
    elements[elementId].textContent = value;
    elements[detailId].textContent = detail;
    elements[detailId].classList.remove("favorable", "unfavorable");
    if (status) elements[detailId].classList.add(status);
  }

  function drawRevenueChart(monthly) {
    const svg = elements["revenue-chart"];
    if (!monthly.length) {
      svg.innerHTML = "";
      return;
    }
    if (
      monthly.some(
        (row) =>
          !Number.isFinite(row["Budget Revenue"]) ||
          !Number.isFinite(row["Actual Revenue"]),
      )
    ) {
      svg.innerHTML = '<text x="400" y="150" text-anchor="middle">N/A</text>';
      return;
    }
    const width = 800;
    const height = 300;
    const margin = { top: 20, right: 22, bottom: 42, left: 58 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const maximum = Math.max(...monthly.flatMap((row) => [row["Budget Revenue"], row["Actual Revenue"]])) * 1.12;
    const x = (index) =>
      margin.left + (monthly.length === 1 ? plotWidth / 2 : (index / (monthly.length - 1)) * plotWidth);
    const y = (value) => margin.top + plotHeight - (value / maximum) * plotHeight;
    const line = (field) =>
      monthly.map((row, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(row[field])}`).join(" ");
    const grid = Array.from({ length: 5 }, (_, index) => {
      const value = (maximum / 4) * index;
      const py = y(value);
      return `<line x1="${margin.left}" y1="${py}" x2="${width - margin.right}" y2="${py}" stroke="#dce4eb" stroke-width="1" />
        <text x="${margin.left - 10}" y="${py + 4}" text-anchor="end">${(value / 1_000_000).toFixed(1)}</text>`;
    }).join("");
    const labels = monthly
      .map(
        (row, index) =>
          `<text x="${x(index)}" y="${height - 14}" text-anchor="middle">${monthLabel(row.Month, true)}</text>`,
      )
      .join("");
    const actualPoints = monthly
      .map(
        (row, index) =>
          `<circle cx="${x(index)}" cy="${y(row["Actual Revenue"])}" r="3.5" fill="#d9792b"><title>${monthLabel(row.Month)} ${translate("actual")}: ${formatCurrency(row["Actual Revenue"], false)}</title></circle>`,
      )
      .join("");

    svg.innerHTML = `${grid}${labels}
      <path d="${line("Budget Revenue")}" fill="none" stroke="#3a82b8" stroke-width="2.3" />
      <path d="${line("Actual Revenue")}" fill="none" stroke="#d9792b" stroke-width="3" />
      ${actualPoints}`;
  }

  function drawCostBreakdown(items, totalCogs) {
    const isAvailable =
      Number.isFinite(totalCogs) &&
      items.every((item) => Number.isFinite(item.value) && Number.isFinite(item.share));
    if (!isAvailable) {
      elements["cost-donut"].style.background = "#dce4eb";
      elements["cogs-total"].textContent = "N/A";
      elements["cost-legend"].innerHTML = items
        .map(
          (item) => `<div class="cost-legend-row">
            <i style="background:${item.color}"></i>
            <span>${costLabel(item.label)}</span>
            <strong>N/A</strong>
          </div>`,
        )
        .join("");
      return;
    }
    let cursor = 0;
    const segments = items.map((item) => {
      const start = cursor;
      cursor += (item.share || 0) * 100;
      return `${item.color} ${start}% ${cursor}%`;
    });
    elements["cost-donut"].style.background = `conic-gradient(${segments.join(",")})`;
    elements["cogs-total"].textContent = formatCurrency(totalCogs);
    elements["cost-legend"].innerHTML = items
      .map(
        (item) => `<div class="cost-legend-row">
          <i style="background:${item.color}"></i>
          <span>${costLabel(item.label)}<br><small>${formatPercent(item.share)} ${translate("ofCogs")}</small></span>
          <strong>${formatCurrency(item.value)}</strong>
        </div>`,
      )
      .join("");
  }

  function drawProductTable(products) {
    elements["product-table-body"].innerHTML = products
      .map((product) => {
        const variance = product["Revenue Variance"];
        return `<tr>
          <td>${productLabel(product["Product Line"])}</td>
          <td>${formatCurrency(product["Actual Revenue"])}</td>
          <td class="${variance >= 0 ? "favorable" : "unfavorable"}">${signedCurrency(variance)}</td>
          <td>${formatCurrency(product["Actual Gross Profit"])}</td>
          <td>${formatPercent(product["Actual Gross Margin"], 2)}</td>
        </tr>`;
      })
      .join("");
  }

  function drawBridge(bridge) {
    const finiteValues = bridge.effects
      .map((effect) => effect.value)
      .filter((value) => Number.isFinite(value));
    const maxAbsolute = Math.max(...finiteValues.map((value) => Math.abs(value)), 1);
    elements["bridge-chart"].innerHTML = bridge.effects
      .map((effect) => {
        const isAvailable = Number.isFinite(effect.value);
        const width = isAvailable ? (Math.abs(effect.value) / maxAbsolute) * 48 : 0;
        const direction = effect.value >= 0 ? "positive" : "negative";
        return `<div class="bridge-row">
          <span class="bridge-label">${effectLabel(effect.label)}</span>
          <div class="bridge-track"><div class="bridge-bar ${direction}" style="width:${width}%"></div></div>
          <span class="bridge-value ${isAvailable ? (effect.value >= 0 ? "favorable" : "unfavorable") : ""}">${isAvailable ? `${effect.value >= 0 ? "+" : "−"}${Math.abs(effect.value / 1_000_000).toFixed(2)}` : "N/A"}</span>
        </div>`;
      })
      .join("");
  }

  function updateCommentary(summary, products, bridge) {
    if (
      !Number.isFinite(summary["Revenue Variance %"]) ||
      !Number.isFinite(summary["COGS Variance"]) ||
      !Number.isFinite(summary["Gross Margin Variance (pp)"]) ||
      bridge.effects.some((effect) => !Number.isFinite(effect.value))
    ) {
      elements["commentary-list"].innerHTML = `<article class="commentary-item"><strong>${translate("dataSupported")}</strong><p>${translate("dataUnavailable")}</p></article>`;
      return;
    }
    const revenueStatus = summary["Revenue Variance"] >= 0 ? "above" : "below";
    const costDirection = summary["COGS Variance"] >= 0 ? "above" : "below";
    const marginDirection = summary["Gross Margin Variance (pp)"] >= 0 ? "above" : "below";
    const marginGap = summary["Gross Margin Variance (pp)"];
    const topProduct = [...products].sort(
      (left, right) => right["Actual Gross Margin"] - left["Actual Gross Margin"],
    )[0];
    const primaryEffect = [...bridge.effects].sort(
      (left, right) => Math.abs(right.value) - Math.abs(left.value),
    )[0];
    const marginDifference =
      marginGap === null
        ? "N/A"
        : `${Math.abs(marginGap).toFixed(1)}${currentLanguage === "zh" ? " 个百分点" : " pp"}`;
    const items =
      currentLanguage === "zh"
        ? [
            {
              title: translate("revenuePerformance"),
              text: `实际收入${revenueStatus === "above" ? "高于" : "低于"}预算 ${formatPercent(Math.abs(summary["Revenue Variance %"]))}。该差异反映所选范围内销量与价格的综合影响。`,
            },
            {
              title: translate("marginPerformance"),
              text: `实际销售成本${costDirection === "above" ? "高于" : "低于"}预算，毛利率${marginDirection === "above" ? "高于" : "低于"}预算 ${marginDifference}。`,
            },
            {
              title: translate("operatingDrivers"),
              text: topProduct
                ? `${productLabel(topProduct["Product Line"])}在所选范围内毛利率最高，为 ${formatPercent(topProduct["Actual Gross Margin"], 2)}。${effectLabel(primaryEffect.label)}是毛利差异桥接中绝对金额最大的影响因素。`
                : "当前筛选范围无法进行产品线比较。",
            },
          ]
        : [
            {
              title: translate("revenuePerformance"),
              text: `Actual revenue is ${formatPercent(Math.abs(summary["Revenue Variance %"]))} ${revenueStatus} budget. The variance reflects the selected volume and price results.`,
            },
            {
              title: translate("marginPerformance"),
              text: `Actual COGS is ${costDirection} budget and gross margin is ${marginDifference} ${marginDirection} the budget rate.`,
            },
            {
              title: translate("operatingDrivers"),
              text: topProduct
                ? `${productLabel(topProduct["Product Line"])} has the highest selected gross margin at ${formatPercent(topProduct["Actual Gross Margin"], 2)}. ${effectLabel(primaryEffect.label)} is the largest absolute gross-profit bridge effect.`
                : "Product comparison is unavailable for this selection.",
            },
          ];
    elements["commentary-list"].innerHTML = items
      .map(
        (item) => `<article class="commentary-item"><strong>${item.title}</strong><p>${item.text}</p></article>`,
      )
      .join("");
  }

  function render() {
    const filters = {
      startMonth: elements["start-month"].value,
      endMonth: elements["end-month"].value,
      productLine: elements["product-line"].value,
    };
    if (filters.startMonth > filters.endMonth) {
      elements["end-month"].value = filters.startMonth;
      filters.endMonth = filters.startMonth;
    }
    const filtered = metrics.filterRecords(records, filters);
    const panels = document.querySelectorAll(".kpi-grid, .analysis-grid, .commentary-panel");
    elements["empty-state"].hidden = filtered.length > 0;
    panels.forEach((panel) => {
      panel.hidden = filtered.length === 0;
    });
    if (!filtered.length) return;

    const summary = metrics.aggregate(filtered);
    const monthly = metrics.monthlyAnalysis(filtered);
    const products = metrics.productAnalysis(filtered);
    const costs = metrics.costBreakdown(filtered);
    const bridge = metrics.profitBridge(filtered);
    const revenueStatus = Number.isFinite(summary["Revenue Variance"])
      ? summary["Revenue Variance"] >= 0
        ? "favorable"
        : "unfavorable"
      : null;
    const grossProfitStatus = Number.isFinite(summary["Gross Profit Variance"])
      ? summary["Gross Profit Variance"] >= 0
        ? "favorable"
        : "unfavorable"
      : null;
    const marginStatus = Number.isFinite(summary["Gross Margin Variance (pp)"])
      ? summary["Gross Margin Variance (pp)"] >= 0
        ? "favorable"
        : "unfavorable"
      : null;

    const year = filters.startMonth.slice(0, 4);
    elements["selected-period"].textContent =
      filters.startMonth === filters.endMonth
        ? currentLanguage === "zh"
          ? `${year}年${monthLabel(filters.startMonth)}`
          : `${monthLabel(filters.startMonth)} ${year}`
        : currentLanguage === "zh"
          ? `${year}年${monthLabel(filters.startMonth)}–${monthLabel(filters.endMonth)}`
          : `${monthLabel(filters.startMonth)}–${monthLabel(filters.endMonth)} ${year}`;
    elements["selected-product"].textContent =
      filters.productLine === "All" ? translate("allProductLines") : productLabel(filters.productLine);
    elements["record-count"].textContent =
      currentLanguage === "zh"
        ? `${filtered.length}${translate("records")}`
        : `${filtered.length} ${translate(filtered.length === 1 ? "record" : "records")}`;

    updateKpi(
      "revenue-kpi",
      "revenue-detail",
      formatCurrency(summary["Actual Revenue"]),
      `${versusBudget(signedCurrency(summary["Revenue Variance"]))} (${formatPercent(summary["Revenue Variance %"])})`,
      revenueStatus,
    );
    updateKpi(
      "gross-profit-kpi",
      "gross-profit-detail",
      formatCurrency(summary["Actual Gross Profit"]),
      versusBudget(signedCurrency(summary["Gross Profit Variance"])),
      grossProfitStatus,
    );
    updateKpi(
      "gross-margin-kpi",
      "gross-margin-detail",
      formatPercent(summary["Actual Gross Margin"], 2),
      versusBudget(formatPp(summary["Gross Margin Variance (pp)"])),
      marginStatus,
    );
    updateKpi(
      "variance-kpi",
      "variance-detail",
      signedCurrency(summary["Revenue Variance"]),
      revenueStatus === null
        ? translate("dataUnavailable")
        : translate(
            revenueStatus === "favorable"
              ? "favorableRevenueVariance"
              : "unfavorableRevenueVariance",
          ),
      revenueStatus,
    );

    drawRevenueChart(monthly);
    drawCostBreakdown(costs, summary["Actual COGS"]);
    drawProductTable(products);
    drawBridge(bridge);
    updateCommentary(summary, products, bridge);
  }

  populateFilters();
  applyStaticTranslations();
  [elements["start-month"], elements["end-month"], elements["product-line"]].forEach((element) =>
    element.addEventListener("change", render),
  );
  elements["reset-filters"].addEventListener("click", () => {
    elements["start-month"].value = months[0];
    elements["end-month"].value = months.at(-1);
    elements["product-line"].value = "All";
    render();
  });
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.addEventListener("click", () => {
      currentLanguage = i18n.normalizeLanguage(button.dataset.language);
      try {
        window.localStorage.setItem("manufacturingDashboardLanguage", currentLanguage);
      } catch (_error) {
        // The dashboard remains usable when browser storage is unavailable.
      }
      applyStaticTranslations();
      render();
    });
  });
  render();
})();
