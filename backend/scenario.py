"""What-if scenario engine: re-runs the 90-day liquidity projection under stress assumptions."""
from datetime import timedelta

import numpy as np
import pandas as pd

from ml_forecast import build_daily_balance, RISK_LABELS, _RISK_MODEL

HORIZON = 90

DEFAULTS = {
    "revenue_shock_pct": 0.0,      # -50 .. +50  change to daily inflows
    "cost_shock_pct": 0.0,         # -50 .. +50  change to daily outflows
    "ar_delay_days": 0,            # 0 .. 60     receivables collected later
    "collection_rate_pct": 100.0,  # 50 .. 100   share of AR actually collected
    "ap_accelerate_days": 0,       # 0 .. 45     payables paid earlier
    "capex_amount": 0.0,           # one-off outflow
    "capex_day": 30,               # day of the one-off outflow
    "fx_shock_pct": 0.0,           # -25 .. +25  FX move on AR/AP exposure
    "credit_line": 0.0,            # committed revolver added to liquidity floor
}


def normalize_params(raw: dict) -> dict:
    p = dict(DEFAULTS)
    for k, v in (raw or {}).items():
        if k in p and v is not None:
            try:
                p[k] = float(v)
            except (TypeError, ValueError):
                pass
    p["ar_delay_days"] = int(max(0, min(120, p["ar_delay_days"])))
    p["ap_accelerate_days"] = int(max(0, min(90, p["ap_accelerate_days"])))
    p["capex_day"] = int(max(1, min(HORIZON, p["capex_day"])))
    p["collection_rate_pct"] = max(0.0, min(100.0, p["collection_rate_pct"]))
    return p


def _flow_rates(transactions):
    """Average daily inflow / outflow from the historical ledger."""
    if not transactions:
        return 0.0, 0.0
    df = pd.DataFrame(transactions)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])
    if df.empty:
        return 0.0, 0.0
    days = max(1, (df["date"].max() - df["date"].min()).days + 1)
    inflow = float(df.loc[df["direction"] == "in", "amount"].sum()) / days
    outflow = float(df.loc[df["direction"] == "out", "amount"].sum()) / days
    return inflow, outflow


def _schedule(last_date, ar_records, ap_records, p):
    sched = np.zeros(HORIZON)
    fx = 1.0 + p["fx_shock_pct"] / 100.0
    collect = p["collection_rate_pct"] / 100.0
    for rec in (ar_records or []):
        d = pd.to_datetime(rec.get("due_date"), errors="coerce")
        if pd.isna(d):
            continue
        offset = (d.normalize() - last_date.normalize()).days + p["ar_delay_days"]
        if 0 < offset <= HORIZON:
            sched[offset - 1] += float(rec.get("amount", 0)) * collect * fx
    for rec in (ap_records or []):
        d = pd.to_datetime(rec.get("due_date"), errors="coerce")
        if pd.isna(d):
            continue
        offset = (d.normalize() - last_date.normalize()).days - p["ap_accelerate_days"]
        offset = max(1, offset)
        if offset <= HORIZON:
            sched[offset - 1] -= float(rec.get("amount", 0)) * fx
    if p["capex_amount"]:
        sched[p["capex_day"] - 1] -= abs(p["capex_amount"])
    return sched


def _project(hist, inflow, outflow, ar, ap, p):
    current = float(hist.values[-1])
    daily_net = inflow * (1 + p["revenue_shock_pct"] / 100.0) - outflow * (1 + p["cost_shock_pct"] / 100.0)
    drift = np.full(HORIZON, daily_net)
    sched = _schedule(hist.index[-1], ar, ap, p)
    return current + np.cumsum(drift + sched)


def _summarize(hist, vals, ar, ap, credit_line):
    current = float(hist.values[-1])
    floor = -abs(credit_line)
    min_proj = float(np.min(vals))
    end_proj = float(vals[-1])
    below = np.where(vals < floor)[0]
    runway = int(below[0] + 1) if len(below) else 90 + int(max(0.0, end_proj - floor) / (abs(np.mean(np.diff(vals))) + 1e-6))
    runway = min(runway, 999)

    volatility = min(float(np.std(np.diff(hist.values)) / (abs(np.mean(hist.values)) + 1e-9)), 1.0)
    total_ar = sum(float(r.get("amount", 0)) for r in (ar or []))
    total_ap = sum(float(r.get("amount", 0)) for r in (ap or []))
    ratio = (total_ap / total_ar) if total_ar > 0 else (2.5 if total_ap > 0 else 1.0)
    reserve = min(1.0, current / (total_ap + 1e-6)) if total_ap > 0 else 1.0

    feats = np.array([[runway, min_proj, ratio, volatility, reserve]])
    pred = int(_RISK_MODEL.predict(feats)[0])
    proba = _RISK_MODEL.predict_proba(feats)[0]
    breach = int(below[0] + 1) if len(below) else None
    return {
        "risk": RISK_LABELS[pred],
        "confidence": round(float(np.max(proba)) * 100, 1),
        "metrics": {
            "current_cash": round(current, 2),
            "projected_90d": round(end_proj, 2),
            "min_projected": round(min_proj, 2),
            "net_change_90d": round(end_proj - current, 2),
            "runway_days": runway,
            "breach_day": breach,
            "liquidity_floor": round(floor, 2),
        },
    }


def simulate(transactions, opening_balance, ar_records, ap_records, currency, raw_params):
    """Returns baseline vs scenario 90-day paths plus deltas."""
    p = normalize_params(raw_params)
    series = build_daily_balance(transactions, opening_balance)
    hist = series[-120:]
    inflow, outflow = _flow_rates(transactions)
    last_date = hist.index[-1]
    dates = [(last_date + timedelta(days=i + 1)).strftime("%Y-%m-%d") for i in range(HORIZON)]

    base_vals = _project(hist, inflow, outflow, ar_records, ap_records, DEFAULTS)
    scen_vals = _project(hist, inflow, outflow, ar_records, ap_records, p)

    base = _summarize(hist, base_vals, ar_records, ap_records, 0.0)
    scen = _summarize(hist, scen_vals, ar_records, ap_records, p["credit_line"])

    return {
        "currency": currency,
        "params": p,
        "dates": dates,
        "baseline": {**base, "series": [round(float(v), 2) for v in base_vals]},
        "scenario": {**scen, "series": [round(float(v), 2) for v in scen_vals]},
        "delta": {
            "projected_90d": round(scen["metrics"]["projected_90d"] - base["metrics"]["projected_90d"], 2),
            "min_projected": round(scen["metrics"]["min_projected"] - base["metrics"]["min_projected"], 2),
            "runway_days": scen["metrics"]["runway_days"] - base["metrics"]["runway_days"],
        },
        "assumptions": {
            "avg_daily_inflow": round(inflow, 2),
            "avg_daily_outflow": round(outflow, 2),
        },
    }
