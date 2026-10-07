import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import api, { fmtMoney, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { EntityCardSkeleton } from "@/components/Skeleton";
import {
  Buildings, Plus, MagnifyingGlass, Trash, PencilSimple, X, Globe, Lock, ArrowRight,
} from "@phosphor-icons/react";

const CURRENCIES = ["USD", "INR", "EUR", "GBP", "AED", "SGD", "JPY"];
const SWATCHES = ["#1B4D3E", "#0A2540", "#12233A", "#2A1A3E", "#3E2A1A", "#1A3E2A", "#3E1A2A"];

export default function Entities() {
  const { user } = useAuth();
  const canWrite = ["admin", "analyst"].includes(user?.role);
  const [items, setItems] = useState(null);
  const [mode, setMode] = useState(null); // "private" | "public" | edit id
  const [editing, setEditing] = useState(null);

  const [params, setParams] = useSearchParams();

  const load = () => api.get("/companies").then((r) => setItems(r.data)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const n = params.get("new");
    if (n === "ticker") setMode("public");
    if (n === "private") setMode("private");
    if (n) setParams({}, { replace: true });
  }, [params, setParams]);

  const remove = async (c) => {
    if (!window.confirm(`Delete ${c.name} and its entire ledger? This cannot be undone.`)) return;
    try {
      await api.delete(`/companies/${c.id}`);
      toast.success(`${c.name} removed`);
      load();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    }
  };

  return (
    <div className="px-5 sm:px-8 py-8 max-w-[1500px]" data-testid="entities-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-400">Portfolio</p>
          <h1 className="mt-2 font-serif text-3xl sm:text-4xl tracking-tight">Entity Management</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-xl">
            Onboard a live listed company from any global exchange, or create a private entity — each one
            gets a generated 120-day ledger, bank accounts and AR/AP book ready for forecasting.
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <button onClick={() => setMode("public")} data-testid="open-onboard-ticker"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-sky-500 hover:bg-sky-600 transition-colors font-mono text-[10px] uppercase tracking-wider">
              <Globe size={14} /> Onboard ticker
            </button>
            <button onClick={() => setMode("private")} data-testid="open-create-private"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-300 hover:border-sky-400 transition-colors font-mono text-[10px] uppercase tracking-wider">
              <Plus size={14} /> Private entity
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(items || []).map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="card-flat rounded-lg p-5 group" data-testid="entity-card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-11 w-11 rounded-xl flex items-center justify-center font-serif text-lg text-white shrink-0 shadow-[0_6px_16px_rgba(15,23,42,0.18)]"
                  style={{ background: c.logo_bg }}>{c.name[0]}</span>
                <div className="min-w-0">
                  <p className="truncate">{c.name}</p>
                  <p className="font-mono text-[10px] text-slate-500 truncate">
                    {c.ticker ? `${c.ticker} · ${c.exchange}` : "Private"} · {c.currency}
                  </p>
                </div>
              </div>
              <span className={`shrink-0 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider px-2 py-1 rounded-full border ${
                c.kind === "public" ? "border-sky-200 text-sky-700 bg-sky-50/70"
                  : "border-slate-200 text-slate-500"}`}>
                {c.kind === "public" ? <Globe size={9} /> : <Lock size={9} />}{c.kind}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[["Cash", c.total_cash], ["AR", c.total_ar], ["AP", c.total_ap]].map(([l, v]) => (
                <div key={l}>
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400">{l}</p>
                  <p className="mt-1 font-mono text-xs">{fmtMoney(v, c.currency)}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <Link to={`/app/company/${c.id}`} data-testid={`entity-open-${c.id}`}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-colors">
                Open <ArrowRight size={12} />
              </Link>
              {canWrite && (c.is_owner || user?.role === "admin") && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditing(c); setMode("edit"); }}
                    data-testid={`entity-edit-${c.id}`}
                    className="h-7 w-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-sky-300 transition-colors">
                    <PencilSimple size={12} />
                  </button>
                  <button onClick={() => remove(c)} data-testid={`entity-delete-${c.id}`}
                    className="h-7 w-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:border-rose-300 transition-colors">
                    <Trash size={12} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {items === null && (
          <>{[1,2,3,4,5,6].map(i => <EntityCardSkeleton key={i} />)}</>
        )}
      </div>

      <AnimatePresence>
        {mode && (
          <Modal onClose={() => { setMode(null); setEditing(null); }}>
            {mode === "public" && <OnboardForm onDone={() => { setMode(null); load(); }} />}
            {mode === "private" && <PrivateForm onDone={() => { setMode(null); load(); }} />}
            {mode === "edit" && editing && (
              <EditForm company={editing} onDone={() => { setMode(null); setEditing(null); load(); }} />
            )}
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose} data-testid="entity-modal">
      <motion.div initial={{ y: 20, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 10, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white border border-slate-200 rounded-xl p-6 my-8">
        <div className="flex justify-end -mt-2 -mr-2">
          <button onClick={onClose} data-testid="modal-close" className="text-slate-500 hover:text-slate-900 transition-colors">
            <X size={16} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

const inputCls =
  "mt-2 w-full bg-transparent border border-slate-200 rounded-md px-3 py-2.5 text-sm focus:border-sky-400 outline-none transition-colors";
const labelCls = "font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500";

function OnboardForm({ onDone }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    const t = setTimeout(() => {
      api.get("/market/search", { params: { q } }).then((r) => setResults(r.data.results || [])).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const onboard = async (symbol) => {
    setBusy(true);
    try {
      const r = await api.post("/companies/onboard", { ticker: symbol });
      toast.success(`${r.data.name} onboarded with ${fmtMoney(r.data.opening_cash, r.data.currency)} opening cash`);
      onDone();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="font-serif text-2xl">Onboard a listed company</h2>
      <p className="mt-1 text-sm text-slate-500">
        Search any global exchange — NSE, BSE, NASDAQ, NYSE and more. We pull the live quote and build a
        treasury profile around it.
      </p>
      <div className="mt-5 flex items-center gap-2 border border-slate-200 rounded-md px-3 py-2.5 focus-within:border-sky-400 transition-colors">
        <MagnifyingGlass size={15} className="text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus
          data-testid="onboard-search-input"
          placeholder="Tata Motors, AAPL, RELIANCE.NS…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
      </div>
      <div className="mt-4 max-h-72 overflow-y-auto space-y-1">
        {results.map((r) => (
          <button key={r.symbol} onClick={() => onboard(r.symbol)} disabled={busy}
            data-testid={`onboard-result-${r.symbol}`}
            className="w-full text-left flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-sky-50 disabled:opacity-40 transition-colors">
            <div className="min-w-0">
              <p className="text-sm truncate">{r.name}</p>
              <p className="font-mono text-[10px] text-slate-500">{r.symbol} · {r.exchange}</p>
            </div>
            <Plus size={14} className="text-sky-600 shrink-0" />
          </button>
        ))}
        {q.trim().length >= 2 && results.length === 0 && (
          <p className="font-mono text-[11px] text-slate-400 px-3 py-2">No matches yet…</p>
        )}
      </div>
    </div>
  );
}

function PrivateForm({ onDone }) {
  const [form, setForm] = useState({
    name: "", currency: "USD", sector: "General", country: "United States",
    opening_cash: 2500000, logo_bg: SWATCHES[0],
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post("/companies", { ...form, opening_cash: Number(form.opening_cash) });
      toast.success(`${r.data.name} created with ${r.data.generated_transactions} ledger entries`);
      onDone();
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} data-testid="private-entity-form">
      <h2 className="font-serif text-2xl">New private entity</h2>
      <p className="mt-1 text-sm text-slate-500">A 120-day ledger, three bank accounts and an AR/AP book are generated automatically.</p>
      <div className="mt-5 space-y-4">
        <div>
          <label className={labelCls}>Entity name</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            data-testid="private-name" placeholder="Meridian Holdings Pvt" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Currency</label>
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
              data-testid="private-currency" className={`${inputCls} bg-white`}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Opening cash</label>
            <input required type="number" min="1000" value={form.opening_cash}
              onChange={(e) => setForm({ ...form, opening_cash: e.target.value })}
              data-testid="private-cash" className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Sector</label>
            <input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}
              data-testid="private-sector" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Country</label>
            <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
              data-testid="private-country" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Brand mark</label>
          <div className="mt-2 flex gap-2">
            {SWATCHES.map((s) => (
              <button key={s} type="button" onClick={() => setForm({ ...form, logo_bg: s })}
                className={`h-8 w-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                  form.logo_bg === s ? "border-white" : "border-transparent"}`}
                style={{ background: s }} />
            ))}
          </div>
        </div>
      </div>
      <button type="submit" disabled={busy} data-testid="private-submit"
        className="mt-6 w-full py-3 rounded-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 transition-colors font-mono text-[10px] uppercase tracking-[0.2em]">
        {busy ? "Generating ledger…" : "Create entity"}
      </button>
    </form>
  );
}

function EditForm({ company, onDone }) {
  const [form, setForm] = useState({
    name: company.name, currency: company.currency, sector: company.sector || "",
    country: company.country || "", logo_bg: company.logo_bg,
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/companies/${company.id}`, form);
      toast.success("Entity updated");
      onDone();
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} data-testid="edit-entity-form">
      <h2 className="font-serif text-2xl">Edit entity</h2>
      <div className="mt-5 space-y-4">
        <div>
          <label className={labelCls}>Entity name</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            data-testid="edit-name" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Sector</label>
            <input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}
              className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Country</label>
            <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
              className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Brand mark</label>
          <div className="mt-2 flex gap-2">
            {SWATCHES.map((s) => (
              <button key={s} type="button" onClick={() => setForm({ ...form, logo_bg: s })}
                className={`h-8 w-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                  form.logo_bg === s ? "border-white" : "border-transparent"}`}
                style={{ background: s }} />
            ))}
          </div>
        </div>
      </div>
      <button type="submit" disabled={busy} data-testid="edit-submit"
        className="mt-6 w-full py-3 rounded-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 transition-colors font-mono text-[10px] uppercase tracking-[0.2em]">
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
