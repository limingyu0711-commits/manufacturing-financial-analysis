import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectRoot = path.resolve(process.cwd());
const payloadPath = path.join(projectRoot, "work", "workbook_payload.json");
const payload = JSON.parse(await fs.readFile(payloadPath, "utf8"));
const dataOutputPath = path.join(
  projectRoot,
  "data",
  "manufacturing_financial_analysis.xlsx",
);
const reviewOutputPath = path.join(
  projectRoot,
  "outputs",
  "manufacturing_financial_analysis.xlsx",
);

const COLORS = {
  navy: "#163A5F",
  blue: "#2F75B5",
  lightBlue: "#DCE6F1",
  lightTan: "#F3E9D2",
  lightGray: "#EEF2F5",
  dark: "#1F2933",
  muted: "#5F6B76",
  white: "#FFFFFF",
  inputBlue: "#0000FF",
  formulaGreen: "#008000",
  errorFill: "#FCE8E6",
  errorText: "#B91C1C",
};
const FONT = "Arial";
const DATA_START_ROW = 6;
const DATA_END_ROW = DATA_START_ROW + payload.data.length - 1;

function columnLetter(index) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function baseSheet(sheet, tabColor) {
  sheet.showGridLines = false;
  sheet.tabColor = tabColor;
}

function setTitle(sheet, title, subtitle, lastColumn) {
  sheet.getRange(`A2:${lastColumn}2`).format.borders = {
    bottom: { style: "medium", color: COLORS.navy },
  };
  sheet.getRange("A2").values = [[title]];
  sheet.getRange("A2").format.font = {
    name: FONT,
    size: 14,
    bold: true,
    color: COLORS.navy,
  };
  sheet.getRange("A3").values = [[subtitle]];
  sheet.getRange(`A3:${lastColumn}3`).format.font = {
    name: FONT,
    size: 10,
    italic: true,
    color: COLORS.muted,
  };
}

function styleHeader(range) {
  range.format = {
    fill: COLORS.navy,
    font: { name: FONT, size: 10, bold: true, color: COLORS.white },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: {
      insideVertical: { style: "thin", color: COLORS.white },
      bottom: { style: "medium", color: COLORS.navy },
    },
  };
}

function applyFormatsByHeader(sheet, headers, startRow, endRow) {
  headers.forEach((header, index) => {
    const letter = columnLetter(index);
    const range = sheet.getRange(`${letter}${startRow}:${letter}${endRow}`);
    if (header === "Month") {
      range.format.horizontalAlignment = "center";
    } else if (
      header.includes("Volume") &&
      !header.includes("Effect") &&
      !header.includes("%")
    ) {
      range.format.numberFormat = "#,##0;(#,##0);-";
    } else if (header.includes("Margin") && !header.includes("Variance (pp)")) {
      range.format.numberFormat = "0.00%;(0.00%);-";
      range.format.font = { name: FONT, size: 9, color: COLORS.dark, italic: true };
    } else if (header.includes("%")) {
      range.format.numberFormat = "0.0%;(0.0%);-";
    } else if (
      header.includes("Price") ||
      header.includes("Cost") ||
      header.includes("Revenue") ||
      header.includes("Profit") ||
      header.includes("COGS") ||
      header.includes("Effect") ||
      header.includes("Variance") ||
      header === "Budget" ||
      header === "Actual"
    ) {
      range.format.numberFormat = "€#,##0.00;(€#,##0.00);-";
    }
  });
}

function writeFormulaTable(sheet, startRow, headers, keyValues, formulas, tableName) {
  const lastColumn = columnLetter(headers.length - 1);
  const endRow = startRow + keyValues.length;
  sheet.getRange(`A${startRow}:${lastColumn}${startRow}`).values = [headers];
  styleHeader(sheet.getRange(`A${startRow}:${lastColumn}${startRow}`));
  sheet.getRange(`A${startRow + 1}`).write(keyValues.map((value) => [value]));
  sheet.getRange(
    `B${startRow + 1}:${lastColumn}${endRow}`,
  ).formulas = formulas.map((row) => row.slice(1));
  const table = sheet.tables.add(
    `A${startRow}:${lastColumn}${endRow}`,
    true,
    tableName,
  );
  table.style = "TableStyleMedium2";
  table.showBandedRows = true;
  sheet.getRange(`A${startRow}:${lastColumn}${endRow}`).format.font = {
    name: FONT,
    size: 9,
    color: COLORS.dark,
  };
  styleHeader(sheet.getRange(`A${startRow}:${lastColumn}${startRow}`));
  return { endRow, lastColumn };
}

const workbook = Workbook.create();
const summarySheet = workbook.worksheets.add("Summary");
const monthlySheet = workbook.worksheets.add("Monthly Analysis");
const productSheet = workbook.worksheets.add("Product Analysis");
const bridgeSheet = workbook.worksheets.add("GP Bridge");
const dataSheet = workbook.worksheets.add("Data");
const auditSheet = workbook.worksheets.add("Audit");

baseSheet(summarySheet, COLORS.navy);
baseSheet(monthlySheet, COLORS.blue);
baseSheet(productSheet, COLORS.blue);
baseSheet(bridgeSheet, "#5B7F66");
baseSheet(dataSheet, "#C9AD7F");
baseSheet(auditSheet, "#7F8C8D");

// Detailed source and formula build.
const dataHeaders = Object.keys(payload.data[0]);
const inputHeaders = dataHeaders.slice(0, 15);
const dataLastColumn = columnLetter(dataHeaders.length - 1);
setTitle(
  dataSheet,
  "Detailed Financial Dataset",
  "Blue values are editable drivers; black cells are Excel formulas | Synthetic Data / Simulated Company | EUR",
  dataLastColumn,
);
dataSheet.getRange(`A5:${dataLastColumn}5`).values = [dataHeaders];
styleHeader(dataSheet.getRange(`A5:${dataLastColumn}5`));
dataSheet.getRange("A6").write(
  payload.data.map((record) => inputHeaders.map((header) => record[header])),
);

const dataFormulaRows = payload.data.map((_, index) => {
  const row = DATA_START_ROW + index;
  return [
    `=IF(COUNT(F${row},H${row})<2,"",F${row}*H${row})`,
    `=IF(COUNT(J${row},L${row},N${row})<3,"",SUM(J${row},L${row},N${row}))`,
    `=IF(COUNT(F${row},J${row})<2,"",F${row}*J${row})`,
    `=IF(COUNT(F${row},L${row})<2,"",F${row}*L${row})`,
    `=IF(COUNT(F${row},N${row})<2,"",F${row}*N${row})`,
    `=IF(COUNT(R${row}:T${row})<3,"",SUM(R${row}:T${row}))`,
    `=IF(COUNT(P${row},U${row})<2,"",P${row}-U${row})`,
    `=IF(OR(P${row}="",P${row}=0,V${row}=""),"",V${row}/P${row})`,
    `=IF(COUNT(G${row},I${row})<2,"",G${row}*I${row})`,
    `=IF(COUNT(K${row},M${row},O${row})<3,"",SUM(K${row},M${row},O${row}))`,
    `=IF(COUNT(G${row},K${row})<2,"",G${row}*K${row})`,
    `=IF(COUNT(G${row},M${row})<2,"",G${row}*M${row})`,
    `=IF(COUNT(G${row},O${row})<2,"",G${row}*O${row})`,
    `=IF(COUNT(Z${row}:AB${row})<3,"",SUM(Z${row}:AB${row}))`,
    `=IF(COUNT(X${row},AC${row})<2,"",X${row}-AC${row})`,
    `=IF(OR(X${row}="",X${row}=0,AD${row}=""),"",AD${row}/X${row})`,
    `=IF(COUNT(F${row},G${row})<2,"",G${row}-F${row})`,
    `=IF(OR(F${row}="",F${row}=0,AF${row}=""),"",AF${row}/ABS(F${row}))`,
    `=IF(COUNT(P${row},X${row})<2,"",X${row}-P${row})`,
    `=IF(OR(P${row}="",P${row}=0,AH${row}=""),"",AH${row}/ABS(P${row}))`,
    `=IF(COUNT(U${row},AC${row})<2,"",AC${row}-U${row})`,
    `=IF(OR(U${row}="",U${row}=0,AJ${row}=""),"",AJ${row}/ABS(U${row}))`,
    `=IF(COUNT(V${row},AD${row})<2,"",AD${row}-V${row})`,
    `=IF(OR(V${row}="",V${row}=0,AL${row}=""),"",AL${row}/ABS(V${row}))`,
    `=IF(OR(W${row}="",AE${row}=""),"",(AE${row}-W${row})*100)`,
    `=IF(COUNT(F${row},G${row},H${row})<3,"",(G${row}-F${row})*H${row})`,
    `=IF(COUNT(G${row},H${row},I${row})<3,"",G${row}*(I${row}-H${row}))`,
  ];
});
dataSheet.getRange(`P6:${dataLastColumn}${DATA_END_ROW}`).formulas = dataFormulaRows;
const dataTable = dataSheet.tables.add(
  `A5:${dataLastColumn}${DATA_END_ROW}`,
  true,
  "FinancialDataTable",
);
dataTable.style = "TableStyleMedium2";
dataTable.showBandedRows = true;
dataSheet.getRange(`A5:${dataLastColumn}${DATA_END_ROW}`).format.font = {
  name: FONT,
  size: 9,
  color: COLORS.dark,
};
dataSheet.getRange(`F6:O${DATA_END_ROW}`).format.font = {
  name: FONT,
  size: 9,
  color: COLORS.inputBlue,
};
dataSheet.getRange(`P6:${dataLastColumn}${DATA_END_ROW}`).format.font = {
  name: FONT,
  size: 9,
  color: COLORS.dark,
};
styleHeader(dataSheet.getRange(`A5:${dataLastColumn}5`));
applyFormatsByHeader(dataSheet, dataHeaders, DATA_START_ROW, DATA_END_ROW);
dataSheet.freezePanes.freezeRows(5);
dataSheet.freezePanes.freezeColumns(2);
dataSheet.getRange(`A5:${dataLastColumn}${DATA_END_ROW}`).format.autofitColumns();
dataSheet.getRange("A:A").format.columnWidth = 12;
dataSheet.getRange("B:B").format.columnWidth = 31;
dataSheet.getRange("D:E").format.columnWidth = 18;

// Summary output.
setTitle(
  summarySheet,
  "Manufacturing Financial Analysis",
  "Formula-driven Budget vs Actual summary | Synthetic Data / Simulated Company | 2025 | EUR",
  "G",
);
summarySheet.getRange("A5:G5").values = [[
  "Metric",
  "Budget",
  "Actual",
  "Variance",
  "Variance %",
  "Unit",
  "Interpretation",
]];
styleHeader(summarySheet.getRange("A5:G5"));
summarySheet.getRange("A6:A9").values = [
  ["Revenue"],
  ["COGS"],
  ["Gross Profit"],
  ["Gross Margin"],
];
summarySheet.getRange("F6:G9").values = [
  ["EUR", "Higher is favorable"],
  ["EUR", "Higher is unfavorable"],
  ["EUR", "Higher is favorable"],
  ["% / pp variance", "Positive percentage-point variance is favorable"],
];
summarySheet.getRange("B6:E9").formulas = [
  [
    `=SUM(Data!P${DATA_START_ROW}:P${DATA_END_ROW})`,
    `=SUM(Data!X${DATA_START_ROW}:X${DATA_END_ROW})`,
    "=C6-B6",
    '=IF(B6=0,"",D6/ABS(B6))',
  ],
  [
    `=SUM(Data!U${DATA_START_ROW}:U${DATA_END_ROW})`,
    `=SUM(Data!AC${DATA_START_ROW}:AC${DATA_END_ROW})`,
    "=C7-B7",
    '=IF(B7=0,"",D7/ABS(B7))',
  ],
  [
    `=SUM(Data!V${DATA_START_ROW}:V${DATA_END_ROW})`,
    `=SUM(Data!AD${DATA_START_ROW}:AD${DATA_END_ROW})`,
    "=C8-B8",
    '=IF(B8=0,"",D8/ABS(B8))',
  ],
  [
    '=IF(B6=0,"",B8/B6)',
    '=IF(C6=0,"",C8/C6)',
    '=IF(OR(B9="",C9=""),"",(C9-B9)*100)',
    '=""',
  ],
];
summarySheet.getRange("A6:G9").format.font = { name: FONT, size: 10, color: COLORS.dark };
summarySheet.getRange("B6:D8").format.numberFormat = "€#,##0;(€#,##0);-";
summarySheet.getRange("E6:E8").format.numberFormat = "0.0%;(0.0%);-";
summarySheet.getRange("B9:C9").format.numberFormat = "0.00%;(0.00%);-";
summarySheet.getRange("D9").format.numberFormat = '0.00 "pp";(0.00 "pp");-';
summarySheet.getRange("A9:G9").format.font = {
  name: FONT,
  size: 10,
  color: COLORS.dark,
  italic: true,
};
summarySheet.getRange("A6:G9").format.borders = {
  bottom: { style: "thin", color: "#D9E1E8" },
};
summarySheet.getRange("A12:G12").values = [[
  "Model guidance",
  null,
  null,
  null,
  null,
  null,
  null,
]];
summarySheet.getRange("A12:G12").format = {
  fill: COLORS.lightBlue,
  font: { name: FONT, size: 10, bold: true, color: COLORS.navy },
  borders: { preset: "outside", style: "thin", color: "#B4C7DC" },
};
summarySheet.getRange("A13:G15").values = [
  ["Inputs", "Edit the blue volume, price and unit-cost cells on the Data sheet.", null, null, null, null, null],
  ["Calculations", "Revenue, COGS, Gross Profit, Gross Margin and variances are calculated with Excel formulas.", null, null, null, null, null],
  ["Precision", "Gross Margin uses aggregated Gross Profit divided by aggregated Revenue and displays two decimals.", null, null, null, null, null],
];
summarySheet.getRange("A13:A15").format.font = {
  name: FONT,
  size: 10,
  bold: true,
  color: COLORS.navy,
};
summarySheet.getRange("B13:G15").format.font = { name: FONT, size: 10, color: COLORS.dark };
summarySheet.getRange("B13:G15").format.wrapText = false;
summarySheet.getRange("A13:G15").format.borders = {
  bottom: { style: "thin", color: "#D9E1E8" },
};
summarySheet.getRange("A1:G15").format.verticalAlignment = "center";
summarySheet.getRange("A:A").format.columnWidth = 22;
summarySheet.getRange("B:E").format.columnWidth = 16;
summarySheet.getRange("F:F").format.columnWidth = 18;
summarySheet.getRange("G:G").format.columnWidth = 38;
summarySheet.getRange("13:15").format.rowHeight = 20;

// Monthly analysis formulas.
const monthlyHeaders = Object.keys(payload.monthly[0]);
const monthlyKeyValues = payload.monthly.map((row) => row.Month);
const dataColumnByHeader = new Map(dataHeaders.map((header, index) => [header, columnLetter(index)]));
const monthlyColumnByHeader = new Map(
  monthlyHeaders.map((header, index) => [header, columnLetter(index)]),
);
const monthlyAdditive = new Set([
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
]);
const monthlyFormulaRows = monthlyKeyValues.map((_, index) => {
  const row = 6 + index;
  return monthlyHeaders.map((header) => {
    if (header === "Month") return "";
    if (monthlyAdditive.has(header)) {
      const sourceColumn = dataColumnByHeader.get(header);
      return `=SUMIFS(Data!$${sourceColumn}$${DATA_START_ROW}:$${sourceColumn}$${DATA_END_ROW},Data!$A$${DATA_START_ROW}:$A$${DATA_END_ROW},$A${row})`;
    }
    const ref = (name) => `${monthlyColumnByHeader.get(name)}${row}`;
    const formulas = {
      "Revenue Variance": `=${ref("Actual Revenue")}-${ref("Budget Revenue")}`,
      "Revenue Variance %": `=IF(${ref("Budget Revenue")}=0,"",${ref("Revenue Variance")}/ABS(${ref("Budget Revenue")}))`,
      "COGS Variance": `=${ref("Actual COGS")}-${ref("Budget COGS")}`,
      "COGS Variance %": `=IF(${ref("Budget COGS")}=0,"",${ref("COGS Variance")}/ABS(${ref("Budget COGS")}))`,
      "Gross Profit Variance": `=${ref("Actual Gross Profit")}-${ref("Budget Gross Profit")}`,
      "Gross Profit Variance %": `=IF(${ref("Budget Gross Profit")}=0,"",${ref("Gross Profit Variance")}/ABS(${ref("Budget Gross Profit")}))`,
      "Budget Gross Margin": `=IF(${ref("Budget Revenue")}=0,"",${ref("Budget Gross Profit")}/${ref("Budget Revenue")})`,
      "Actual Gross Margin": `=IF(${ref("Actual Revenue")}=0,"",${ref("Actual Gross Profit")}/${ref("Actual Revenue")})`,
      "Gross Margin Variance (pp)": `=IF(OR(${ref("Budget Gross Margin")}="",${ref("Actual Gross Margin")}=""),"",(${ref("Actual Gross Margin")}-${ref("Budget Gross Margin")})*100)`,
      "Actual Revenue Growth %": index === 0
        ? '=""'
        : `=IF(${monthlyColumnByHeader.get("Actual Revenue")}${row - 1}=0,"",${ref("Actual Revenue")}/${monthlyColumnByHeader.get("Actual Revenue")}${row - 1}-1)`,
    };
    return formulas[header] || '=""';
  });
});
setTitle(
  monthlySheet,
  "Monthly Financial Analysis",
  "Formula-driven Budget vs Actual performance by month | Synthetic Data / Simulated Company | EUR",
  columnLetter(monthlyHeaders.length - 1),
);
const monthlyTable = writeFormulaTable(
  monthlySheet,
  5,
  monthlyHeaders,
  monthlyKeyValues,
  monthlyFormulaRows,
  "MonthlyAnalysisTable",
);
applyFormatsByHeader(monthlySheet, monthlyHeaders, 6, monthlyTable.endRow);
monthlySheet.freezePanes.freezeRows(5);
monthlySheet.freezePanes.freezeColumns(1);
monthlySheet
  .getRange(`A5:${monthlyTable.lastColumn}${monthlyTable.endRow}`)
  .format.autofitColumns();
monthlySheet.getRange("A:A").format.columnWidth = 12;

// Product analysis formulas.
const productHeaders = Object.keys(payload.product[0]);
const productKeyValues = payload.product.map((row) => row["Product Line"]);
const productColumnByHeader = new Map(
  productHeaders.map((header, index) => [header, columnLetter(index)]),
);
const productFormulaRows = productKeyValues.map((_, index) => {
  const row = 6 + index;
  return productHeaders.map((header) => {
    if (header === "Product Line") return "";
    if (monthlyAdditive.has(header)) {
      const sourceColumn = dataColumnByHeader.get(header);
      return `=SUMIFS(Data!$${sourceColumn}$${DATA_START_ROW}:$${sourceColumn}$${DATA_END_ROW},Data!$B$${DATA_START_ROW}:$B$${DATA_END_ROW},$A${row})`;
    }
    const ref = (name) => `${productColumnByHeader.get(name)}${row}`;
    const formulas = {
      "Revenue Variance": `=${ref("Actual Revenue")}-${ref("Budget Revenue")}`,
      "Revenue Variance %": `=IF(${ref("Budget Revenue")}=0,"",${ref("Revenue Variance")}/ABS(${ref("Budget Revenue")}))`,
      "COGS Variance": `=${ref("Actual COGS")}-${ref("Budget COGS")}`,
      "COGS Variance %": `=IF(${ref("Budget COGS")}=0,"",${ref("COGS Variance")}/ABS(${ref("Budget COGS")}))`,
      "Gross Profit Variance": `=${ref("Actual Gross Profit")}-${ref("Budget Gross Profit")}`,
      "Gross Profit Variance %": `=IF(${ref("Budget Gross Profit")}=0,"",${ref("Gross Profit Variance")}/ABS(${ref("Budget Gross Profit")}))`,
      "Budget Gross Margin": `=IF(${ref("Budget Revenue")}=0,"",${ref("Budget Gross Profit")}/${ref("Budget Revenue")})`,
      "Actual Gross Margin": `=IF(${ref("Actual Revenue")}=0,"",${ref("Actual Gross Profit")}/${ref("Actual Revenue")})`,
      "Gross Margin Variance (pp)": `=IF(OR(${ref("Budget Gross Margin")}="",${ref("Actual Gross Margin")}=""),"",(${ref("Actual Gross Margin")}-${ref("Budget Gross Margin")})*100)`,
      "Actual Material Cost % of COGS": `=IF(${ref("Actual COGS")}=0,"",${ref("Actual Material Cost")}/${ref("Actual COGS")})`,
      "Actual Labor Cost % of COGS": `=IF(${ref("Actual COGS")}=0,"",${ref("Actual Labor Cost")}/${ref("Actual COGS")})`,
      "Actual Overhead % of COGS": `=IF(${ref("Actual COGS")}=0,"",${ref("Actual Manufacturing Overhead")}/${ref("Actual COGS")})`,
      "Actual Revenue Mix %": `=IF(SUM(${productColumnByHeader.get("Actual Revenue")}$6:${productColumnByHeader.get("Actual Revenue")}$8)=0,"",${ref("Actual Revenue")}/SUM(${productColumnByHeader.get("Actual Revenue")}$6:${productColumnByHeader.get("Actual Revenue")}$8))`,
    };
    return formulas[header] || '=""';
  });
});
setTitle(
  productSheet,
  "Product-Line Performance",
  "Formula-driven revenue, cost and profitability comparison | Synthetic Data / Simulated Company | EUR",
  columnLetter(productHeaders.length - 1),
);
const productTable = writeFormulaTable(
  productSheet,
  5,
  productHeaders,
  productKeyValues,
  productFormulaRows,
  "ProductAnalysisTable",
);
applyFormatsByHeader(productSheet, productHeaders, 6, productTable.endRow);
productSheet.freezePanes.freezeRows(5);
productSheet.freezePanes.freezeColumns(1);
productSheet
  .getRange(`A5:${productTable.lastColumn}${productTable.endRow}`)
  .format.autofitColumns();
productSheet.getRange("A:A").format.columnWidth = 31;

// Company and product-line gross-profit bridges.
setTitle(
  bridgeSheet,
  "Gross Profit Variance Bridge",
  "Company portfolio bridge includes mix; each product line reconciles without a mix allocation | EUR",
  "S",
);
const bridgeHeaders = [
  "Analysis Level",
  "Product Line",
  "Budget Volume",
  "Actual Volume",
  "Budget Revenue",
  "Actual Revenue",
  "Budget COGS",
  "Actual COGS",
  "Budget Gross Profit",
  "Actual Gross Profit",
  "Volume Effect",
  "Mix Effect",
  "Price Effect",
  "Unit Cost Effect",
  "Explained GP Variance",
  "Actual GP Variance",
  "Difference",
  "Scope Note",
  "Company Mix Contribution",
];
bridgeSheet.getRange("A5:S5").values = [bridgeHeaders];
styleHeader(bridgeSheet.getRange("A5:S5"));
bridgeSheet.getRange("A6:B6").values = [["Company", "All Product Lines"]];
bridgeSheet.getRange("A10:B12").values = productKeyValues.map((name) => [
  "Product Line",
  name,
]);
for (const row of [10, 11, 12]) {
  bridgeSheet.getRange(`C${row}:J${row}`).formulas = [[
    `=SUMIFS(Data!$F$${DATA_START_ROW}:$F$${DATA_END_ROW},Data!$B$${DATA_START_ROW}:$B$${DATA_END_ROW},$B${row})`,
    `=SUMIFS(Data!$G$${DATA_START_ROW}:$G$${DATA_END_ROW},Data!$B$${DATA_START_ROW}:$B$${DATA_END_ROW},$B${row})`,
    `=SUMIFS(Data!$P$${DATA_START_ROW}:$P$${DATA_END_ROW},Data!$B$${DATA_START_ROW}:$B$${DATA_END_ROW},$B${row})`,
    `=SUMIFS(Data!$X$${DATA_START_ROW}:$X$${DATA_END_ROW},Data!$B$${DATA_START_ROW}:$B$${DATA_END_ROW},$B${row})`,
    `=SUMIFS(Data!$U$${DATA_START_ROW}:$U$${DATA_END_ROW},Data!$B$${DATA_START_ROW}:$B$${DATA_END_ROW},$B${row})`,
    `=SUMIFS(Data!$AC$${DATA_START_ROW}:$AC$${DATA_END_ROW},Data!$B$${DATA_START_ROW}:$B$${DATA_END_ROW},$B${row})`,
    `=SUMIFS(Data!$V$${DATA_START_ROW}:$V$${DATA_END_ROW},Data!$B$${DATA_START_ROW}:$B$${DATA_END_ROW},$B${row})`,
    `=SUMIFS(Data!$AD$${DATA_START_ROW}:$AD$${DATA_END_ROW},Data!$B$${DATA_START_ROW}:$B$${DATA_END_ROW},$B${row})`,
  ]];
  bridgeSheet.getRange(`K${row}:S${row}`).formulas = [[
    `=IF(C${row}=0,"",(D${row}-C${row})*(I${row}/C${row}))`,
    '=""',
    `=IF(OR(C${row}=0,D${row}=0),"",D${row}*(F${row}/D${row}-E${row}/C${row}))`,
    `=IF(OR(C${row}=0,D${row}=0),"",-D${row}*(H${row}/D${row}-G${row}/C${row}))`,
    `=IF(COUNT(K${row},M${row},N${row})<3,"",SUM(K${row},M${row},N${row}))`,
    `=J${row}-I${row}`,
    `=IF(OR(O${row}="",P${row}=""),"",O${row}-P${row})`,
    '="Mix is not applicable at a single-product level."',
    `=IF(OR($C$6=0,$D$6=0,C${row}=0),"",$D$6*(D${row}/$D$6-C${row}/$C$6)*(I${row}/C${row}))`,
  ]];
}
bridgeSheet.getRange("C6:J6").formulas = [[
  "=SUM(C10:C12)",
  "=SUM(D10:D12)",
  "=SUM(E10:E12)",
  "=SUM(F10:F12)",
  "=SUM(G10:G12)",
  "=SUM(H10:H12)",
  "=SUM(I10:I12)",
  "=SUM(J10:J12)",
]];
bridgeSheet.getRange("K6:S6").formulas = [[
  '=IF(C6=0,"",(D6-C6)*(I6/C6))',
  "=SUM(S10:S12)",
  "=SUM(M10:M12)",
  "=SUM(N10:N12)",
  '=IF(COUNT(K6:N6)<4,"",SUM(K6:N6))',
  "=J6-I6",
  '=IF(OR(O6="",P6=""),"",O6-P6)',
  '="Company portfolio bridge; mix is measured across product lines."',
  '=""',
]];
bridgeSheet.getRange("A6:S6").format = {
  fill: COLORS.lightBlue,
  font: { name: FONT, size: 9, bold: true, color: COLORS.dark },
  borders: { bottom: { style: "thin", color: "#B4C7DC" } },
};
bridgeSheet.getRange("A10:S12").format.font = { name: FONT, size: 9, color: COLORS.dark };
bridgeSheet.getRange("A10:S12").format.borders = {
  bottom: { style: "thin", color: "#D9E1E8" },
};
bridgeSheet.getRange("C6:D12").format.numberFormat = "#,##0;(#,##0);-";
bridgeSheet.getRange("E6:Q12").format.numberFormat = "€#,##0.00;(€#,##0.00);-";
bridgeSheet.getRange("A:A").format.columnWidth = 15;
bridgeSheet.getRange("B:B").format.columnWidth = 31;
bridgeSheet.getRange("C:Q").format.columnWidth = 16;
bridgeSheet.getRange("R:R").format.columnWidth = 52;
bridgeSheet.getRange("S:S").format.columnWidth = 20;
bridgeSheet.getRange("R6:R12").format.wrapText = true;
bridgeSheet.freezePanes.freezeRows(5);
bridgeSheet.freezePanes.freezeColumns(2);

// Formula-driven audit.
setTitle(
  auditSheet,
  "Financial Integrity Checks",
  "Terminal controls; no calculation or output depends on this sheet",
  "E",
);
auditSheet.getRange("A5:E5").values = [["Check", "Result", "Tolerance", "Status", "Scope"]];
styleHeader(auditSheet.getRange("A5:E5"));
auditSheet.getRange("A6:A12").values = [
  ["Expected row count"],
  ["Duplicate month/product keys"],
  ["Missing input drivers"],
  ["Revenue formula difference"],
  ["COGS formula difference"],
  ["Gross Profit formula difference"],
  ["Gross Profit bridge difference"],
];
auditSheet.getRange("B6:B12").formulas = [
  [`=COUNTA(Data!A${DATA_START_ROW}:A${DATA_END_ROW})-36`],
  [`=SUMPRODUCT((COUNTIFS(Data!$A$${DATA_START_ROW}:$A$${DATA_END_ROW},Data!$A$${DATA_START_ROW}:$A$${DATA_END_ROW},Data!$B$${DATA_START_ROW}:$B$${DATA_END_ROW},Data!$B$${DATA_START_ROW}:$B$${DATA_END_ROW})>1)*1)`],
  [`=COUNTBLANK(Data!F${DATA_START_ROW}:O${DATA_END_ROW})`],
  [`=SUM(Data!P${DATA_START_ROW}:P${DATA_END_ROW})-SUMPRODUCT(Data!F${DATA_START_ROW}:F${DATA_END_ROW},Data!H${DATA_START_ROW}:H${DATA_END_ROW})`],
  [`=SUM(Data!U${DATA_START_ROW}:U${DATA_END_ROW})-SUM(Data!R${DATA_START_ROW}:T${DATA_END_ROW})`],
  [`=SUM(Data!V${DATA_START_ROW}:V${DATA_END_ROW})-SUM(Data!P${DATA_START_ROW}:P${DATA_END_ROW})+SUM(Data!U${DATA_START_ROW}:U${DATA_END_ROW})`],
  ["='GP Bridge'!Q6"],
];
auditSheet.getRange("C6:C12").values = [[0], [0], [0], [0.01], [0.01], [0.01], [0.01]];
auditSheet.getRange("D6:D12").formulas = Array.from({ length: 7 }, (_, index) => {
  const row = 6 + index;
  return [`=IF(ABS(B${row})<=C${row},"PASS","FAIL")`];
});
auditSheet.getRange("E6:E12").values = [
  ["12 months × 3 product lines"],
  ["Detailed dataset"],
  ["Editable driver cells"],
  ["All Budget and Actual rows"],
  ["All Budget and Actual rows"],
  ["All Budget and Actual rows"],
  ["Company portfolio bridge"],
];
auditSheet.getRange("A6:E12").format.font = { name: FONT, size: 10, color: COLORS.dark };
auditSheet.getRange("B6:C12").format.numberFormat = "0.00;(0.00);-";
auditSheet.getRange("A6:E12").format.borders = {
  bottom: { style: "thin", color: "#D9E1E8" },
};
auditSheet.getRange("D6:D12").conditionalFormats.addCustom('=D6="FAIL"', {
  fill: COLORS.errorFill,
  font: { bold: true, color: COLORS.errorText },
});
auditSheet.getRange("A:A").format.columnWidth = 36;
auditSheet.getRange("B:C").format.columnWidth = 14;
auditSheet.getRange("D:D").format.columnWidth = 12;
auditSheet.getRange("E:E").format.columnWidth = 30;

// Prove that an editable driver updates linked outputs, then restore it.
workbook.recalculate();
const baseRevenue = summarySheet.getRange("C6").values[0][0];
const originalVolume = dataSheet.getRange("G6").values[0][0];
const actualPrice = dataSheet.getRange("I6").values[0][0];
dataSheet.getRange("G6").values = [[originalVolume + 100]];
workbook.recalculate();
const changedRevenue = summarySheet.getRange("C6").values[0][0];
const expectedRevenue = baseRevenue + 100 * actualPrice;
if (Math.abs(changedRevenue - expectedRevenue) > 0.01) {
  throw new Error("Excel model sensitivity check failed: Actual Revenue did not update.");
}
dataSheet.getRange("G6").values = [[originalVolume]];
workbook.recalculate();

const summaryCheck = await workbook.inspect({
  kind: "table",
  sheetId: summarySheet.name,
  range: "A2:G15",
  include: "values,formulas",
  tableMaxRows: 20,
  tableMaxCols: 8,
});
console.log(summaryCheck.ndjson);

const bridgeCheck = await workbook.inspect({
  kind: "table",
  sheetId: bridgeSheet.name,
  range: "A5:S12",
  include: "values,formulas",
  tableMaxRows: 12,
  tableMaxCols: 19,
});
console.log(bridgeCheck.ndjson);

const errorCheck = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 200 },
  summary: "final formula error scan",
});
console.log(errorCheck.ndjson);

await fs.mkdir(path.dirname(dataOutputPath), { recursive: true });
await fs.mkdir(path.dirname(reviewOutputPath), { recursive: true });
await fs.mkdir(path.join(projectRoot, "work"), { recursive: true });
const preview = await workbook.render({
  sheetName: "Summary",
  range: "A1:G15",
  scale: 1.5,
  format: "png",
});
await fs.writeFile(
  path.join(projectRoot, "work", "workbook_summary_preview.png"),
  new Uint8Array(await preview.arrayBuffer()),
);
for (const [sheetName, range, fileName] of [
  ["Monthly Analysis", "A1:AA17", "verify_monthly.png"],
  ["Product Analysis", "A1:AF8", "verify_product.png"],
  ["GP Bridge", "A1:S12", "verify_bridge.png"],
  ["Data", "A1:AP15", "verify_data.png"],
  ["Audit", "A1:E12", "verify_audit.png"],
]) {
  const image = await workbook.render({ sheetName, range, scale: 0.8, format: "png" });
  await fs.writeFile(
    path.join(projectRoot, "work", fileName),
    new Uint8Array(await image.arrayBuffer()),
  );
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(dataOutputPath);
await fs.copyFile(dataOutputPath, reviewOutputPath);
console.log(`Saved ${dataOutputPath}`);
