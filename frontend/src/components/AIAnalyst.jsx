import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import api, { API, formatApiError } from "@/lib/api";
import { Brain, PaperPlaneRight, Sparkle, ArrowClockwise } from "@phosphor-icons/react";

function Markdownish({ text }) {
  const lines = (text || "").split("\n");
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} className="h-1" />;
        if (t.startsWith("###"))
          return (
            <p key={i} className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-600 pt-3">
              {t.replace(/^#+\s*/, "")}
            </p>
          );
        const bold = (s) =>
          s.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") ? (
              <strong key={j} className="text-slate-900 font-semibold">{part.slice(2, -2)}</strong>
            ) : (
              <span key={j}>{part}</span>
            )
          );
        if (/^[-•]\s/.test(t))
          return (
            <p key={i} className="text-sm text-slate-600 pl-4 relative leading-relaxed">
              <span className="absolute left-0 text-sky-600">·</span>
              {bold(t.replace(/^[-•]\s*/, ""))}
            </p>
          );
        if (/^\d+\.\s/.test(t))
          return (
            <p key={i} className="text-sm text-slate-600 pl-5 relative leading-relaxed">
              <span className="absolute left-0 font-mono text-[10px] text-amber-600 top-1">
                {t.match(/^\d+/)[0]}
              </span>
              {bold(t.replace(/^\d+\.\s*/, ""))}
            </p>
          );
        return <p key={i} className="text-sm text-slate-600 leading-relaxed">{bold(t)}</p>;
      })}
    </div>
  );
}

export function AIBrief({ cid, companyName, onBrief }) {
  const [content, setContent] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setContent(null);
    api.get(`/ai/brief/${cid}/latest`).then((r) => {
      if (r.data.content) {
        setContent(r.data.content);
        setMeta(r.data);
        onBrief?.(r.data.content);
      }
    }).catch(() => {});
  }, [cid]);

  const run = async () => {
    setLoading(true);
    try {
      const r = await api.post(`/ai/brief/${cid}`);
      setContent(r.data.content);
      setMeta(r.data);
      onBrief?.(r.data.content);
      toast.success("Liquidity briefing generated");
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-flat rounded-lg p-6" data-testid="ai-brief-card">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Sparkle size={18} weight="fill" className="text-sky-600" />
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
            AI Liquidity Analyst
          </h3>
          <span className="font-mono text-[10px] text-slate-400">gemini-2.0-flash</span>
        </div>
        <button
          onClick={run}
          disabled={loading}
          data-testid="generate-brief-btn"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 transition-colors font-mono text-[10px] uppercase tracking-wider"
        >
          {loading ? <ArrowClockwise size={13} className="animate-spin" /> : <Brain size={13} />}
          {loading ? "Analysing…" : content ? "Regenerate" : "Generate briefing"}
        </button>
      </div>

      {content ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} data-testid="ai-brief-content">
          <Markdownish text={content} />
          {meta?.created_at && (
            <p className="mt-5 font-mono text-[10px] text-slate-400">
              Generated {new Date(meta.created_at).toLocaleString()}
            </p>
          )}
        </motion.div>
      ) : (
        <p className="text-sm text-slate-500 max-w-xl">
          Ask the analyst to read {companyName || "this entity"}'s 90-day projection, AR/AP aging and
          working-capital KPIs, then write a CFO-ready briefing with specific treasury actions.
        </p>
      )}
    </div>
  );
}

export function AIChat({ companyId, placeholder, suggestions = [] }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const sessionRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      const res = await fetch(`${API}/ai/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, session_id: sessionRef.current, company_id: companyId || null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      sessionRef.current = res.headers.get("X-Session-Id") || sessionRef.current;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { role: "assistant", content: acc };
          return next;
        });
      }
    } catch (e) {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { role: "assistant", content: `The analyst is unavailable right now (${e.message}).` };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="card-flat rounded-lg flex flex-col h-[560px]" data-testid="ai-chat">
      <div className="px-6 py-4 border-b hairline flex items-center gap-2">
        <Brain size={16} className="text-sky-600" />
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
          Ask the Treasury Analyst
        </h3>
        {streaming && <span className="font-mono text-[10px] text-emerald-600 animate-pulse">streaming…</span>}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              {placeholder || "Ask anything about your liquidity position, forecasts or counterparties."}
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  data-testid="ai-suggestion"
                  className="text-left px-3 py-2 rounded-lg border border-slate-200/70 text-xs text-slate-500 hover:text-slate-900 hover:border-sky-300 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} data-testid={`chat-msg-${m.role}`}>
            {m.role === "user" ? (
              <div className="flex justify-end">
                <p className="max-w-[80%] bg-sky-50 border border-sky-200 rounded-2xl rounded-br-sm px-4 py-2.5 text-sm">
                  {m.content}
                </p>
              </div>
            ) : (
              <div className="max-w-[92%]">
                {m.content ? <Markdownish text={m.content} /> :
                  <p className="font-mono text-xs text-slate-400 animate-pulse">thinking…</p>}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t hairline flex items-center gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          data-testid="ai-chat-input"
          placeholder="e.g. Where is my biggest payables concentration?"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        <button
          onClick={() => send()}
          disabled={streaming || !input.trim()}
          data-testid="ai-chat-send"
          className="h-9 w-9 rounded-full bg-sky-500 hover:bg-sky-600 disabled:opacity-30 flex items-center justify-center transition-colors"
        >
          <PaperPlaneRight size={15} weight="fill" />
        </button>
      </div>
    </div>
  );
}
