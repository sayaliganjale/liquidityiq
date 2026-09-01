import jsPDF from "jspdf";
import { fmtMoney } from "@/lib/api";

const INK = [10, 10, 10];
const ACCENT = [0, 122, 255];
const MUTED = [120, 120, 128];
const RISK_COLOR = { LOW_RISK: [16, 185, 129], MEDIUM_RISK: [245, 158, 11], HIGH_RISK: [239, 68, 68] };
const RISK_LABEL = { LOW_RISK: "LOW RISK", MEDIUM_RISK: "MEDIUM RISK", HIGH_RISK: "HIGH RISK" };

const M = 42;

export function buildLiquidityReport({ company, forecast, analytics, chartImage, brief }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const cur = company.currency || "USD";
  let y = 0;

  // ---- masthead
  doc.setFillColor(...INK);
  doc.rect(0, 0, W, 96, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("times", "normal").setFontSize(24);
  doc.text("LiquidityIQ", M, 44);
  doc.setFont("courier", "normal").setFontSize(8).setTextColor(150, 150, 158);
  doc.text("ENTERPRISE LIQUIDITY MANAGEMENT  ·  90-DAY ML CASH FLOW FORECAST", M, 62);
  doc.text(
    new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" }).toUpperCase(),
    W - M,
    62,
    { align: "right" }
  );
  y = 132;

  // ---- entity block
  doc.setTextColor(...INK).setFont("times", "normal").setFontSize(20);
  doc.text(company.name || "Entity", M, y);
  y += 16;
  doc.setFont("courier", "normal").setFontSize(8).setTextColor(...MUTED);
  const meta = [company.ticker ? `${company.ticker} · ${company.exchange}` : "PRIVATE ENTITY",
    company.sector, company.country, cur].filter(Boolean).join("   ·   ");
  doc.text(meta.toUpperCase(), M, y);
  y += 24;

  if (forecast) {
    const rc = RISK_COLOR[forecast.risk] || RISK_COLOR.MEDIUM_RISK;
    doc.setFillColor(...rc);
    doc.roundedRect(M, y - 10, 130, 22, 11, 11, "F");
    doc.setTextColor(255, 255, 255).setFontSize(8);
    doc.text(`${RISK_LABEL[forecast.risk]}  ·  ${forecast.confidence}%`, M + 12, y + 4);
    doc.setTextColor(...MUTED);
    doc.text(`MODEL: ${forecast.model} + ${forecast.classifier}`, M + 148, y + 4);
    y += 34;
  }

  // ---- KPI grid
  const kpis = forecast
    ? [
        ["Current Cash", fmtMoney(forecast.metrics.current_cash, cur)],
        ["Projected (90d)", fmtMoney(forecast.metrics.projected_90d, cur)],
        ["Net Change (90d)", fmtMoney(forecast.metrics.net_change_90d, cur)],
        ["Minimum Projected", fmtMoney(forecast.metrics.min_projected, cur)],
        ["Cash Runway", forecast.metrics.runway_days >= 900 ? "90d+" : `${forecast.metrics.runway_days} days`],
        ["Volatility Index", String(forecast.metrics.volatility)],
        ["Receivables", fmtMoney(forecast.metrics.total_ar, cur)],
        ["Payables", fmtMoney(forecast.metrics.total_ap, cur)],
      ]
    : [];
  const colW = (W - M * 2) / 4;
  kpis.forEach(([label, value], i) => {
    const cx = M + (i % 4) * colW;
    const cy = y + Math.floor(i / 4) * 52;
    doc.setDrawColor(224, 224, 228).rect(cx, cy, colW - 8, 44);
    doc.setFont("courier", "normal").setFontSize(6).setTextColor(...MUTED);
    doc.text(label.toUpperCase(), cx + 8, cy + 15);
    doc.setFontSize(10).setTextColor(...INK);
    doc.text(String(value), cx + 8, cy + 32);
  });
  y += Math.ceil(kpis.length / 4) * 52 + 16;

  // ---- forecast chart
  if (chartImage) {
    doc.setFont("courier", "normal").setFontSize(7).setTextColor(...ACCENT);
    doc.text("90-DAY CASH FLOW PROJECTION", M, y);
    y += 8;
    const h = 190;
    doc.addImage(chartImage, "PNG", M, y, W - M * 2, h);
    y += h + 24;
  }

  // ---- working capital
  if (analytics) {
    const k = analytics.kpis || {};
    doc.setFont("courier", "normal").setFontSize(7).setTextColor(...ACCENT);
    doc.text("WORKING CAPITAL", M, y);
    y += 14;
    const rows = [
      ["DSO", `${k.dso_days} days`, "DPO", `${k.dpo_days} days`],
      ["Cash Conversion Cycle", `${k.ccc_days} days`, "Working Capital", fmtMoney(k.working_capital, cur)],
      ["Daily Net Flow", fmtMoney(k.daily_net_flow, cur), "Quick Ratio", k.quick_ratio ?? "—"],
    ];
    doc.setFontSize(8).setTextColor(...INK);
    rows.forEach((r) => {
      doc.setTextColor(...MUTED).text(r[0], M, y);
      doc.setTextColor(...INK).text(String(r[1]), M + 150, y);
      doc.setTextColor(...MUTED).text(r[2], M + 270, y);
      doc.setTextColor(...INK).text(String(r[3]), M + 420, y);
      y += 16;
    });
    y += 12;

    const bucket = (title, ag) => {
      doc.setFont("courier", "normal").setFontSize(7).setTextColor(...ACCENT);
      doc.text(title, M, y);
      y += 14;
      doc.setFontSize(8);
      [["Overdue", ag.overdue], ["0–30 days", ag.current], ["31–60 days", ag.d31_60],
        ["61–90 days", ag.d61_90], ["90+ days", ag.d90_plus]].forEach(([l, b]) => {
        doc.setTextColor(...MUTED).text(l, M, y);
        doc.setTextColor(...INK).text(`${fmtMoney(b.amount, cur)}  (${b.count})`, M + 150, y);
        y += 14;
      });
      y += 10;
    };
    if (y > 600) { doc.addPage(); y = M + 20; }
    bucket("RECEIVABLES AGING", analytics.ar_aging);
    if (y > 620) { doc.addPage(); y = M + 20; }
    bucket("PAYABLES AGING", analytics.ap_aging);
  }

  // ---- AI narrative
  if (brief) {
    doc.addPage();
    y = M + 20;
    doc.setFont("courier", "normal").setFontSize(7).setTextColor(...ACCENT);
    doc.text("AI TREASURY ANALYST BRIEFING  ·  CLAUDE SONNET 4.6", M, y);
    y += 20;
    const clean = brief.replace(/\*\*/g, "").replace(/^###\s*/gm, "");
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(40, 40, 44);
    doc.splitTextToSize(clean, W - M * 2).forEach((line) => {
      if (y > 780) { doc.addPage(); y = M + 20; }
      doc.text(line, M, y);
      y += 13;
    });
  }

  // ---- footers
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("courier", "normal").setFontSize(6).setTextColor(...MUTED);
    doc.text("LIQUIDITYIQ · CONFIDENTIAL TREASURY REPORT · ARIMA(2,1,2) + RANDOM FOREST", M, 812);
    doc.text(`${p} / ${pages}`, W - M, 812, { align: "right" });
  }

  return doc;
}

export function downloadLiquidityReport(args) {
  const doc = buildLiquidityReport(args);
  const slug = (args.company?.name || "entity").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  doc.save(`liquidityiq-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
