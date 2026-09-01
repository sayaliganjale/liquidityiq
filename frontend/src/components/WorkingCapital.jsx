import { Bar } from "react-chartjs-2";
import "@/lib/charts";
import { gridColor, EMERALD, AMBER, RED } from "@/lib/charts";
import { fmtMoney } from "@/lib/api";
import { ChartBar, Scales } from "@phosphor-icons/react";

const LABELS = [
  ["overdue", "Overdue"], ["current", "0–30d"], ["d31_60", "31–60d"],
  ["d61_90", "61–90d"], ["d90_plus", "90d+"],
];

function KPI({ label, value, hint, tone = "text-slate-900" }) {
  return (
    <div className="border border-slate-200/70 rounded-lg p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className={`mt-2 font-mono text-lg ${tone}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export default function WorkingCapital({ analytics, currency }) {
  if (!analytics)
    return (
      <div className="card-flat rounded-lg p-6 font-mono text-xs text-slate-400 animate-pulse">
        Computing working-capital metrics…
      </div>
    );

  const k = analytics.kpis;
  const cur = currency || analytics.currency;
  const barData = {
    labels: LABELS.map(([, l]) => l),
    datasets: [
      {
        label: "Receivables",
        data: LABELS.map(([key]) => analytics.ar_aging[key]?.amount || 0),
        backgroundColor: EMERALD + "cc", borderRadius: 3, barPercentage: 0.7,
      },
      {
        label: "Payables",
        data: LABELS.map(([key]) => analytics.ap_aging[key]?.amount || 0),
        backgroundColor: AMBER + "cc", borderRadius: 3, barPercentage: 0.7,
      },
    ],
  };

  const overdueAr = analytics.ar_aging.overdue.amount;
  const overdueShare = analytics.ar_aging.total ? (overdueAr / analytics.ar_aging.total) * 100 : 0;

  return (
    <div className="space-y-4" data-testid="working-capital">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI label="DSO" value={`${k.dso_days}d`} hint="Days sales outstanding" />
        <KPI label="DPO" value={`${k.dpo_days}d`} hint="Days payables outstanding" />
        <KPI label="Cash Cycle" value={`${k.ccc_days}d`} hint="DSO + DIO − DPO"
          tone={k.ccc_days <= 0 ? "text-emerald-600" : "text-slate-900"} />
        <KPI label="Working Capital" value={fmtMoney(k.working_capital, cur)}
          tone={k.working_capital >= 0 ? "text-slate-900" : "text-rose-600"} />
        <KPI label="Daily Net Flow" value={fmtMoney(k.daily_net_flow, cur)}
          tone={k.daily_net_flow >= 0 ? "text-emerald-600" : "text-rose-600"} />
        <KPI label="Quick Ratio" value={k.quick_ratio ?? "—"} hint="(Cash + AR) / AP"
          tone={(k.quick_ratio || 0) >= 1 ? "text-emerald-600" : "text-amber-600"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        <div className="card-flat rounded-lg p-6" data-testid="aging-chart">
          <div className="flex items-center gap-2 mb-5">
            <ChartBar size={16} className="text-sky-600" />
            <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
              AR / AP Aging Buckets
            </h3>
          </div>
          <div className="h-64">
            <Bar data={barData} options={{
              responsive: true, maintainAspectRatio: false,
              plugins: {
                legend: { labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, color: "#a1a1aa", font: { size: 10 } } },
                tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtMoney(c.parsed.y, cur, false)}` } },
              },
              scales: {
                x: { grid: { display: false }, ticks: { color: "#52525b" } },
                y: { grid: { color: gridColor }, ticks: { color: "#52525b", callback: (v) => fmtMoney(v, cur) } },
              },
            }} />
          </div>
        </div>

        <div className="card-flat rounded-lg p-6" data-testid="aging-detail">
          <div className="flex items-center gap-2 mb-5">
            <Scales size={16} className="text-sky-600" />
            <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">Exposure Detail</h3>
          </div>
          <div className="space-y-3">
            <Row label="Total receivables" value={fmtMoney(analytics.ar_aging.total, cur)} tone="text-emerald-600" />
            <Row label="Total payables" value={fmtMoney(analytics.ap_aging.total, cur)} tone="text-amber-600" />
            <Row label="Overdue receivables" value={fmtMoney(overdueAr, cur)}
              tone={overdueShare > 30 ? "text-rose-600" : "text-slate-600"} />
            <Row label="Overdue share of AR" value={`${overdueShare.toFixed(1)}%`}
              tone={overdueShare > 30 ? "text-rose-600" : "text-slate-600"} />
            <Row label="Annualised revenue" value={fmtMoney(k.annualized_revenue, cur)} />
            <Row label="Annualised costs" value={fmtMoney(k.annualized_costs, cur)} />
            <Row label="Daily burn" value={fmtMoney(k.daily_burn, cur)} />
            <Row label="Ledger depth" value={`${k.ledger_days} days`} />
          </div>
          {overdueShare > 30 && (
            <p className="mt-5 text-xs text-rose-700 border border-rose-200 bg-rose-50 rounded-lg px-3 py-2.5">
              {overdueShare.toFixed(0)}% of receivables are already past due — collections risk is the primary
              driver of the projected cash trough.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone = "text-slate-900" }) {
  return (
    <div className="flex items-center justify-between border-b hairline pb-2.5 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`font-mono text-xs ${tone}`}>{value}</span>
    </div>
  );
}
