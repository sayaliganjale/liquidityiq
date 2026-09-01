import { AIChat } from "@/components/AIAnalyst";
import { Sparkle } from "@phosphor-icons/react";

const SUGGESTIONS = [
  "Which entity has the weakest liquidity and why?",
  "Rank my entities by 90-day cash risk.",
  "Where is my largest payables concentration in the next 30 days?",
  "If collections slipped by 30 days across the portfolio, what breaks first?",
  "Summarise the portfolio for a board update in five bullets.",
];

export default function AIAnalystPage() {
  return (
    <div className="px-5 sm:px-8 py-8 max-w-[1100px]" data-testid="ai-analyst-page">
      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
          <Sparkle size={11} weight="fill" className="text-sky-600" /> Gemini 2.0 Flash
        </p>
        <h1 className="mt-2 font-serif text-3xl sm:text-4xl tracking-tight">AI Liquidity Analyst</h1>
        <p className="mt-2 text-sm text-slate-500 max-w-2xl">
          The analyst reads your live portfolio — every entity's cash position, ML forecast, risk grade, runway
          and AR/AP book — before answering. Ask it anything a treasurer would ask.
        </p>
      </div>
      <AIChat
        suggestions={SUGGESTIONS}
        placeholder="Ask about consolidated liquidity, entity-level risk, FX exposure or working capital."
      />
    </div>
  );
}
