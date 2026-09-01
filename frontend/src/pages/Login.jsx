import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight, TrendUp } from "@phosphor-icons/react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@liquidityiq.com");
  const [password, setPassword] = useState("LiquidityIQ2026!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) navigate("/app");
    else setError(res.error);
  };

  return (
    <div className="min-h-screen grain-bg noise-overlay flex flex-col">
      <header className="px-6 sm:px-10 py-6">
        <Link to="/" className="inline-flex items-center gap-2" data-testid="login-logo">
          <TrendUp size={22} weight="bold" className="text-sky-600" />
          <span className="font-serif text-xl tracking-tight">LiquidityIQ</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-sky-600 mb-4">
            Treasury Access
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl leading-none tracking-tight mb-3">
            Sign in.
          </h1>
          <p className="text-slate-500 text-sm mb-8">
            Enter your credentials to reach the liquidity command center.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Email</label>
              <input
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm font-mono focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-colors"
                required
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Password</label>
              <input
                data-testid="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm font-mono focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-colors"
                required
              />
            </div>

            {error && (
              <p data-testid="login-error" className="text-rose-600 text-sm font-mono">{error}</p>
            )}

            <button
              data-testid="login-submit-btn"
              type="submit"
              disabled={loading}
              className="btn-white w-full rounded-full py-3.5 font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? "Authenticating…" : "Enter Command Center"}
              {!loading && <ArrowRight size={16} weight="bold" />}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-500">
            No account?{" "}
            <Link to="/register" className="text-slate-900 underline underline-offset-4 hover:text-sky-600 transition-colors" data-testid="login-to-register">
              Create one
            </Link>
          </p>
          <p className="mt-8 font-mono text-[10px] text-slate-400 border border-slate-200/70 rounded-lg p-3">
            Demo · admin@liquidityiq.com · LiquidityIQ2026!
          </p>
        </motion.div>
      </div>
    </div>
  );
}
