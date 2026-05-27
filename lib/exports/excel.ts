// Build an Excel workbook for a client export (Summary, Transactions, Budget).

import ExcelJS from "exceljs";

import type { ClientExportData } from "@/lib/data/client-export";

const GBP_FMT = '"£"#,##0';
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF2D2D2D" },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFDFBF7" },
};

export async function buildClientExcel(
  data: ClientExportData,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "OnForm Internal Tool";
  wb.created = new Date();

  buildSummarySheet(wb, data);
  buildTransactionsSheet(wb, data);
  buildBudgetSheet(wb, data);

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function buildSummarySheet(wb: ExcelJS.Workbook, data: ClientExportData) {
  const ws = wb.addWorksheet("Summary");
  ws.columns = [{ width: 28 }, { width: 22 }];

  const { client, pl, runway } = data;
  const period = pl ? formatMonth(pl.period_month) : "—";

  const rows: [string, string | number][] = [
    ["Client", client.client_name],
    ["Industry", client.industry ?? "—"],
    ["Status", client.status],
    ["Report period", period],
    ["", ""],
    ["Annual revenue", client.annual_revenue],
    ["Monthly revenue", pl?.revenue ?? "—"],
    ["COGS", pl?.cogs ?? "—"],
    ["Gross profit", pl?.gross_profit ?? "—"],
    ["Operating expenses", pl?.operating_expenses ?? "—"],
    ["EBITDA", pl?.ebitda ?? "—"],
    ["EBITDA margin %", pl ? pl.ebitda_margin_percent : "—"],
    ["", ""],
    ["Cash on hand", runway?.current_cash ?? "—"],
    ["Cash as of", runway ? formatShortDate(runway.cash_as_of) : "—"],
    ["Avg monthly revenue", runway?.avg_revenue ?? "—"],
    ["Avg monthly burn", runway?.avg_burn ?? "—"],
    ["Net monthly cashflow", runway?.net_monthly_cashflow ?? "—"],
    ["Runway category", runway ? formatRunway(runway.runway_category) : "—"],
  ];

  ws.getCell("A1").value = "OnForm — Client Report";
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A2").value = `Generated ${new Date().toLocaleString("en-GB")}`;
  ws.getCell("A2").font = { italic: true, size: 10, color: { argb: "FF666666" } };

  let rowNum = 4;
  for (const [label, value] of rows) {
    const labelCell = ws.getCell(`A${rowNum}`);
    const valueCell = ws.getCell(`B${rowNum}`);
    labelCell.value = label;
    valueCell.value = value;

    if (typeof value === "number") {
      valueCell.numFmt = GBP_FMT;
    }
    if (label === "EBITDA margin %" && typeof value === "number") {
      valueCell.numFmt = "0.0%";
      valueCell.value = value / 100;
    }

    if (label) {
      labelCell.font = { bold: true };
    }
    rowNum++;
  }
}

function buildTransactionsSheet(wb: ExcelJS.Workbook, data: ClientExportData) {
  const ws = wb.addWorksheet("Transactions");
  ws.columns = [
    { width: 14 },
    { width: 12 },
    { width: 22 },
    { width: 18 },
    { width: 14 },
    { width: 12 },
  ];

  const headers = ["Date", "Type", "Category", "Subcategory", "Amount", "Source"];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  for (const tx of data.transactions) {
    const row = ws.addRow([
      formatShortDate(tx.transaction_date),
      tx.type,
      tx.category,
      tx.subcategory ?? "",
      tx.amount,
      tx.source ?? "",
    ]);
    row.getCell(5).numFmt = GBP_FMT;
  }

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, data.transactions.length), column: 6 },
  };
}

function buildBudgetSheet(wb: ExcelJS.Workbook, data: ClientExportData) {
  const ws = wb.addWorksheet("Budget vs Actual");
  ws.columns = [
    { width: 14 },
    { width: 22 },
    { width: 18 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
  ];

  const headers = [
    "Period",
    "Category",
    "Subcategory",
    "Budget",
    "Actual",
    "Variance",
    "Status",
  ];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  for (const row of data.budgetVariance) {
    const excelRow = ws.addRow([
      formatShortDate(row.period_month),
      row.category,
      row.subcategory ?? "",
      row.budget_amount,
      row.actual_amount,
      row.variance_amount,
      row.status.replace(/_/g, " "),
    ]);
    for (const col of [4, 5, 6]) {
      excelRow.getCell(col).numFmt = GBP_FMT;
    }
  }

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, data.budgetVariance.length), column: 7 },
  };
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
  });
  row.height = 18;
}

function formatMonth(yyyymmdd: string): string {
  const d = new Date(yyyymmdd);
  if (Number.isNaN(d.getTime())) return yyyymmdd;
  return d.toLocaleString("en-GB", { month: "long", year: "numeric" });
}

function formatShortDate(yyyymmdd: string): string {
  const d = new Date(yyyymmdd);
  if (Number.isNaN(d.getTime())) return yyyymmdd;
  return d.toLocaleDateString("en-GB");
}

function formatRunway(category: string): string {
  return category
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}
