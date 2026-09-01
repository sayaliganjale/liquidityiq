import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import Marquee from "react-fast-marquee";
import Lenis from "lenis";
import {
  TrendUp, ArrowRight, Brain, Globe, ChartLineUp, ShieldCheck, CurrencyCircleDollar,
  Pulse, Buildings, ArrowUpRight, SlidersHorizontal, Sparkle, BellRinging, Command as CommandIcon,
} from "@phosphor-icons/react";

const IMG = {
  hero: "https://images.pexels.com/photos/7567443/pexels-photo-7567443.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  team: "https://images.pexels.com/photos/7698707/pexels-photo-7698707.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  forex: "https://images.pexels.com/photos/5834244/pexels-photo-5834244.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  tablet: "https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
};

const HERO_LINES = ["Liquidity,", "forecast", "90 days out."];
const TICKERS = [
  "TATAMOTORS.NS", "RELIANCE.NS", "INFY.NS", "AAPL", "MSFT", "HDFCBANK.NS",
  "USD/INR", "EUR/USD", "GBP/JPY", "ARIMA(2,1,2)", "RANDOM FOREST", "CLAUDE SONNET 4.6",
];

function Line({ children, delay }) {
  return (
    <span className="mask-line">
      <motion.span
        className="block"
        initial={{ y: "110%" }}
        animate={{ y: "0%" }}
        transition={{ duration: 0.95, delay, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.span>
    </span>
  );
}

function Reveal({ children, delay = 0, className = "" }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 32, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

const CHAPTERS = [
  { n: "01", t: "Every entity, one console", d: "Consolidate private subsidiaries and listed enterprises — TATAMOTORS.NS, RELIANCE.NS, INFY.NS, AAPL — into a single multi-currency liquidity view.", icon: Buildings },
  { n: "02", t: "The market, streaming", d: "Search any global ticker across NSE, BSE, NASDAQ and NYSE. Prices stream in over a live socket and flash the instant they move.", icon: Globe },
  { n: "03", t: "Ninety days of foresight", d: "ARIMA time-series models project cash runway from your bank balances, receivables, payables and historical ledgers — day by day.", icon: Brain },
  { n: "04", t: "Risk, classified", d: "A Random Forest engine grades each entity LOW, MEDIUM or HIGH risk with a live model-confidence score you can act on.", icon: ShieldCheck },
  { n: "05", t: "Stress it before it happens", d: "Nine what-if levers — collection delays, revenue shocks, FX moves, capex — rebuild the whole 90-day path in under a second.", icon: SlidersHorizontal },
  { n: "06", t: "An analyst on every entity", d: "Claude Sonnet 4.6 reads the forecast, the aging book and the KPIs, then writes the CFO briefing and answers anything you ask.", icon: Sparkle },
];

export default function Landing() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  useEffect(() => {
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    let raf;
    const loop = (t) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, []);

  return (
    <div className="mesh-hero text-slate-900 overflow-x-hidden">
      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 glass-nav">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group" data-testid="landing-logo">
            <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shadow-[0_6px_18px_rgba(14,165,233,0.35)] transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110">
              <TrendUp size={17} weight="bold" className="text-white" />
            </span>
            <span className="font-serif text-lg tracking-tight">LiquidityIQ</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
            {[["#capabilities", "Capabilities"], ["#manifesto", "Method"], ["#product", "Product"]].map(([h, l]) => (
              <a key={h} href={h} className="relative hover:text-sky-600 transition-colors after:absolute after:left-0 after:-bottom-1 after:h-[1.5px] after:w-0 after:bg-sky-500 after:transition-all hover:after:w-full">
                {l}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 hover:text-sky-600 transition-colors" data-testid="nav-login">Sign in</Link>
            <Link to="/register" data-testid="nav-register" className="btn-accent rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-1.5">
              Launch <ArrowRight size={14} weight="bold" />
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header ref={heroRef} className="relative min-h-screen flex flex-col justify-center pt-32 pb-16 px-6">
        <div className="absolute inset-0 grid-lines opacity-70 pointer-events-none" />
        <motion.div style={{ y: bgY, scale: bgScale, opacity: heroOpacity }}
          className="absolute right-0 top-0 w-full lg:w-[56%] h-full z-0 pointer-events-none">
          <img src={IMG.hero} alt="" className="w-full h-full object-cover opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-white/50" />
        </motion.div>

        <div className="relative z-10 max-w-7xl mx-auto w-full">
          <motion.p
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-sky-700 mb-8">
            <Pulse size={13} className="text-emerald-500" /> Enterprise Liquidity Intelligence
          </motion.p>

          <h1 className="font-serif text-[3.4rem] sm:text-7xl md:text-8xl lg:text-[8.5rem] leading-[0.9] tracking-[-0.045em] max-w-5xl text-slate-900">
            {HERO_LINES.map((l, i) => (
              <Line key={i} delay={0.35 + i * 0.14}>
                {i === 2 ? <span className="text-sky-600">{l}</span> : l}
              </Line>
            ))}
          </h1>

          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mt-12 flex flex-col sm:flex-row sm:items-end justify-between gap-8 max-w-5xl">
            <p className="text-slate-600 text-lg max-w-md leading-relaxed font-light">
              A machine-learning treasury console that forecasts 90-day cash flow, classifies liquidity risk
              and streams live global market data — for every entity you hold.
            </p>
            <Link to="/register" data-testid="hero-cta" className="btn-accent rounded-full px-7 py-4 font-semibold flex items-center gap-2 shrink-0 self-start sm:self-auto">
              Open the console <ArrowRight size={18} weight="bold" />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.5 }}
            className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            <span className="flex items-center gap-2"><CommandIcon size={13} className="text-sky-500" />⌘K anywhere</span>
            <span className="flex items-center gap-2"><Pulse size={13} className="text-emerald-500" />WebSocket price feed</span>
            <span className="flex items-center gap-2"><BellRinging size={13} className="text-amber-500" />Threshold alerts</span>
            <span className="flex items-center gap-2"><Sparkle size={13} className="text-sky-500" />AI treasury analyst</span>
          </motion.div>
        </div>
      </header>

      {/* MARQUEE */}
      <div className="relative z-10 border-y hairline py-5 bg-white/70 backdrop-blur">
        <Marquee speed={38} gradient={false} autoFill>
          {TICKERS.map((t, i) => (
            <span key={i} className="font-mono text-sm text-slate-400 mx-12 flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> {t}
            </span>
          ))}
        </Marquee>
      </div>

      {/* STATS */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            ["90", "Day forecast horizon"],
            ["4", "Global exchanges"],
            ["3", "ML + AI engines"],
            ["∞", "Multi-currency sync"],
          ].map(([n, l], i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div className="card-flat lift p-8 h-full">
                <p className="font-serif text-5xl sm:text-6xl tracking-tighter text-sky-600">{n}</p>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{l}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* MANIFESTO */}
      <section id="manifesto" className="max-w-7xl mx-auto px-6 py-20">
        <Reveal>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-sky-600 mb-4">The Method</p>
          <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl tracking-[-0.04em] max-w-3xl leading-[1.05]">
            Treasury, re-engineered as a forecasting instrument.
          </h2>
        </Reveal>
        <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CHAPTERS.map((c, i) => (
            <Reveal key={c.n} delay={(i % 3) * 0.08}>
              <div className="card-flat lift p-8 h-full group">
                <div className="flex items-start justify-between mb-8">
                  <span className="font-mono text-xs text-slate-300">{c.n}</span>
                  <span className="h-10 w-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    <c.icon size={20} className="text-sky-600" />
                  </span>
                </div>
                <h3 className="font-serif text-2xl tracking-tight mb-3">{c.t}</h3>
                <p className="text-slate-500 text-[15px] leading-relaxed font-light">{c.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* PRODUCT / BENTO */}
      <section id="product" className="max-w-7xl mx-auto px-6 py-20">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4 mb-12">
            <h2 className="font-serif text-4xl sm:text-5xl tracking-[-0.04em] max-w-xl leading-[1.05]">A command center built for precision.</h2>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">Bright, dense, deliberate. Every pixel earns its place in the liquidity console.</p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Reveal className="lg:col-span-2 lg:row-span-2">
            <div className="card-flat overflow-hidden h-full min-h-[380px] relative group">
              <img src={IMG.tablet} alt="Live liquidity console" className="w-full h-full object-cover transition-transform duration-[1.2s] group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent" />
              <div className="absolute bottom-0 p-8">
                <p className="inline-flex items-center gap-2 rounded-full bg-sky-50 border border-sky-200 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-700 mb-3">
                  <ChartLineUp size={13} /> Live Dashboards
                </p>
                <h3 className="font-serif text-3xl tracking-tight">Cash runway, drawn in real time</h3>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="card-flat lift p-8 h-full">
              <CurrencyCircleDollar size={30} className="text-emerald-500 mb-6" />
              <h3 className="font-serif text-2xl tracking-tight mb-2">Multi-currency sync</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-light">Live FX from ExchangeRate-API normalises every entity to a single reporting currency.</p>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="card-flat lift p-8 h-full">
              <Brain size={30} className="text-sky-600 mb-6" />
              <h3 className="font-serif text-2xl tracking-tight mb-2">ARIMA + Random Forest</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-light">Statistical forecasting and risk classification, running on your real ledgers.</p>
            </div>
          </Reveal>

          <Reveal className="lg:col-span-3">
            <div className="card-flat overflow-hidden relative min-h-[280px] flex items-center">
              <img src={IMG.forex} alt="Global exchanges" className="absolute inset-0 w-full h-full object-cover opacity-25" />
              <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/30" />
              <div className="relative p-8 sm:p-12 max-w-lg">
                <p className="inline-flex items-center gap-2 rounded-full bg-sky-50 border border-sky-200 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-700 mb-3">
                  <Globe size={13} /> Global Coverage
                </p>
                <h3 className="font-serif text-3xl sm:text-4xl tracking-[-0.04em] mb-3">NSE · BSE · NASDAQ · NYSE</h3>
                <p className="text-slate-500 leading-relaxed font-light">One search bar reaches every major exchange. Look up any listed enterprise and stream its live quote instantly.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section id="capabilities" className="max-w-7xl mx-auto px-6 py-20 border-t hairline">
        <div className="grid md:grid-cols-3 gap-12">
          {[
            ["Null-safe by design", "Empty ledgers, API rate-limits and missing quotes degrade gracefully — never a 500."],
            ["Realistic seed data", "Pre-populated bank accounts, AR/AP records and 120-day ledgers for every entity."],
            ["Confidence you can read", "Every risk grade ships with a model-confidence percentage from the Random Forest."],
          ].map(([t, d], i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div className="border-t-2 border-sky-500 pt-6">
                <h3 className="font-serif text-xl tracking-tight mb-3">{t}</h3>
                <p className="text-slate-500 text-sm leading-relaxed font-light">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-28 text-center">
        <Reveal>
          <h2 className="font-serif text-5xl sm:text-6xl md:text-7xl tracking-[-0.05em] leading-[0.95] mb-10">
            See your next<br /><span className="text-sky-600">ninety days.</span>
          </h2>
          <Link to="/register" data-testid="footer-cta" className="btn-white inline-flex items-center gap-2 rounded-full px-8 py-4 font-semibold">
            Launch LiquidityIQ <ArrowUpRight size={18} weight="bold" />
          </Link>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="border-t hairline bg-white/60">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
              <TrendUp size={15} weight="bold" className="text-white" />
            </span>
            <span className="font-serif text-lg">LiquidityIQ</span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.16em]">Enterprise Liquidity Management · ML Cash Forecasting</p>
        </div>
      </footer>
    </div>
  );
}
