import { motion } from "framer-motion";

/**
 * Animated empty state for the Watchlist page.
 * Renders a stylized star constellation with floating particles.
 */
export function WatchlistEmpty() {
  return (
    <div
      className="border border-dashed border-slate-200 rounded-xl px-8 py-16 text-center"
      data-testid="watchlist-empty"
    >
      <div className="relative w-32 h-32 mx-auto mb-6">
        {/* Background glow */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-sky-100 to-sky-50 blur-xl opacity-60" />

        {/* Main star icon */}
        <motion.svg
          viewBox="0 0 120 120"
          className="relative w-full h-full"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Orbiting dots */}
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.circle
              key={i}
              cx={60 + Math.cos((i * 72 * Math.PI) / 180) * 45}
              cy={60 + Math.sin((i * 72 * Math.PI) / 180) * 45}
              r={2.5}
              fill="#BAE6FD"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2.5, delay: i * 0.3, repeat: Infinity }}
            />
          ))}

          {/* Central star */}
          <motion.path
            d="M60 25L67.5 47.5H91L72 61L79 83.5L60 70L41 83.5L48 61L29 47.5H52.5L60 25Z"
            fill="none"
            stroke="#0EA5E9"
            strokeWidth={2}
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* Inner glow */}
          <circle cx={60} cy={58} r={8} fill="#E0F2FE" opacity={0.6} />
        </motion.svg>

        {/* Floating sparkles */}
        {[
          { x: 10, y: 20, delay: 0 },
          { x: 100, y: 30, delay: 0.5 },
          { x: 25, y: 90, delay: 1 },
        ].map((p, i) => (
          <motion.div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-sky-400"
            style={{ left: p.x, top: p.y }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0.5, 1.5, 0.5],
              y: [0, -8, 0],
            }}
            transition={{ duration: 2.5, delay: p.delay, repeat: Infinity }}
          />
        ))}
      </div>

      <p className="text-sm text-slate-600 font-medium">Your watchlist is empty</p>
      <p className="mt-1.5 font-mono text-[11px] text-slate-400 max-w-xs mx-auto">
        Search above to pin your first ticker. Prices will stream in live over WebSocket.
      </p>
    </div>
  );
}

/**
 * Animated empty state for the Alerts page (no breaches).
 * Renders a shield with a checkmark and radiating pulse rings.
 */
export function AlertsEmpty({ entitiesScanned = 0 }) {
  return (
    <div className="px-6 py-16 text-center" data-testid="alerts-empty">
      <div className="relative w-28 h-28 mx-auto mb-5">
        {/* Pulse rings */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border border-emerald-200"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1.4], opacity: [0.5, 0] }}
            transition={{
              duration: 2.5,
              delay: i * 0.6,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        ))}

        {/* Shield */}
        <motion.svg
          viewBox="0 0 100 100"
          className="relative w-full h-full"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Shield body */}
          <motion.path
            d="M50 15L80 28V52C80 70 66 84 50 90C34 84 20 70 20 52V28L50 15Z"
            fill="#ECFDF5"
            stroke="#10B981"
            strokeWidth={2}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* Checkmark */}
          <motion.path
            d="M36 52L46 62L64 42"
            fill="none"
            stroke="#059669"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
        </motion.svg>
      </div>

      <p className="text-sm text-slate-600 font-medium">No thresholds breached</p>
      <p className="mt-1.5 font-mono text-[11px] text-slate-400">
        All {entitiesScanned} entities are inside their liquidity limits.
      </p>
    </div>
  );
}
