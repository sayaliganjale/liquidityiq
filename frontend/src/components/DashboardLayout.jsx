import { useEffect, useRef, useState } from "react";
import { Outlet, NavLink, useNavigate, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import CommandPalette from "@/components/CommandPalette";
import {
  TrendUp, ChartLineUp, MagnifyingGlass, SignOut, Buildings, BellRinging, Star, Sparkle,
  UsersThree, Command as CommandIcon,
} from "@phosphor-icons/react";

const NAV = [
  { to: "/app", label: "Overview", icon: ChartLineUp, end: true, testid: "nav-overview" },
  { to: "/app/entities", label: "Entities", icon: Buildings, testid: "nav-entities" },
  { to: "/app/alerts", label: "Alerts", icon: BellRinging, testid: "nav-alerts", badge: true },
  { to: "/app/analyst", label: "AI Analyst", icon: Sparkle, testid: "nav-analyst" },
];

const MARKET_NAV = [
  { to: "/app/market", label: "Market Search", icon: MagnifyingGlass, testid: "nav-market" },
  { to: "/app/watchlist", label: "My Watchlist", icon: Star, testid: "nav-watchlist" },
];

const openPalette = () => window.dispatchEvent(new Event("liquidityiq:open-palette"));

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [alerts, setAlerts] = useState(null);
  const mainRef = useRef(null);

  // Scroll main content to top on route change
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  useEffect(() => {
    const load = () => api.get("/alerts").then((r) => setAlerts(r.data)).catch(() => {});
    load();
    const iv = setInterval(load, 90000);
    return () => clearInterval(iv);
  }, []);

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  const badge = alerts?.count || 0;
  const critical = alerts?.critical || 0;

  const link = ({ isActive }) =>
    `group relative flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-300 ${
      isActive
        ? "bg-sky-50 text-sky-700 font-semibold shadow-[inset_0_0_0_1px_rgba(14,165,233,0.18)]"
        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
    }`;

  return (
    <div className="min-h-screen grain-bg text-slate-900 flex">
      <CommandPalette />

      <aside className="hidden lg:flex w-64 flex-col border-r hairline fixed h-screen bg-white/80 backdrop-blur-xl z-20">
        <Link to="/" className="flex items-center gap-2.5 px-6 py-6 border-b hairline group" data-testid="sidebar-logo">
          <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shadow-[0_6px_16px_rgba(14,165,233,0.35)] transition-transform duration-300 group-hover:scale-110">
            <TrendUp size={17} weight="bold" className="text-white" />
          </span>
          <span className="font-serif text-lg tracking-tight">LiquidityIQ</span>
        </Link>

        <div className="px-3 pt-4">
          <button onClick={openPalette} data-testid="palette-trigger"
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:border-sky-300 hover:text-slate-600 hover:shadow-[0_6px_18px_rgba(14,165,233,0.10)] transition-all duration-300">
            <MagnifyingGlass size={15} />
            <span className="text-[13px]">Jump to…</span>
            <kbd className="ml-auto text-[10px] font-semibold border border-slate-200 rounded-md px-1.5 py-0.5 flex items-center gap-0.5">
              <CommandIcon size={9} weight="bold" />K
            </kbd>
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Treasury</p>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} data-testid={n.testid} className={link}>
              <span className="flex items-center gap-3">
                <n.icon size={17} className="transition-transform duration-300 group-hover:scale-110" />
                {n.label}
              </span>
              {n.badge && badge > 0 && (
                <motion.span
                  key={badge}
                  initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  data-testid="alert-badge"
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                    critical > 0
                      ? "bg-rose-50 text-rose-600 border-rose-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}>
                  {badge}
                </motion.span>
              )}
            </NavLink>
          ))}

          <p className="px-3 pt-6 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Markets</p>
          {MARKET_NAV.map((n) => (
            <NavLink key={n.to} to={n.to} data-testid={n.testid} className={link}>
              <span className="flex items-center gap-3">
                <n.icon size={17} className="transition-transform duration-300 group-hover:scale-110" />
                {n.label}
              </span>
            </NavLink>
          ))}

          {user?.role === "admin" && (
            <>
              <p className="px-3 pt-6 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Admin</p>
              <NavLink to="/app/team" data-testid="nav-team" className={link}>
                <span className="flex items-center gap-3"><UsersThree size={17} />Team &amp; Access</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="px-3 py-4 border-t hairline">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-sky-100 to-sky-200 border border-sky-200 flex items-center justify-center text-[11px] font-bold uppercase text-sky-700">
              {(user?.name || "U")[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm truncate text-slate-800">{user?.name}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 truncate">{user?.role}</p>
            </div>
          </div>
          <button onClick={doLogout} data-testid="logout-btn"
            className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors">
            <SignOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="lg:hidden fixed top-0 inset-x-0 z-30 glass-nav flex items-center justify-between px-4 py-3">
        <Link to="/app" className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
            <TrendUp size={14} weight="bold" className="text-white" />
          </span>
          <span className="font-serif text-base">LiquidityIQ</span>
        </Link>
        <div className="flex items-center gap-3.5 text-slate-500">
          <button onClick={openPalette} data-testid="m-palette-trigger"><MagnifyingGlass size={19} /></button>
          <NavLink to="/app" end data-testid="m-nav-overview"><ChartLineUp size={19} /></NavLink>
          <NavLink to="/app/entities" data-testid="m-nav-entities"><Buildings size={19} /></NavLink>
          <NavLink to="/app/alerts" className="relative" data-testid="m-nav-alerts">
            <BellRinging size={19} />
            {badge > 0 && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-rose-500" />}
          </NavLink>
          <NavLink to="/app/analyst" data-testid="m-nav-analyst"><Sparkle size={19} /></NavLink>
          <button onClick={doLogout} data-testid="m-logout-btn"><SignOut size={19} /></button>
        </div>
      </div>

      <main ref={mainRef} className="flex-1 lg:ml-64 pt-16 lg:pt-0 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
