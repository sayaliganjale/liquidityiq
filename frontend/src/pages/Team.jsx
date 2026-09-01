import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { UsersThree, ShieldWarning, Crown, ChartLine, Eye } from "@phosphor-icons/react";

const ROLE_META = {
  admin: { icon: Crown, desc: "Full control — manage every entity, shared demo data and team roles.", tone: "text-amber-700 border-amber-200 bg-amber-50" },
  analyst: { icon: ChartLine, desc: "Create and manage their own entities, rules and forecasts.", tone: "text-sky-700 border-sky-200 bg-sky-50/70" },
  viewer: { icon: Eye, desc: "Read-only access to dashboards, forecasts and reports.", tone: "text-slate-500 border-slate-200 bg-slate-50" },
};

export default function Team() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const load = () =>
    api.get("/team/users")
      .then((r) => setData(r.data))
      .catch((e) => setErr(formatApiError(e?.response?.data?.detail)));

  useEffect(() => { load(); }, []);

  const setRole = async (u, role) => {
    try {
      await api.patch(`/team/users/${u.id}`, { role });
      toast.success(`${u.name} is now ${role}`);
      load();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    }
  };

  if (err)
    return (
      <div className="px-5 sm:px-8 py-16 max-w-xl" data-testid="team-forbidden">
        <ShieldWarning size={28} className="text-amber-600" />
        <h1 className="mt-4 font-serif text-2xl">Restricted</h1>
        <p className="mt-2 text-sm text-slate-500">{err}</p>
      </div>
    );

  return (
    <div className="px-5 sm:px-8 py-8 max-w-[1200px]" data-testid="team-page">
      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-400">Governance</p>
        <h1 className="mt-2 font-serif text-3xl sm:text-4xl tracking-tight">Team & Access</h1>
        <p className="mt-2 text-sm text-slate-500 max-w-xl">
          Entities you create are private to you. Seeded demo entities stay shared across the workspace and
          can only be edited by an admin.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
        {Object.entries(ROLE_META).map(([role, m]) => (
          <div key={role} className={`border rounded-lg p-4 ${m.tone}`}>
            <div className="flex items-center gap-2">
              <m.icon size={15} />
              <p className="font-mono text-[10px] uppercase tracking-[0.2em]">{role}</p>
            </div>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">{m.desc}</p>
          </div>
        ))}
      </div>

      <div className="card-flat rounded-lg overflow-hidden" data-testid="team-table">
        <div className="px-6 py-4 border-b hairline flex items-center gap-2">
          <UsersThree size={16} className="text-sky-600" />
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">Workspace Members</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {(data?.users || []).map((u, i) => (
            <motion.div key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
              className="px-6 py-4 flex flex-wrap items-center justify-between gap-4" data-testid="team-member">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-sky-100 border border-sky-200 flex items-center justify-center font-mono text-xs uppercase shrink-0">
                  {(u.name || u.email)[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm truncate">
                    {u.name}
                    {u.id === user?._id && <span className="ml-2 font-mono text-[9px] text-slate-400 uppercase">you</span>}
                  </p>
                  <p className="font-mono text-[10px] text-slate-500 truncate">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <p className="font-mono text-[10px] text-slate-400 hidden sm:block">
                  {u.entities_owned} owned
                </p>
                <div className="flex gap-1">
                  {(data?.roles || []).map((r) => (
                    <button key={r} onClick={() => setRole(u, r)} disabled={u.role === r}
                      data-testid={`set-role-${u.id}-${r}`}
                      className={`px-2.5 py-1 rounded-full font-mono text-[9px] uppercase tracking-wider border transition-colors ${
                        u.role === r
                          ? "border-sky-400 bg-sky-50 text-sky-700 cursor-default"
                          : "border-slate-200 text-slate-500 hover:text-slate-900 hover:border-sky-300"
                      }`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
          {!data && <p className="px-6 py-10 font-mono text-xs text-slate-400 animate-pulse">Loading members…</p>}
        </div>
      </div>
    </div>
  );
}
