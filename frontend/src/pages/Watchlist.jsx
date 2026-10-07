import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Line } from "react-chartjs-2";
import "@/lib/charts";
import { EMERALD, RED } from "@/lib/charts";
import { toast } from "sonner";
import api, { fmtNum, formatApiError } from "@/lib/api";
import usePriceStream from "@/hooks/usePriceStream";
import { LiveValue, LiveDot, ChangePill } from "@/components/LivePrice";
import { Star, MagnifyingGlass, Trash, Plus, Pulse } from "@phosphor-icons/react";
import { WatchlistEmpty } from "@/components/EmptyStates";

function Sparkline({ points, up }) {
  if (!points || points.length < 2) return <div className="h-10" />;
  return (
    <div className="h-10">
      <Line
        data={{
          labels: points.map((_, i) => i),
          datasets: [{
            data: points,
            borderColor: up ? EMERALD : RED,
            backgroundColor: up ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
            borderWidth: 1.5, pointRadius: 0, fill: true, tension: 0.35,
          }],
        }}
        options={{
          responsive: true, maintainAspectRatio: false, animation: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false } },
        }}
      />
    </div>
  );
}

export default function Watchlist() {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/watchlist").then((r) => setItems(r.data.items)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    const t = setTimeout(() => {
      api.get("/market/search", { params: { q } }).then((r) => setResults(r.data.results || [])).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // Live prices stream over WebSocket (falls back to polling automatically)
  const { quotes: streamed, live } = usePriceStream((items || []).map((i) => i.symbol));

  const pin = async (symbol) => {
    setBusy(true);
    try {
      await api.post("/watchlist", { symbol });
      toast.success(`${symbol} pinned`);
      setQ(""); setResults([]);
      load();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  const unpin = async (item) => {
    try {
      await api.delete(`/watchlist/${item.id}`);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e) {
      toast.error("Could not remove");
    }
  };

  return (
    <div className="px-5 sm:px-8 py-8 max-w-[1500px]" data-testid="watchlist-page">
      <div className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Market Board</p>
        <h1 className="mt-2 font-serif text-3xl sm:text-4xl tracking-tight">My Watchlist</h1>
        <div className="mt-2 flex items-center gap-3">
          <p className="text-sm text-slate-500 max-w-xl">
            Pin any global ticker. Prices stream in live over a WebSocket and flash the moment they move.
          </p>
          <LiveDot live={live} label="STREAMING" />
        </div>
      </div>

      <div className="max-w-xl mb-8">
        <div className="flex items-center gap-2 border border-slate-200 rounded-full px-4 py-3 focus-within:border-sky-400 transition-colors">
          <MagnifyingGlass size={15} className="text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            data-testid="watchlist-search"
            placeholder="Search a ticker to pin — NVDA, INFY.NS, HDFCBANK.NS…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
        </div>
        <AnimatePresence>
          {results.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-2 border border-slate-200/70 rounded-xl bg-white overflow-hidden">
              {results.slice(0, 8).map((r) => (
                <button key={r.symbol} onClick={() => pin(r.symbol)} disabled={busy}
                  data-testid={`watchlist-add-${r.symbol}`}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-sky-50 transition-colors text-left disabled:opacity-40">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{r.name}</p>
                    <p className="font-mono text-[10px] text-slate-500">{r.symbol} · {r.exchange}</p>
                  </div>
                  <Plus size={14} className="text-sky-600 shrink-0" />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {items === null ? (
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-400 animate-pulse">Loading watchlist…</p>
      ) : items.length === 0 ? (
        <WatchlistEmpty />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((it, i) => {
            const q = { ...(it.quote || {}), ...(streamed[it.symbol] || {}) };
            const up = (q.changePercent || 0) >= 0;
            return (
              <motion.div key={it.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }} className="card-flat lift p-5 group"
                data-testid="watchlist-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-600">{it.symbol}</p>
                    <p className="mt-0.5 truncate text-sm text-slate-700">{q.name || it.symbol}</p>
                  </div>
                  <button onClick={() => unpin(it)} data-testid={`watchlist-remove-${it.symbol}`}
                    className="shrink-0 h-7 w-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:border-rose-300 opacity-0 group-hover:opacity-100 transition-all">
                    <Trash size={12} />
                  </button>
                </div>

                {q.ok ? (
                  <>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <p className="font-mono text-[28px] font-light tracking-tighter text-slate-900">
                        <LiveValue value={q.price} currency={q.currency} testid={`live-price-${it.symbol}`} />
                      </p>
                      <ChangePill change={q.change} changePercent={q.changePercent} />
                    </div>
                    <div className="mt-3"><Sparkline points={q.spark || it.quote?.spark} up={up} /></div>
                    <div className="mt-3 grid grid-cols-3 gap-2 pt-3 border-t hairline">
                      {[["Day low", q.dayLow], ["Day high", q.dayHigh], ["Volume", q.volume]].map(([l, v]) => (
                        <div key={l}>
                          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">{l}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-slate-700">{v ? fmtNum(v) : "—"}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      <Pulse size={10} className="text-emerald-500" /> {q.exchange}
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-xs text-slate-400">Quote unavailable</p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
