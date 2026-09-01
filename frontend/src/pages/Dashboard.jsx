import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Doughnut } from "react-chartjs-2";
import "@/lib/charts";
import api, { fmtMoney } from "@/lib/api";
import RiskBadge from "@/components/RiskBadge";
import usePriceStream from "@/hooks/usePriceStream";
import { LiveValue, LiveDot } from "@/components/LivePrice";
import { ArrowUpRight, Buildings, Wallet, TrendUp, TrendDown, Scales } from "@phosphor-icons/react";

const fade = {
  hidden: { opacity: 0, y: 18 },
  show: (i) => ({ opacity: 1, y: 0, transition: { duration: 0.55, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] } }),
};

function Kpi({ i, label, value, sub, icon: Icon, accent }) {
  return (
    <motion.div variants={fade} initial="hidden" animate="show" custom={i}
      className="card-flat lift p-5 relative overflow-hidden" data-testid={`kpi-${label.toLowerCase().replace(/\s/g,'-')}`}>
      <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-sky-50 opacity-70" />
      <div className="relative flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</span>
        <Icon size={17} className={accent} />
      </div>
      <p className="relative mt-4 font-mono text-[30px] font-light tracking-tighter text-slate-900">{value}</p>
      {sub && <p className="relative mt-1 text-xs text-slate-400">{sub}</p>}
    </motion.div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/dashboard/summary").then((r) => setData(r.data)).catch((e) => setErr("Failed to load dashboard"));
    api.get("/market/watchlist").then((r) => setWatchlist(r.data.quotes || [])).catch(() => {});
  }, []);

  const { quotes: streamed, live } = usePriceStream(watchlist.map((w) => w.symbol).filter(Boolean));

  if (err) return <div className="p-10 text-rose-600">{err}</div>;
  if (!data) return <div className="p-10 text-xs font-bold uppercase tracking-[0.3em] text-slate-400 animate-pulse">Computing liquidity…</div>;

  const t = data.totals;
  const rd = data.risk_distribution;
  const doughnut = {
    labels: ["Low Risk", "Medium Risk", "High Risk"],
    datasets: [{
      data: [rd.LOW_RISK, rd.MEDIUM_RISK, rd.HIGH_RISK],
      backgroundColor: ["#10B981", "#F59E0B", "#E11D48"],
      borderColor: "#ffffff",
      borderWidth: 4,
      hoverOffset: 10,
    }],
  };

  return (
    <div className="px-5 sm:px-8 py-8 max-w-[1500px]">
      <div className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-sky-600">Command Center</p>
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight mt-2">Global Liquidity Overview</h1>
        <p className="text-slate-500 text-sm mt-1">{t.entities} entities · {t.public} public · {t.private} private · normalised to USD</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Kpi i={0} label="Total Cash" value={fmtMoney(t.cash_usd)} sub="Across all bank accounts" icon={Wallet} accent="text-sky-600" />
        <Kpi i={1} label="Receivables" value={fmtMoney(t.ar_usd)} sub="Accounts Receivable" icon={TrendUp} accent="text-emerald-600" />
        <Kpi i={2} label="Payables" value={fmtMoney(t.ap_usd)} sub="Accounts Payable" icon={TrendDown} accent="text-amber-600" />
        <Kpi i={3} label="Net Position" value={fmtMoney(t.net_position_usd)} sub="Cash + AR − AP" icon={Scales} accent="text-slate-900" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Risk distribution */}
        <div className="card-flat p-6" data-testid="risk-distribution-card">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">Risk Classification</h3>
          <div className="h-48 flex items-center justify-center">
            <Doughnut data={doughnut} options={{
              responsive: true, maintainAspectRatio: false, cutout: "70%",
              animation: { animateRotate: true, duration: 900 },
              plugins: { legend: { display: false } },
            }} />
          </div>
          <div className="mt-4 space-y-2 text-xs">
            {[["LOW_RISK","Low",rd.LOW_RISK,"#10B981"],["MEDIUM_RISK","Medium",rd.MEDIUM_RISK,"#F59E0B"],["HIGH_RISK","High",rd.HIGH_RISK,"#E11D48"]].map(([k,l,v,c])=>(
              <div key={k} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-500"><span className="h-2 w-2 rounded-full" style={{background:c}}/>{l} Risk</span>
                <span className="font-mono text-slate-700">{v} entities</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live watchlist */}
        <div className="card-flat p-6 lg:col-span-2" data-testid="watchlist-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Live Market · Public Entities</h3>
            <LiveDot live={live} label="STREAMING" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {watchlist.length === 0 && <p className="text-xs text-slate-400">Fetching quotes…</p>}
            {watchlist.map((w, i) => {
              const q = { ...w, ...(streamed[w.symbol] || {}) };
              return (
                <motion.div key={w.symbol} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}>
                  <Link to={`/app/company/${w.company_id}`} data-testid={`watch-${w.symbol}`}
                    className="flex items-center justify-between border border-slate-200/70 rounded-xl px-4 py-3 bg-white hover:border-sky-300 hover:shadow-[0_8px_22px_rgba(14,165,233,0.10)] transition-all duration-300">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-sky-600 truncate">{q.symbol}</p>
                      <p className="text-[11px] text-slate-400 truncate">{q.exchange}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-slate-900">
                        {q.ok ? <LiveValue value={q.price} currency={q.currency} testid={`dash-price-${q.symbol}`} /> : "—"}
                      </p>
                      <p className={`font-mono text-[11px] ${(q.changePercent||0)>=0?"text-emerald-600":"text-rose-600"}`}>
                        {q.ok ? `${(q.changePercent||0)>=0?"+":""}${q.changePercent}%` : "n/a"}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Entities table */}
      <div className="card-flat rounded-lg overflow-hidden" data-testid="entities-table">
        <div className="px-6 py-4 border-b hairline flex items-center gap-2">
          <Buildings size={16} className="text-sky-600" />
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">Multi-Entity Portfolio</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-400 border-b hairline">
                <th className="text-left px-6 py-3">Entity</th>
                <th className="text-left px-6 py-3 hidden sm:table-cell">Type</th>
                <th className="text-left px-6 py-3 hidden md:table-cell">Sector</th>
                <th className="text-right px-6 py-3">Cash (USD)</th>
                <th className="text-right px-6 py-3 hidden sm:table-cell">Runway</th>
                <th className="text-left px-6 py-3">Risk / Confidence</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.entities.map((e) => (
                <tr key={e.id} className="border-b hairline last:border-0 hover:bg-sky-50/50 transition-colors" data-testid={`entity-row-${e.id}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="h-8 w-8 rounded-lg flex items-center justify-center font-serif text-xs text-white shadow-sm" style={{background:e.logo_bg}}>{e.name[0]}</span>
                      <div>
                        <p className="text-slate-900">{e.name}</p>
                        {e.ticker && <p className="font-mono text-[10px] text-slate-500">{e.ticker} · {e.exchange}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell font-mono text-xs text-slate-500 capitalize">{e.kind}</td>
                  <td className="px-6 py-4 hidden md:table-cell text-xs text-slate-500">{e.sector}</td>
                  <td className="px-6 py-4 text-right font-mono">{fmtMoney(e.cash_usd)}</td>
                  <td className="px-6 py-4 text-right hidden sm:table-cell font-mono text-xs">{e.runway_days >= 900 ? "90d+" : `${e.runway_days}d`}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <RiskBadge risk={e.risk} size="sm" />
                      <span className="font-mono text-[10px] text-slate-500">{e.confidence}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link to={`/app/company/${e.id}`} data-testid={`open-company-${e.id}`} className="inline-flex items-center gap-1 font-mono text-[11px] text-sky-600 hover:text-slate-900 transition-colors">
                      Forecast <ArrowUpRight size={12} weight="bold" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
