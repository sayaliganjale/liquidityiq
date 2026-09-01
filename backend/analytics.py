"""Treasury analytics: AR/AP aging buckets and working-capital KPIs (DSO, DPO, CCC)."""
from datetime import datetime, timezone

import pandas as pd

BUCKETS = [("current", 0, 30), ("d31_60", 31, 60), ("d61_90", 61, 90), ("d90_plus", 91, 10_000)]


def _days_out(due_date, today):
    d = pd.to_datetime(due_date, errors="coerce")
    if pd.isna(d):
        return None
    return (d.date() - today).days


def aging(records, today=None):
    """Bucket open items by days-until-due; negative days => overdue."""
    today = today or datetime.now(timezone.utc).date()
    out = {k: {"amount": 0.0, "count": 0} for k, _, _ in BUCKETS}
    out["overdue"] = {"amount": 0.0, "count": 0}
    total = 0.0
    for r in (records or []):
        amt = float(r.get("amount", 0) or 0)
        total += amt
        n = _days_out(r.get("due_date"), today)
        if n is None:
            continue
        if n < 0 or r.get("status") == "overdue":
            key = "overdue"
        else:
            key = next((k for k, lo, hi in BUCKETS if lo <= n <= hi), "d90_plus")
        out[key]["amount"] += amt
        out[key]["count"] += 1
    for v in out.values():
        v["amount"] = round(v["amount"], 2)
    out["total"] = round(total, 2)
    return out


def kpis(transactions, ar_records, ap_records, cash):
    """DSO / DPO / CCC + burn metrics derived from the ledger."""
    total_ar = sum(float(r.get("amount", 0) or 0) for r in (ar_records or []))
    total_ap = sum(float(r.get("amount", 0) or 0) for r in (ap_records or []))

    revenue = cogs = 0.0
    days = 1
    if transactions:
        df = pd.DataFrame(transactions)
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df = df.dropna(subset=["date"])
        if not df.empty:
            days = max(1, (df["date"].max() - df["date"].min()).days + 1)
            revenue = float(df.loc[df["direction"] == "in", "amount"].sum())
            cogs = float(df.loc[df["direction"] == "out", "amount"].sum())

    annual_rev = revenue / days * 365 if days else 0.0
    annual_cogs = cogs / days * 365 if days else 0.0
    dso = (total_ar / annual_rev * 365) if annual_rev > 0 else 0.0
    dpo = (total_ap / annual_cogs * 365) if annual_cogs > 0 else 0.0
    dio = 0.0  # cash-only ledger: no inventory position tracked
    ccc = dso + dio - dpo

    daily_burn = cogs / days if days else 0.0
    daily_net = (revenue - cogs) / days if days else 0.0
    burn_runway = (cash / abs(daily_net)) if daily_net < 0 else None

    return {
        "dso_days": round(dso, 1),
        "dpo_days": round(dpo, 1),
        "dio_days": dio,
        "ccc_days": round(ccc, 1),
        "annualized_revenue": round(annual_rev, 2),
        "annualized_costs": round(annual_cogs, 2),
        "daily_burn": round(daily_burn, 2),
        "daily_net_flow": round(daily_net, 2),
        "burn_runway_days": round(burn_runway, 1) if burn_runway else None,
        "quick_ratio": round((cash + total_ar) / total_ap, 2) if total_ap > 0 else None,
        "cash_ratio": round(cash / total_ap, 2) if total_ap > 0 else None,
        "working_capital": round(cash + total_ar - total_ap, 2),
        "ledger_days": days,
    }


def category_breakdown(transactions):
    """Inflow / outflow totals grouped by category for treemap-style charts."""
    inflow, outflow = {}, {}
    for t in (transactions or []):
        bucket = inflow if t.get("direction") == "in" else outflow
        cat = t.get("category") or "Other"
        bucket[cat] = bucket.get(cat, 0.0) + float(t.get("amount", 0) or 0)
    fmt = lambda d: sorted(
        [{"category": k, "amount": round(v, 2)} for k, v in d.items()],
        key=lambda x: -x["amount"],
    )
    return {"inflow": fmt(inflow), "outflow": fmt(outflow)}
