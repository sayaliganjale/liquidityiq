import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import api, { fmtNum, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  BellRinging, Plus, Trash, ShieldCheck, X, ToggleLeft, ToggleRight, ArrowRight,
} from "@phosphor-icons/react";

const SEVERITIES = ["critical", "warning", "info"];
const SEV_STYLE = {
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  info: "border-sky-200 bg-sky-500/[0.06] text-sky-700",
};

export default function Alerts() {
  const { user } = useAuth();
  const canWrite = ["admin", "analyst"].includes(user?.role);
  const [data, setData] = useState(null);
  const [rules, setRules] = useState(null);
  const [meta, setMeta] = useState({ metrics: {}, operators: {} });
  const [entities, setEntities] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [params, setParams] = useSearchParams();

  const loadAll = () => {
    api.get("/alerts").then((r) => setData(r.data)).catch(() => setData({ alerts: [], count: 0 }));
    api.get("/alerts/rules").then((r) => {
      setRules(r.data.rules);
      setMeta({ metrics: r.data.metrics, operators: r.data.operators });
    }).catch(() => setRules([]));
  };

  useEffect(() => {
    loadAll();
    api.get("/companies").then((r) => setEntities(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (params.get("new") === "rule") {
      setShowNew(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const toggle = async (rule) => {
    try {
      await api.patch(`/alerts/rules/${rule.id}`, { active: !rule.active });
      loadAll();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    }
  };

  const remove = async (rule) => {
    try {
      await api.delete(`/alerts/rules/${rule.id}`);
      toast.success("Rule deleted");
      loadAll();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    }
  };

  return (
    <div className="px-5 sm:px-8 py-8 max-w-[1500px]" data-testid="alerts-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-400">Risk Controls</p>
          <h1 className="mt-2 font-serif text-3xl sm:text-4xl tracking-tight">Alerts & Rules Engine</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-xl">
            Thresholds are evaluated against every entity's live ML forecast on each load — runway, projected
            trough, cash position, model confidence and risk grade.
          </p>
        </div>
        {canWrite && (
          <button onClick={() => setShowNew(true)} data-testid="open-new-rule"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-sky-500 hover:bg-sky-600 transition-colors font-mono text-[10px] uppercase tracking-wider">
            <Plus size={14} /> New rule
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          ["Triggered", data?.count ?? "—", "text-slate-900"],
          ["Critical", data?.critical ?? "—", "text-rose-600"],
          ["Warnings", data?.warning ?? "—", "text-amber-600"],
          ["Entities scanned", data?.entities_scanned ?? "—", "text-slate-600"],
        ].map(([l, v, tone]) => (
          <div key={l} className="border border-slate-200/70 rounded-lg p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{l}</p>
            <p className={`mt-2 font-mono text-2xl ${tone}`}>{v}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">
        <div className="card-flat rounded-lg overflow-hidden" data-testid="alerts-feed">
          <div className="px-6 py-4 border-b hairline flex items-center gap-2">
            <BellRinging size={16} className="text-amber-600" />
            <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">Alert Centre</h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
            {(data?.alerts || []).map((a, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }} className="px-6 py-4" data-testid="alert-item">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${SEV_STYLE[a.severity]}`}>
                        {a.severity}
                      </span>
                      <p className="text-sm truncate">{a.company_name}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {a.rule_name} — {a.metric_label} is{" "}
                      <span className="font-mono text-slate-900">{fmtNum(a.actual)}</span>{" "}
                      <span className="text-slate-400">(rule: {a.operator} {fmtNum(a.threshold)})</span>
                    </p>
                  </div>
                  <Link to={`/app/company/${a.company_id}`}
                    data-testid={`alert-open-${a.company_id}`}
                    className="shrink-0 h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-sky-300 transition-colors">
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </motion.div>
            ))}
            {data && data.alerts.length === 0 && (
              <div className="px-6 py-16 text-center" data-testid="alerts-empty">
                <ShieldCheck size={28} className="mx-auto text-emerald-600/70" />
                <p className="mt-3 text-sm text-slate-500">No thresholds breached.</p>
                <p className="mt-1 font-mono text-[11px] text-slate-400">
                  All {data.entities_scanned} entities are inside their liquidity limits.
                </p>
              </div>
            )}
            {!data && <p className="px-6 py-10 font-mono text-xs text-slate-400 animate-pulse">Evaluating rules…</p>}
          </div>
        </div>

        <div className="card-flat rounded-lg overflow-hidden" data-testid="rules-list">
          <div className="px-6 py-4 border-b hairline">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">Threshold Rules</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {(rules || []).map((r) => (
              <div key={r.id} className="px-6 py-4 flex items-start justify-between gap-3" data-testid="rule-item">
                <div className="min-w-0">
                  <p className={`text-sm truncate ${r.active ? "text-slate-900" : "text-slate-400 line-through"}`}>{r.name}</p>
                  <p className="mt-1 font-mono text-[10px] text-slate-500">
                    {meta.metrics[r.metric] || r.metric} {meta.operators[r.op] || r.op} {fmtNum(r.value)}
                    {" · "}
                    {r.scope === "all" ? "all entities" : (entities.find((e) => e.id === r.scope)?.name || "one entity")}
                  </p>
                </div>
                {canWrite && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggle(r)} data-testid={`rule-toggle-${r.id}`}
                      title={r.active ? "Disable" : "Enable"}
                      className={`h-7 w-7 rounded-full border flex items-center justify-center transition-colors ${
                        r.active ? "border-emerald-200 text-emerald-600" : "border-slate-200 text-slate-400"}`}>
                      {r.active ? <ToggleRight size={14} weight="fill" /> : <ToggleLeft size={14} />}
                    </button>
                    <button onClick={() => remove(r)} data-testid={`rule-delete-${r.id}`}
                      className="h-7 w-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:border-rose-300 transition-colors">
                      <Trash size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {!rules && <p className="px-6 py-10 font-mono text-xs text-slate-400 animate-pulse">Loading rules…</p>}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showNew && (
          <NewRuleModal meta={meta} entities={entities}
            onClose={() => setShowNew(false)}
            onSaved={() => { setShowNew(false); loadAll(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function NewRuleModal({ meta, entities, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: "", metric: "runway_days", op: "lt", value: 30, severity: "critical", scope: "all", active: true,
  });
  const [busy, setBusy] = useState(false);
  const cls = "mt-2 w-full bg-white border border-slate-200 rounded-md px-3 py-2.5 text-sm focus:border-sky-400 outline-none transition-colors";
  const lbl = "font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500";

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/alerts/rules", { ...form, value: Number(form.value) });
      toast.success("Rule created");
      onSaved();
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose} data-testid="new-rule-modal"
      className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.form initial={{ y: 20, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 10, opacity: 0 }}
        onClick={(e) => e.stopPropagation()} onSubmit={submit}
        className="w-full max-w-lg bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-serif text-2xl">New threshold rule</h2>
            <p className="mt-1 text-sm text-slate-500">Fires whenever the metric crosses your limit.</p>
          </div>
          <button type="button" onClick={onClose} data-testid="rule-modal-close" className="text-slate-500 hover:text-slate-900">
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className={lbl}>Rule name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              data-testid="rule-name" placeholder="Runway below 45 days" className={cls} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={lbl}>Metric</label>
              <select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}
                data-testid="rule-metric" className={cls}>
                {Object.entries(meta.metrics).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Operator</label>
              <select value={form.op} onChange={(e) => setForm({ ...form, op: e.target.value })}
                data-testid="rule-op" className={cls}>
                {Object.entries(meta.operators).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Threshold</label>
              <input required type="number" value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                data-testid="rule-value" className={cls} />
            </div>
            <div>
              <label className={lbl}>Severity</label>
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}
                data-testid="rule-severity" className={cls}>
                {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Applies to</label>
            <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}
              data-testid="rule-scope" className={cls}>
              <option value="all">All entities</option>
              {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>

        <button type="submit" disabled={busy} data-testid="rule-submit"
          className="mt-6 w-full py-3 rounded-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 transition-colors font-mono text-[10px] uppercase tracking-[0.2em]">
          {busy ? "Saving…" : "Create rule"}
        </button>
      </motion.form>
    </motion.div>
  );
}
