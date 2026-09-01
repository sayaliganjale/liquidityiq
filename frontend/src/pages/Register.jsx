import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight, TrendUp } from "@phosphor-icons/react";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await register(email, password, name);
    setLoading(false);
    if (res.ok) navigate("/app");
    else setError(res.error);
  };

  return (
    <div className="min-h-screen grain-bg noise-overlay flex flex-col">
      <header className="px-6 sm:px-10 py-6">
        <Link to="/" className="inline-flex items-center gap-2" data-testid="register-logo">
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
            New Treasury Seat
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl leading-none tracking-tight mb-8">
            Create account.
          </h1>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Name</label>
              <input
                data-testid="register-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm font-mono focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-colors"
                required
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Email</label>
              <input
                data-testid="register-email-input"
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
                data-testid="register-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm font-mono focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-colors"
                minLength={6}
                required
              />
            </div>

            {error && (
              <p data-testid="register-error" className="text-rose-600 text-sm font-mono">{error}</p>
            )}

            <button
              data-testid="register-submit-btn"
              type="submit"
              disabled={loading}
              className="btn-accent w-full rounded-full py-3.5 font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? "Creating…" : "Create Account"}
              {!loading && <ArrowRight size={16} weight="bold" />}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-500">
            Already registered?{" "}
            <Link to="/login" className="text-slate-900 underline underline-offset-4 hover:text-sky-600 transition-colors" data-testid="register-to-login">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
