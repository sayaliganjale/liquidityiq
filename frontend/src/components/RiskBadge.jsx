const MAP = {
  LOW_RISK: {
    label: "Low Risk",
    dot: "#10B981",
    cls: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  MEDIUM_RISK: {
    label: "Medium Risk",
    dot: "#F59E0B",
    cls: "text-amber-700 bg-amber-50 border-amber-200",
  },
  HIGH_RISK: {
    label: "High Risk",
    dot: "#E11D48",
    cls: "text-rose-700 bg-rose-50 border-rose-200",
  },
};

export default function RiskBadge({ risk, size = "md" }) {
  const c = MAP[risk] || MAP.MEDIUM_RISK;
  const pad = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-[11px]";
  return (
    <span
      data-testid={`risk-badge-${risk}`}
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-[0.1em] ${c.cls} ${pad}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}
