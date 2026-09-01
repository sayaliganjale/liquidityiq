import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Line } from "react-chartjs-2";
import "@/lib/charts";
import { gridColor, ACCENT, ACCENT_FILL } from "@/lib/charts";
import api from "@/lib/api";
import usePriceStream from "@/hooks/usePriceStream";
import { LiveValue, LiveDot, ChangePill } from "@/components/LivePrice";
import { MagnifyingGlass, Pulse, ChartLineUp } from "@phosphor-icons/react";

const EXCHANGES = ["NSE", "BSE", "NASDAQ", "NYSE"];

export default function Market() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [quote, setQuote] = useState(null);
  const [history, setHistory] = useState([]);
  const timer = useRef(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); return; }
    // Clear stale results immediately so old items don't flash
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/market/search`, { params: { q } });
        setResults(data.results || []);
      } catch { setResults([]); }
      setLoading(false);
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  const openSymbol = async (sym) => {
    setSelected(sym);
    setQ("");          // Clear search field after selection
    setResults([]);    // Clear results dropdown
    setQuote(null); setHistory([]);
    try {
      const [qr, hr] = await Promise.all([
        api.get(`/market/quote/${sym.symbol}`),
        api.get(`/market/history/${sym.symbol}`, { params: { rng: "6mo" } }),
      ]);
      setQuote(qr.data);
      setHistory(hr.data.series || []);
    } catch {}
  };

  const { quotes: streamed, live } = usePriceStream(selected ? [selected.symbol] : []);
  const lq = { ...(quote || {}), ...(streamed[selected?.symbol] || {}) };

  const chart = history.length ? {
    labels: history.map((h) => h.date),
    datasets: [{ data: history.map((h) => h.close), borderColor: ACCENT, backgroundColor: ACCENT_FILL,
      borderWidth: 2, pointRadius: 0, fill: true, tension: 0.25 }],
  } : null;

  return (
    <div className="px-5 sm:px-8 py-8 max-w-[1500px]">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-sky-600">Global Market</p>
      <h1 className="font-serif text-3xl sm:text-4xl tracking-tight mt-2 mb-1">Live Ticker Search</h1>
      <p className="text-slate-500 text-sm mb-6 font-mono">Real-time lookups across {EXCHANGES.join(" · ")} via Yahoo Finance</p>

      <div className="relative mb-8">
        <MagnifyingGlass size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          data-testid="market-search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search e.g. TATAMOTORS, Apple, INFY, RELIANCE…"
          className="w-full bg-white border border-slate-200 rounded-full pl-12 pr-4 py-4 text-sm font-mono focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-colors"
        />
        {loading && <span className="absolute right-5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-slate-500 animate-pulse">searching…</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Results list */}
        <div className="lg:col-span-2 space-y-2" data-testid="market-results">
          {results.length === 0 && q && !loading && <p className="font-mono text-xs text-slate-400">No equities found.</p>}
          {results.length === 0 && !q && !selected && <p className="font-mono text-xs text-slate-400">Start typing to search global tickers.</p>}
          {results.map((r, i) => (
            <motion.button
              key={r.symbol + "-" + i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => openSymbol(r)}
              data-testid={`market-result-${r.symbol}`}
              className={`w-full text-left flex items-center justify-between border rounded-lg px-4 py-3 transition-colors ${selected?.symbol===r.symbol?"border-sky-500 bg-sky-50/70":"border-slate-200/70 hover:border-sky-300"}`}
            >
              <div className="min-w-0">
                <p className="font-mono text-sm">{r.symbol}</p>
                <p className="text-xs text-slate-500 truncate">{r.name}</p>
              </div>
              <span className="font-mono text-[10px] text-slate-500 shrink-0 ml-3">{r.exchange}</span>
            </motion.button>
          ))}
        </div>

        {/* Detail */}
        <div className="lg:col-span-3">
          {!selected && (
            <div className="card-flat rounded-lg h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8">
              <ChartLineUp size={40} className="text-slate-300 mb-4" />
              <p className="font-mono text-xs text-slate-400 uppercase tracking-[0.2em]">Select a ticker to load live quote</p>
            </div>
          )}
          {selected && (
            <div className="card-flat p-6" data-testid="market-detail">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-serif text-2xl">{selected.symbol}</h3>
                  <p className="text-xs text-slate-500">{selected.name} · {selected.exchange}</p>
                </div>
                {lq && lq.ok && (
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2 mb-1"><LiveDot live={live} label="STREAMING" /></div>
                    <p className="font-mono text-[28px] font-light tracking-tighter text-slate-900">
                      <LiveValue value={lq.price} currency={lq.currency} testid={`market-live-${selected.symbol}`} />
                    </p>
                    <div className="mt-1 flex justify-end"><ChangePill change={lq.change} changePercent={lq.changePercent} /></div>
                  </div>
                )}
              </div>

              {!quote && <p className="text-xs text-slate-400 animate-pulse">Fetching live quote…</p>}
              {quote && !quote.ok && <p className="text-xs text-amber-600">Quote unavailable (rate-limited). Try again shortly.</p>}

              {lq && lq.ok && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 text-xs">
                    <div className="border border-slate-200/70 rounded-xl p-3 bg-sky-50/40"><p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.12em]">Day High</p><p className="mt-1 font-mono text-slate-800">{lq.dayHigh?.toLocaleString() ?? "—"}</p></div>
                    <div className="border border-slate-200/70 rounded-xl p-3 bg-sky-50/40"><p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.12em]">Day Low</p><p className="mt-1 font-mono text-slate-800">{lq.dayLow?.toLocaleString() ?? "—"}</p></div>
                    <div className="border border-slate-200/70 rounded-xl p-3 bg-sky-50/40"><p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.12em]">52W High</p><p className="mt-1 font-mono text-slate-800">{quote?.fiftyTwoWeekHigh?.toLocaleString() ?? "—"}</p></div>
                    <div className="border border-slate-200/70 rounded-xl p-3 bg-sky-50/40"><p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.12em]">Volume</p><p className="mt-1 font-mono text-slate-800">{lq.volume?.toLocaleString() ?? "—"}</p></div>
                  </div>
                  <div className="h-56">
                    {chart ? (
                      <Line data={chart} options={{
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c)=>`${lq.currency==='INR'?'₹':'$'}${c.parsed.y.toLocaleString()}` } } },
                        scales: { x: { grid: { color: gridColor }, ticks: { maxTicksLimit: 6 } }, y: { grid: { color: gridColor } } },
                      }} />
                    ) : <div className="h-full flex items-center justify-center text-xs text-slate-400">Loading 6-month history…</div>}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
