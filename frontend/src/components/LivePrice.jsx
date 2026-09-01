import { useEffect, useRef, useState } from "react";

const SYM = { INR: "₹", USD: "$", EUR: "€", GBP: "£", JPY: "¥", AED: "AED ", SGD: "S$" };

export const currencySymbol = (c) => SYM[c] ?? "";

/** Flashes green/red for 700ms whenever the streamed value changes. */
export function LiveValue({ value, currency, className = "", digits, testid }) {
  const [flash, setFlash] = useState("");
  const prev = useRef(value);

  useEffect(() => {
    if (value == null || prev.current == null || value === prev.current) {
      prev.current = value;
      return;
    }
    setFlash(value > prev.current ? "tick-up" : "tick-down");
    prev.current = value;
    const t = setTimeout(() => setFlash(""), 750);
    return () => clearTimeout(t);
  }, [value]);

  const shown =
    value == null
      ? "—"
      : `${currencySymbol(currency)}${Number(value).toLocaleString("en-US", {
          minimumFractionDigits: digits ?? 2,
          maximumFractionDigits: digits ?? 2,
        })}`;

  return (
    <span data-testid={testid} className={`inline-block px-1 -mx-1 ${flash} ${className}`}>
      {shown}
    </span>
  );
}

export function LiveDot({ live, label = "LIVE" }) {
  return (
    <span
      data-testid="live-indicator"
      className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] ${
        live ? "text-emerald-600" : "text-slate-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500 live-dot" : "bg-slate-300"}`}
      />
      {live ? label : "polling"}
    </span>
  );
}

export function ChangePill({ change, changePercent }) {
  const up = (changePercent ?? 0) >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
        up ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"
      }`}
    >
      {up ? "▲" : "▼"} {Math.abs(change ?? 0).toLocaleString()} ({Math.abs(changePercent ?? 0)}%)
    </span>
  );
}
