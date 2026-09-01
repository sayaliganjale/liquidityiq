import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Line } from "react-chartjs-2";
import "@/lib/charts";
import { gridColor, ACCENT, AMBER } from "@/lib/charts";
import api, { fmtMoney } from "@/lib/api";
import RiskBadge from "@/components/RiskBadge";
import { SlidersHorizontal, ArrowCounterClockwise, Lightning, Warning } from "@phosphor-icons/react";

const PRESETS = {
  base: { label: "Base Case", params: {} },
  downturn: {
    label: "Demand Downturn",
    params: { revenue_shock_pct: -25, collection_rate_pct: 85, ar_delay_days: 20 },
  },
  squeeze: {
    label: "Working Capital Squeeze",
    params: { ar_delay_days: 45, collection_rate_pct: 80, ap_accelerate_days: 20 },
  },
  expansion: {
    label: "Capex Expansion",
    params: { capex_amount: 0, cost_shock_pct: 12, revenue_shock_pct: 8 },
  },
  crisis: {
    label: "Liquidity Crisis",
    params: { revenue_shock_pct: -40, cost_shock_pct: 10, ar_delay_days: 60, collection_rate_pct: 65, ap_accelerate_days: 30 },
  },
};

const SLIDERS = [
  { key: "revenue_shock_pct", label: "Revenue shock", min: -50, max: 50, step: 1, unit: "%" },
  { key: "cost_shock_pct", label: "Cost shock", min: -30, max: 60, step: 1, unit: "%" },
  { key: "ar_delay_days", label: "AR collection delay", min: 0, max: 90, step: 1, unit: "d" },
  { key: "collection_rate_pct", label: "Collection rate", min: 50, max: 100, step: 1, unit: "%" },
  { key: "ap_accelerate_days", label: "Pay suppliers earlier", min: 0, max: 45, step: 1, unit: "d" },
  { key: "fx_shock_pct", label: "FX shock on exposure", min: -25, max: 25, step: 1, unit: "%" },
  { key: "capex_day", label: "One-off outflow on day", min: 1, max: 90, step: 1, unit: "" },
];

const ZERO = {
  revenue_shock_pct: 0, cost_shock_pct: 0, ar_delay_days: 0, collection_rate_pct: 100,
  ap_accelerate_days: 0, capex_amount: 0, capex_day: 30, fx_shock_pct: 0, credit_line: 0,
};

export default function ScenarioSimulator({ cid, currency, baseCash }) {
  const [params, setParams] = useState(ZERO);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preset, setPreset] = useState("base");
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setBusy(true);
      api.post(`/companies/${cid}/scenario`, params)
        .then((r) => setResult(r.data))
        .catch(() => {})
        .finally(() => setBusy(false));
    }, 250);
    return () => clearTimeout(timer.current);
  }, [cid, params]);

  const applyPreset = (key) => {
    setPreset(key);
    const p = PRESETS[key].params;
    const capex = key === "expansion" ? Math.round((baseCash || 0) * 0.18) : 0;
    setParams({ ...ZERO, ...p, capex_amount: p.capex_amount === 0 && capex ? capex : (p.capex_amount || 0) });
  };

  const set = (key, value) => {
    setPreset("custom");
    setParams((p) => ({ ...p, [key]: value }));
  };

  const chart = useMemo(() => {
    if (!result) return null;
    return {
      labels: result.dates,
      datasets: [
        {
          label: "Base case", data: result.baseline.series, borderColor: ACCENT,
          borderWidth: 2, pointRadius: 0, tension: 0.25, fill: false,
        },
        {
          label: "Scenario", data: result.scenario.series, borderColor: AMBER,
          backgroundColor: "rgba(245,158,11,0.10)", borderWidth: 2, pointRadius: 0,
          tension: 0.25, fill: true,
        },
      ],
    };
  }, [result]);

  const d = result?.delta;
  const sm = result?.scenario?.metrics;

  return (
    <div className="card-flat rounded-lg p-6" data-testid="scenario-simulator">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={18} className="text-amber-600" />
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
            What-If Scenario Simulator
          </h3>
          {busy && <span className="font-mono text-[10px] text-slate-400 animate-pulse">recomputing…</span>}
        </div>
        <button
          onClick={() => { setParams(ZERO); setPreset("base"); }}
          data-testid="scenario-reset"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowCounterClockwise size={13} /> Reset
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(PRESETS).map(([k, v]) => (
          <button
            key={k}
            onClick={() => applyPreset(k)}
            data-testid={`scenario-preset-${k}`}
            className={`px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider border transition-colors ${
              preset === k
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-slate-200 text-slate-500 hover:text-slate-900 hover:border-sky-300"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
        <div className="space-y-5">
          {SLIDERS.map((s) => (
            <div key={s.key}>
              <div className="flex items-center justify-between mb-2">
                <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500">{s.label}</label>
                <span className="font-mono text-xs text-slate-900 tabular-nums">
                  {params[s.key] > 0 && s.unit === "%" ? "+" : ""}{params[s.key]}{s.unit}
                </span>
              </div>
              <input
                type="range" min={s.min} max={s.max} step={s.step}
                value={params[s.key]}
                onChange={(e) => set(s.key, Number(e.target.value))}
                data-testid={`slider-${s.key}`}
                className="w-full h-1 rounded-full appearance-none bg-slate-200 accent-sky-500
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5
                  [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:cursor-grab"
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500">One-off outflow</label>
              <input
                type="number" value={params.capex_amount}
                onChange={(e) => set("capex_amount", Number(e.target.value) || 0)}
                data-testid="input-capex-amount"
                className="mt-2 w-full bg-transparent border border-slate-200 rounded-md px-3 py-2 font-mono text-xs focus:border-amber-300 outline-none"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500">Credit line</label>
              <input
                type="number" value={params.credit_line}
                onChange={(e) => set("credit_line", Number(e.target.value) || 0)}
                data-testid="input-credit-line"
                className="mt-2 w-full bg-transparent border border-slate-200 rounded-md px-3 py-2 font-mono text-xs focus:border-amber-300 outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="h-64 mb-5">
            {chart ? (
              <Line data={chart} options={{
                responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
                interaction: { mode: "index", intersect: false },
                plugins: {
                  legend: { labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, color: "#a1a1aa", font: { size: 10 } } },
                  tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtMoney(c.parsed.y, currency, false)}` } },
                },
                scales: {
                  x: { grid: { color: gridColor }, ticks: { maxTicksLimit: 7, color: "#52525b" } },
                  y: { grid: { color: gridColor }, ticks: { color: "#52525b", callback: (v) => fmtMoney(v, currency) } },
                },
              }} />
            ) : (
              <div className="h-full flex items-center justify-center font-mono text-xs text-slate-400 animate-pulse">
                Building scenario paths…
              </div>
            )}
          </div>

          {result && (
            <motion.div
              key={JSON.stringify(d)}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-3"
              data-testid="scenario-impact"
            >
              <Impact label="Projected 90d" value={fmtMoney(sm.projected_90d, currency)}
                delta={d.projected_90d} currency={currency} />
              <Impact label="Trough" value={fmtMoney(sm.min_projected, currency)}
                delta={d.min_projected} currency={currency} />
              <Impact label="Runway" value={sm.runway_days >= 900 ? "90d+" : `${sm.runway_days}d`}
                delta={d.runway_days} suffix="d" />
              <div className="border border-slate-200/70 rounded-lg p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Scenario Risk</p>
                <div className="mt-2"><RiskBadge risk={result.scenario.risk} size="sm" /></div>
              </div>
            </motion.div>
          )}

          {sm?.breach_day && (
            <div className="mt-4 flex items-start gap-2 border border-rose-200 bg-rose-50 rounded-lg px-4 py-3"
              data-testid="scenario-breach-warning">
              <Warning size={16} className="text-rose-600 mt-0.5" />
              <p className="text-sm text-rose-700">
                Liquidity floor breached on <span className="font-mono">day {sm.breach_day}</span>
                {result.dates?.[sm.breach_day - 1] ? ` (${result.dates[sm.breach_day - 1]})` : ""}. Draw the
                revolver or pull collections forward before then.
              </p>
            </div>
          )}
          {result && !sm?.breach_day && (
            <div className="mt-4 flex items-center gap-2 font-mono text-[11px] text-emerald-600/80">
              <Lightning size={14} /> No liquidity breach within the 90-day horizon under this scenario.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Impact({ label, value, delta, currency, suffix }) {
  const good = (delta ?? 0) >= 0;
  const shown = currency ? fmtMoney(Math.abs(delta), currency) : `${Math.abs(delta)}${suffix || ""}`;
  return (
    <div className="border border-slate-200/70 rounded-lg p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-lg">{value}</p>
      <p className={`mt-1 font-mono text-[11px] ${delta === 0 ? "text-slate-400" : good ? "text-emerald-600" : "text-rose-600"}`}>
        {delta === 0 ? "no change" : `${good ? "+" : "−"}${shown} vs base`}
      </p>
    </div>
  );
}
