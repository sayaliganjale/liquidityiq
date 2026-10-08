import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import api, { fmtMoney, formatApiError } from "@/lib/api";
import {
  MagnifyingGlass, DownloadSimple, UploadSimple, CaretLeft, CaretRight, FunnelSimple,
} from "@phosphor-icons/react";

export default function LedgerTable({ cid, slug, canWrite }) {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const timer = useRef(null);

  const load = () => {
    const params = { page, limit: 15 };
    if (search) params.search = search;
    if (direction) params.direction = direction;
    if (category) params.category = category;
    api.get(`/companies/${cid}/transactions`, { params })
      .then((r) => setData(r.data))
      .catch(() => {});
  };

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(load, 220);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid, search, direction, category, page]);

  useEffect(() => setPage(1), [search, direction, category]);

  const exportCsv = async () => {
    setBusy(true);
    try {
      const r = await api.get(`/companies/${cid}/transactions/export`, { responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug || "ledger"}-ledger.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Ledger exported");
    } catch (e) {
      toast.error("Export failed");
    } finally {
      setBusy(false);
    }
  };

  const importCsv = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    try {
      const r = await api.post(`/companies/${cid}/transactions/import`, form);
      toast.success(`Imported ${r.data.imported} rows${r.data.skipped ? `, skipped ${r.data.skipped}` : ""}`);
      load();
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="card-flat rounded-lg overflow-hidden" data-testid="ledger-table">
      <div className="px-6 py-4 border-b hairline flex flex-wrap items-center gap-3 justify-between">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
          Cash Transaction Ledger
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} disabled={busy} data-testid="export-csv-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 font-mono text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-900 hover:border-sky-300 transition-colors">
            <DownloadSimple size={13} /> CSV
          </button>
          {canWrite && (
            <>
              <input ref={fileRef} type="file" accept=".csv" onChange={importCsv} className="hidden"
                data-testid="import-csv-input" />
              <button onClick={() => fileRef.current?.click()} disabled={busy} data-testid="import-csv-btn"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 font-mono text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-900 hover:border-sky-300 transition-colors">
                <UploadSimple size={13} /> Import
              </button>
            </>
          )}
        </div>
      </div>

      <div className="px-6 py-3 border-b hairline flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <MagnifyingGlass size={14} className="text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            data-testid="ledger-search"
            placeholder="Search description or category…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
        </div>
        <div className="flex items-center gap-2">
          <FunnelSimple size={14} className="text-slate-400" />
          {["", "in", "out"].map((d) => (
            <button key={d || "all"} onClick={() => setDirection(d)}
              data-testid={`ledger-filter-${d || "all"}`}
              className={`px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider border transition-colors ${
                direction === d ? "border-sky-400 bg-sky-50 text-sky-700"
                  : "border-slate-200 text-slate-500 hover:text-slate-900"
              }`}>
              {d === "" ? "All" : d === "in" ? "Inflow" : "Outflow"}
            </button>
          ))}
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          data-testid="ledger-category-select"
          className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500 outline-none">
          <option value="">All categories</option>
          {(data?.categories || []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-400 border-b hairline">
              <th className="text-left px-6 py-3">Date</th>
              <th className="text-left px-6 py-3">Description</th>
              <th className="text-left px-6 py-3 hidden sm:table-cell">Category</th>
              <th className="text-right px-6 py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).map((tx) => (
              <tr key={tx.id} className="border-b hairline last:border-0 hover:bg-sky-50/50 transition-colors">
                <td className="px-6 py-3 font-mono text-xs text-slate-500">{tx.date}</td>
                <td className="px-6 py-3 text-slate-600">{tx.description}</td>
                <td className="px-6 py-3 hidden sm:table-cell font-mono text-xs text-slate-500">{tx.category}</td>
                <td className={`px-6 py-3 text-right font-mono ${tx.direction === "in" ? "text-emerald-600" : "text-rose-600"}`}>
                  {tx.direction === "in" ? "+" : "−"}{fmtMoney(tx.amount, tx.currency)}
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-10 text-center font-mono text-xs text-slate-400">
                No transactions match these filters.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="px-6 py-3 border-t hairline flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[10px] text-slate-400" data-testid="ledger-count">
            {data.total.toLocaleString()} entries · page {data.page} of {data.pages}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={data.page <= 1}
              data-testid="ledger-prev"
              className="h-7 w-7 rounded-full border border-slate-200 flex items-center justify-center disabled:opacity-25 hover:border-sky-300 transition-colors">
              <CaretLeft size={12} />
            </button>
            <button onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={data.page >= data.pages}
              data-testid="ledger-next"
              className="h-7 w-7 rounded-full border border-slate-200 flex items-center justify-center disabled:opacity-25 hover:border-sky-300 transition-colors">
              <CaretRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
