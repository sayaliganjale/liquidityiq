import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import { motion, AnimatePresence } from "framer-motion";
import api, { fmtMoney } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  MagnifyingGlass, ChartLineUp, Buildings, BellRinging, Sparkle, Star, UsersThree,
  Globe, Plus, ArrowRight, CornersOut, Receipt, SlidersHorizontal, Scales,
} from "@phosphor-icons/react";

const PAGES = [
  { label: "Overview", hint: "Consolidated liquidity dashboard", to: "/app", icon: ChartLineUp },
  { label: "Entities", hint: "Manage and onboard entities", to: "/app/entities", icon: Buildings },
  { label: "Alerts", hint: "Risk thresholds and alert centre", to: "/app/alerts", icon: BellRinging },
  { label: "AI Analyst", hint: "Ask the treasury analyst anything", to: "/app/analyst", icon: Sparkle },
  { label: "Market Search", hint: "Live global ticker lookup", to: "/app/market", icon: Globe },
  { label: "My Watchlist", hint: "Pinned tickers, streaming live", to: "/app/watchlist", icon: Star },
];

const TABS = [
  { key: "forecast", label: "90-day forecast", icon: ChartLineUp },
  { key: "scenario", label: "Scenario Lab", icon: SlidersHorizontal },
  { key: "capital", label: "Working capital", icon: Scales },
  { key: "analyst", label: "AI briefing", icon: Sparkle },
  { key: "ledger", label: "Ledger", icon: Receipt },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [entities, setEntities] = useState([]);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpenPalette = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("liquidityiq:open-palette", onOpenPalette);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("liquidityiq:open-palette", onOpenPalette);
    };
  }, []);

  useEffect(() => {
    if (open && entities.length === 0) {
      api.get("/companies").then((r) => setEntities(r.data)).catch(() => {});
    }
    if (!open) setQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const go = (to) => {
    setOpen(false);
    navigate(to);
  };

  const pages = useMemo(
    () => (user?.role === "admin"
      ? [...PAGES, { label: "Team & Access", hint: "Roles and members", to: "/app/team", icon: UsersThree }]
      : PAGES),
    [user]
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setOpen(false)}
          data-testid="command-palette-overlay"
          className="fixed inset-0 z-[70] bg-slate-900/25 backdrop-blur-md flex items-start justify-center px-4 pt-[12vh]"
        >
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.97, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl glass-panel rounded-2xl overflow-hidden"
            data-testid="command-palette"
          >
            <Command loop label="Command palette">
              <div className="flex items-center gap-3 px-5 border-b border-slate-100">
                <MagnifyingGlass size={17} className="text-sky-500 shrink-0" />
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  autoFocus
                  data-testid="palette-input"
                  placeholder="Jump to an entity, page or forecast…"
                  className="flex-1 h-14 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
                />
                <kbd className="text-[10px] font-semibold text-slate-400 border border-slate-200 rounded-md px-1.5 py-0.5">
                  ESC
                </kbd>
              </div>

              <Command.List className="max-h-[52vh] overflow-y-auto p-2">
                <Command.Empty className="px-4 py-10 text-center text-sm text-slate-400">
                  Nothing matches “{query}”.
                </Command.Empty>

                <Command.Group
                  heading="Entities"
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-slate-400"
                >
                  {entities.map((c) => (
                    <Command.Item
                      key={c.id}
                      value={`${c.name} ${c.ticker || ""} ${c.sector || ""} entity`}
                      onSelect={() => go(`/app/company/${c.id}`)}
                      data-testid={`palette-entity-${c.id}`}
                      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer aria-selected:bg-sky-50 transition-colors"
                    >
                      <span className="h-7 w-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                        style={{ background: c.logo_bg }}>{c.name[0]}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-slate-800 truncate">{c.name}</span>
                        <span className="block text-[11px] text-slate-400">
                          {c.ticker ? `${c.ticker} · ${c.exchange}` : "Private"} · {fmtMoney(c.total_cash, c.currency)}
                        </span>
                      </span>
                      <ArrowRight size={13} className="text-slate-300 group-aria-selected:text-sky-500 shrink-0" />
                    </Command.Item>
                  ))}
                </Command.Group>

                <Command.Group
                  heading="Go to"
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-slate-400"
                >
                  {pages.map((p) => (
                    <Command.Item
                      key={p.to}
                      value={`${p.label} ${p.hint}`}
                      onSelect={() => go(p.to)}
                      data-testid={`palette-page-${p.label.toLowerCase().replace(/\s/g, "-")}`}
                      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer aria-selected:bg-sky-50 transition-colors"
                    >
                      <p.icon size={16} className="text-sky-500 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-slate-800">{p.label}</span>
                        <span className="block text-[11px] text-slate-400">{p.hint}</span>
                      </span>
                      <ArrowRight size={13} className="text-slate-300 group-aria-selected:text-sky-500" />
                    </Command.Item>
                  ))}
                </Command.Group>

                {entities.length > 0 && (
                  <Command.Group
                    heading="Open a view"
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-slate-400"
                  >
                    {TABS.map((t) => (
                      <Command.Item
                        key={t.key}
                        value={`${t.label} of ${entities[0].name}`}
                        onSelect={() => go(`/app/company/${entities[0].id}?tab=${t.key}`)}
                        data-testid={`palette-tab-${t.key}`}
                        className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer aria-selected:bg-sky-50 transition-colors"
                      >
                        <t.icon size={16} className="text-slate-400 shrink-0" />
                        <span className="flex-1 text-sm text-slate-800">
                          {t.label} <span className="text-slate-400">— {entities[0].name}</span>
                        </span>
                        <CornersOut size={13} className="text-slate-300 group-aria-selected:text-sky-500" />
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                <Command.Group
                  heading="Actions"
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-slate-400"
                >
                  <Command.Item value="onboard a new listed ticker company"
                    onSelect={() => go("/app/entities?new=ticker")}
                    data-testid="palette-action-onboard"
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer aria-selected:bg-sky-50 transition-colors">
                    <Globe size={16} className="text-sky-500" />
                    <span className="flex-1 text-sm text-slate-800">Onboard a listed ticker</span>
                  </Command.Item>
                  <Command.Item value="create new private entity"
                    onSelect={() => go("/app/entities?new=private")}
                    data-testid="palette-action-private"
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer aria-selected:bg-sky-50 transition-colors">
                    <Plus size={16} className="text-sky-500" />
                    <span className="flex-1 text-sm text-slate-800">Create a private entity</span>
                  </Command.Item>
                  <Command.Item value="create new alert threshold rule"
                    onSelect={() => go("/app/alerts?new=rule")}
                    data-testid="palette-action-rule"
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer aria-selected:bg-sky-50 transition-colors">
                    <BellRinging size={16} className="text-sky-500" />
                    <span className="flex-1 text-sm text-slate-800">Create an alert rule</span>
                  </Command.Item>
                </Command.Group>
              </Command.List>

              <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <kbd className="border border-slate-200 rounded px-1.5 py-0.5">↑↓</kbd> navigate
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="border border-slate-200 rounded px-1.5 py-0.5">↵</kbd> open
                </span>
                <span className="ml-auto text-sky-500">LiquidityIQ</span>
              </div>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
