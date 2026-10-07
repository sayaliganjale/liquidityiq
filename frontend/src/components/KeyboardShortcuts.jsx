import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChartLineUp, Buildings, BellRinging, Sparkle, MagnifyingGlass, Star,
  Plus, Keyboard, X,
} from "@phosphor-icons/react";

const SHORTCUTS = [
  { keys: ["G", "D"], label: "Go to Dashboard",      to: "/app",           icon: ChartLineUp },
  { keys: ["G", "E"], label: "Go to Entities",        to: "/app/entities",  icon: Buildings },
  { keys: ["G", "A"], label: "Go to Alerts",          to: "/app/alerts",    icon: BellRinging },
  { keys: ["G", "I"], label: "Go to AI Analyst",      to: "/app/analyst",   icon: Sparkle },
  { keys: ["G", "M"], label: "Go to Market",          to: "/app/market",    icon: MagnifyingGlass },
  { keys: ["G", "W"], label: "Go to Watchlist",       to: "/app/watchlist", icon: Star },
  { keys: ["N", "E"], label: "New Entity",            to: "/app/entities?new=private", icon: Plus },
  { keys: ["N", "R"], label: "New Alert Rule",        to: "/app/alerts?new=rule",      icon: Plus },
  { keys: ["⌘", "K"], label: "Command Palette",      action: "palette",    icon: MagnifyingGlass },
  { keys: ["?"],      label: "Keyboard Shortcuts",    action: "help",       icon: Keyboard },
];

/**
 * Registers global keyboard shortcuts (two-key combos like G+D)
 * and renders a shortcut cheat-sheet modal on "?".
 */
export default function KeyboardShortcuts() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);
  const [prefix, setPrefix] = useState(null);

  const handleShortcut = useCallback((shortcut) => {
    if (shortcut.action === "palette") {
      window.dispatchEvent(new Event("liquidityiq:open-palette"));
    } else if (shortcut.action === "help") {
      setShowHelp(true);
    } else if (shortcut.to) {
      navigate(shortcut.to);
    }
  }, [navigate]);

  useEffect(() => {
    let timer = null;

    const onKey = (e) => {
      // Don't capture shortcuts when typing in an input/textarea/select
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable) return;
      // Don't intercept ⌘K — that's handled by CommandPalette
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toUpperCase();

      // "?" key → show help
      if (e.key === "?") {
        e.preventDefault();
        setShowHelp((s) => !s);
        return;
      }

      if (prefix) {
        // We have a prefix key — look for a two-key combo
        const match = SHORTCUTS.find(
          (s) => s.keys.length === 2 && s.keys[0] === prefix && s.keys[1] === key
        );
        if (match) {
          e.preventDefault();
          handleShortcut(match);
        }
        setPrefix(null);
        clearTimeout(timer);
        return;
      }

      // Check if this could be a prefix key (G or N)
      if (key === "G" || key === "N") {
        e.preventDefault();
        setPrefix(key);
        timer = setTimeout(() => setPrefix(null), 800);
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, [prefix, handleShortcut]);

  return (
    <>
      {/* Prefix indicator toast */}
      <AnimatePresence>
        {prefix && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white rounded-lg px-4 py-2 flex items-center gap-2 shadow-[0_20px_40px_rgba(0,0,0,0.3)]"
          >
            <kbd className="text-xs bg-white/20 rounded px-1.5 py-0.5">{prefix}</kbd>
            <span className="text-xs text-slate-300">then…</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setShowHelp(false)}
            className="fixed inset-0 z-[80] bg-slate-900/25 backdrop-blur-md flex items-center justify-center p-4"
            data-testid="shortcuts-modal"
          >
            <motion.div
              initial={{ y: -12, scale: 0.97 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: -8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md glass-panel rounded-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Keyboard size={17} className="text-sky-500" />
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    Keyboard Shortcuts
                  </h3>
                </div>
                <button
                  onClick={() => setShowHelp(false)}
                  className="text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-4 max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
                {SHORTCUTS.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center justify-between py-3 px-2"
                  >
                    <span className="flex items-center gap-2.5 text-sm text-slate-700">
                      <s.icon size={14} className="text-slate-400" />
                      {s.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, i) => (
                        <span key={i}>
                          <kbd className="font-mono text-[10px] font-semibold bg-slate-100 border border-slate-200 rounded-md px-1.5 py-0.5 text-slate-600">
                            {k}
                          </kbd>
                          {i < s.keys.length - 1 && (
                            <span className="text-[10px] text-slate-400 mx-0.5">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-5 py-3 border-t border-slate-100 text-center">
                <p className="font-mono text-[10px] text-slate-400 uppercase tracking-[0.14em]">
                  Press <kbd className="border border-slate-200 rounded px-1 py-0.5">?</kbd> to toggle
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
