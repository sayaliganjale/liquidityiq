import { useEffect, useRef, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Line } from "react-chartjs-2";
import { toast } from "sonner";
import "@/lib/charts";
import { gridColor, ACCENT, ACCENT_FILL, EMERALD } from "@/lib/charts";
import api, { fmtMoney } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import RiskBadge from "@/components/RiskBadge";
import ScenarioSimulator from "@/components/ScenarioSimulator";
import WorkingCapital from "@/components/WorkingCapital";
import LedgerTable from "@/components/LedgerTable";
import { AIBrief, AIChat } from "@/components/AIAnalyst";
import usePriceStream from "@/hooks/usePriceStream";
import { LiveValue, LiveDot, ChangePill } from "@/components/LivePrice";
import { downloadLiquidityReport } from "@/lib/pdf";
import Breadcrumbs from "@/components/Breadcrumbs";
import ErrorBoundary from "@/components/ErrorBoundary";
import {
  Brain, Pulse, Bank, ArrowUp, ArrowDown, FilePdf, SlidersHorizontal, Scales,
  Receipt, ChartLineUp, Sparkle,
} from "@phosphor-icons/react";

const TABS = [
  { key: "forecast", label: "Forecast", icon: ChartLineUp },
  { key: "scenario", label: "Scenario Lab", icon: SlidersHorizontal },
  { key: "capital", label: "Working Capital", icon: Scales },
  { key: "analyst", label: "AI Analyst", icon: Sparkle },
  { key: "ledger", label: "Ledger", icon: Receipt },
];

function Stat({ label, value, tone = "text-slate-900" }) {
  return (
    <div className="border border-slate-200/70 rounded-lg p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className={`mt-2 font-mono text-lg ${tone}`}>{value}</p>
    </div>
  );
}

export default function CompanyDetail() {
  const { cid } = useParams();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const canWrite = ["admin", "analyst"].includes(user?.role);
  const [detail, setDetail] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [quote, setQuote] = useState(null);
  const [brief, setBrief] = useState(null);
  const [tab, setTab] = useState(params.get("tab") || "forecast");
  const [err, setErr] = useState("");
  const chartRef = useRef(null);

  const selectTab = (key) => {
    setTab(key);
    setParams({ tab: key }, { replace: true });
  };

  useEffect(() => {
    const t = params.get("tab");
    if (t && TABS.some((x) => x.key === t)) setTab(t);
  }, [params]);

  useEffect(() => {
    setDetail(null); setForecast(null); setQuote(null); setAnalytics(null); setBrief(null);
    api.get(`/companies/${cid}`).then((r) => {
      setDetail(r.data);
      const tk = r.data.company.ticker;
      if (tk) api.get(`/market/quote/${tk}`).then((q) => setQuote(q.data)).catch(() => {});
    }).catch(() => setErr("Company not found"));
    api.get(`/companies/${cid}/forecast`).then((r) => setForecast(r.data)).catch(() => {});
    api.get(`/companies/${cid}/analytics`).then((r) => setAnalytics(r.data)).catch(() => {});
  }, [cid]);

  const ticker = detail?.company?.ticker;
  const { quotes: streamed, live } = usePriceStream(ticker ? [ticker] : []);
  const lq = { ...(quote || {}), ...(streamed[ticker] || {}) };

  if (err)
    return <div className="p-10 text-rose-600">{err} · <Link to="/app" className="underline">back</Link></div>;
  if (!detail)
    return <div className="p-10 text-xs font-bold uppercase tracking-[0.3em] text-slate-400 animate-pulse">Loading entity…</div>;

  const c = detail.company;
  const cur = c.currency;

  let lineData = null;
  if (forecast) {
    const hist = forecast.history;
    const fc = forecast.forecast;
    const labels = [...hist.map((h) => h.date), ...fc.map((f) => f.date)];
    const histVals = [...hist.map((h) => h.value), ...fc.map(() => null)];
    const fcVals = [...hist.map(() => null), ...fc.map((f) => f.value)];
    fcVals[hist.length - 1] = hist[hist.length - 1]?.value ?? null;
    lineData = {
      labels,
      datasets: [
        { label: "Historical Cash", data: histVals, borderColor: ACCENT, backgroundColor: ACCENT_FILL,
          borderWidth: 2.5, pointRadius: 0, fill: true, tension: 0.3 },
        { label: "90-Day ML Forecast", data: fcVals, borderColor: EMERALD, borderDash: [6, 4],
          borderWidth: 2, pointRadius: 0, fill: false, tension: 0.25 },
      ],
    };
  }

  const exportPdf = () => {
    if (!forecast) return toast.error("Forecast still loading");
    let chartImage = null;
    try {
      chartImage = chartRef.current?.toBase64Image?.("image/png", 1);
    } catch {}
    downloadLiquidityReport({ company: c, forecast, analytics, chartImage, brief });
    toast.success("Liquidity report downloaded");
  };

  return (
    <div className="px-5 sm:px-8 py-8 max-w-[1500px]">
      <Breadcrumbs items={[
        { label: "Overview", to: "/app" },
        { label: "Entities", to: "/app/entities" },
        { label: c.name },
      ]} />

      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <span className="h-14 w-14 rounded-2xl flex items-center justify-center font-serif text-2xl text-white shadow-[0_10px_24px_rgba(15,23,42,0.20)]" style={{ background: c.logo_bg }}>{c.name[0]}</span>
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">{c.name}</h1>
            <p className="font-mono text-xs text-slate-500 mt-1">
              {c.ticker ? `${c.ticker} · ${c.exchange}` : "Private Entity"} · {c.sector} · {c.country} · {cur}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lq && lq.ok && (
            <div className="card-flat px-5 py-3 text-right" data-testid="live-quote">
              <div className="flex items-center justify-end gap-2"><LiveDot live={live} label="STREAMING" /></div>
              <p className="font-mono text-2xl font-light tracking-tighter text-slate-900 mt-1">
                <LiveValue value={lq.price} currency={lq.currency} testid={`detail-live-${ticker}`} />
              </p>
              <div className="mt-1 flex justify-end">
                <ChangePill change={lq.change} changePercent={lq.changePercent} />
              </div>
            </div>
          )}
          <button onClick={exportPdf} data-testid="export-pdf-btn"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-300 bg-white hover:border-sky-400 hover:shadow-[0_8px_22px_rgba(14,165,233,0.12)] transition-all duration-300 text-[11px] font-bold uppercase tracking-wider text-slate-700">
            <FilePdf size={14} /> Export report
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-6 border-b hairline">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => selectTab(t.key)} data-testid={`tab-${t.key}`}
            className={`relative inline-flex items-center gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-wider transition-colors ${
              tab === t.key ? "text-sky-700" : "text-slate-400 hover:text-slate-700"
            }`}>
            <t.icon size={13} />{t.label}
            {tab === t.key && (
              <motion.span layoutId="tab-underline"
                className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-sky-500" />
            )}
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {tab === "forecast" && (
          <ErrorBoundary label="90-Day Forecast">
          <div className="space-y-6">
            <div className="card-flat rounded-lg p-6" data-testid="forecast-chart-card">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-2">
                  <Brain size={18} className="text-sky-600" />
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">90-Day ML Cash Flow Forecast</h3>
                </div>
                {forecast && (
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-slate-500">Model: <span className="text-slate-900">{forecast.model}</span> + {forecast.classifier}</span>
                    <RiskBadge risk={forecast.risk} size="sm" />
                  </div>
                )}
              </div>
              <div className="h-72">
                {lineData ? (
                  <Line ref={chartRef} data={lineData} options={{
                    responsive: true, maintainAspectRatio: false,
                    interaction: { mode: "index", intersect: false },
                    plugins: {
                      legend: { display: true, labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, color: "#a1a1aa", font: { size: 10 } } },
                      tooltip: { callbacks: { label: (ctx) => ctx.parsed.y == null ? null : `${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y, cur, false)}` } },
                    },
                    scales: {
                      x: { grid: { color: gridColor }, ticks: { maxTicksLimit: 8, color: "#52525b" } },
                      y: { grid: { color: gridColor }, ticks: { color: "#52525b", callback: (v) => fmtMoney(v, cur) } },
                    },
                  }} />
                ) : <div className="h-full flex items-center justify-center font-mono text-xs text-slate-400 animate-pulse">Running ARIMA + Random Forest…</div>}
              </div>

              {forecast && (
                <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <Stat label="Current Cash" value={fmtMoney(forecast.metrics.current_cash, cur)} />
                  <Stat label="Projected 90d" value={fmtMoney(forecast.metrics.projected_90d, cur)} />
                  <Stat label="Net Δ 90d" value={fmtMoney(forecast.metrics.net_change_90d, cur)} tone={forecast.metrics.net_change_90d >= 0 ? "text-emerald-600" : "text-rose-600"} />
                  <Stat label="Min Projected" value={fmtMoney(forecast.metrics.min_projected, cur)} tone={forecast.metrics.min_projected >= 0 ? "text-slate-900" : "text-rose-600"} />
                  <Stat label="Runway" value={forecast.metrics.runway_days >= 900 ? "90d+" : `${forecast.metrics.runway_days} days`} />
                  <Stat label="Confidence" value={`${forecast.confidence}%`} tone="text-sky-600" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="card-flat rounded-lg p-6" data-testid="bank-accounts-card">
                <div className="flex items-center gap-2 mb-4"><Bank size={16} className="text-sky-600" /><h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">Bank Accounts</h3></div>
                <div className="space-y-3">
                  {detail.bank_accounts.map((b) => (
                    <div key={b.id} className="flex items-center justify-between border-b hairline pb-3 last:border-0">
                      <div>
                        <p className="text-sm">{b.name}</p>
                        <p className="font-mono text-[10px] text-slate-500 uppercase">{b.account_type}</p>
                      </div>
                      <p className="font-mono text-sm">{fmtMoney(b.balance, b.currency)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-flat rounded-lg p-6" data-testid="ar-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-600 flex items-center gap-2"><ArrowDown size={14} />Receivables</h3>
                  <span className="font-mono text-xs">{fmtMoney(detail.total_ar, cur)}</span>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {detail.ar.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-500 truncate">{r.counterparty}</span>
                      <span className="flex items-center gap-2">{fmtMoney(r.amount, r.currency)}<span className={`text-[9px] ${r.status === "overdue" ? "text-rose-600" : "text-slate-400"}`}>{r.status}</span></span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-flat rounded-lg p-6" data-testid="ap-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-600 flex items-center gap-2"><ArrowUp size={14} />Payables</h3>
                  <span className="font-mono text-xs">{fmtMoney(detail.total_ap, cur)}</span>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {detail.ap.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-500 truncate">{r.counterparty}</span>
                      <span className="flex items-center gap-2">{fmtMoney(r.amount, r.currency)}<span className={`text-[9px] ${r.status === "overdue" ? "text-rose-600" : "text-slate-400"}`}>{r.status}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          </ErrorBoundary>
        )}

        {tab === "scenario" && (
          <ErrorBoundary label="Scenario Lab">
            <ScenarioSimulator cid={cid} currency={cur} baseCash={c.total_cash} />
          </ErrorBoundary>
        )}

        {tab === "capital" && (
          <ErrorBoundary label="Working Capital">
            <WorkingCapital analytics={analytics} currency={cur} />
          </ErrorBoundary>
        )}

        {tab === "analyst" && (
          <ErrorBoundary label="AI Analyst">
          <div className="space-y-4">
            <AIBrief cid={cid} companyName={c.name} onBrief={setBrief} />
            <AIChat
              companyId={cid}
              placeholder={`Ask anything about ${c.name}'s liquidity, counterparties or forecast.`}
              suggestions={[
                "When exactly does cash hit its lowest point and why?",
                "Which payables should I renegotiate first?",
                "How much revolver headroom do I need to stay safe?",
                "Is my collections performance the problem or my cost base?",
              ]}
            />
          </div>
          </ErrorBoundary>
        )}

        {tab === "ledger" && (
          <ErrorBoundary label="Ledger">
            <LedgerTable cid={cid} slug={c.slug} canWrite={canWrite} />
          </ErrorBoundary>
        )}
      </motion.div>
    </div>
  );
}
