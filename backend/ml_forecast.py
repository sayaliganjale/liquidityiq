"""ML forecasting microservice logic (runs inside FastAPI).

- ARIMA (statsmodels) for 90-day time-series cash projection.
- Random Forest (scikit-learn) for liquidity risk classification + confidence.
"""
import warnings
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from statsmodels.tsa.arima.model import ARIMA
from sklearn.ensemble import RandomForestClassifier

RISK_LABELS = ["LOW_RISK", "MEDIUM_RISK", "HIGH_RISK"]

# ---------------------------------------------------------------------------
# Random Forest liquidity risk classifier (trained once on synthetic ledgers)
# ---------------------------------------------------------------------------
def _label_from_rule(runway, min_bal, ap_ar_ratio, volatility):
    if min_bal < 0 or runway < 20 or ap_ar_ratio > 2.2:
        return 2  # HIGH
    if runway < 60 or ap_ar_ratio > 1.2 or volatility > 0.35:
        return 1  # MEDIUM
    return 0  # LOW


def _train_risk_model():
    rng = np.random.default_rng(42)
    n = 4000
    runway = rng.uniform(5, 180, n)
    min_bal = rng.uniform(-500000, 3000000, n)
    ap_ar = rng.uniform(0.2, 3.0, n)
    vol = rng.uniform(0.02, 0.6, n)
    conf_reserve = rng.uniform(0.0, 1.0, n)
    X = np.column_stack([runway, min_bal, ap_ar, vol, conf_reserve])
    y = np.array([_label_from_rule(runway[i], min_bal[i], ap_ar[i], vol[i]) for i in range(n)])
    clf = RandomForestClassifier(n_estimators=140, max_depth=10, random_state=42, n_jobs=1)
    clf.fit(X, y)
    return clf


_RISK_MODEL = _train_risk_model()


# ---------------------------------------------------------------------------
def build_daily_balance(transactions, opening_balance):
    """Return a daily-frequency pandas Series of end-of-day cash balance."""
    if not transactions:
        idx = pd.date_range(end=datetime.utcnow().date(), periods=120, freq="D")
        return pd.Series([opening_balance] * len(idx), index=idx)

    df = pd.DataFrame(transactions)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"]).sort_values("date")
    df["signed"] = df.apply(lambda r: r["amount"] if r["direction"] == "in" else -r["amount"], axis=1)
    daily = df.groupby(df["date"].dt.normalize())["signed"].sum()
    full_idx = pd.date_range(daily.index.min(), daily.index.max(), freq="D")
    daily = daily.reindex(full_idx, fill_value=0.0)
    # Reconstruct running balance so the final day equals opening_balance (current cash)
    cum = daily.cumsum()
    running = cum + (opening_balance - cum.iloc[-1])
    return running


def _arima_forecast(series, steps=90):
    """Return forecast array of length `steps`. Falls back to linear trend."""
    y = series.values.astype(float)
    try:
        if len(y) >= 30 and np.std(np.diff(y)) > 1e-6:
            model = ARIMA(y, order=(2, 1, 2))
            fit = model.fit()
            fc = fit.forecast(steps=steps)
            return np.asarray(fc, dtype=float), "ARIMA(2,1,2)"
    except Exception:
        pass
    # Linear-trend fallback
    x = np.arange(len(y))
    if len(y) >= 2:
        slope, intercept = np.polyfit(x, y, 1)
    else:
        slope, intercept = 0.0, (y[-1] if len(y) else 0.0)
    future = np.arange(len(y), len(y) + steps)
    return slope * future + intercept, "LinearTrend"


def _risk_from_forecast(hist, forecast_vals, ar_records, ap_records, currency):
    current_cash = float(hist.values[-1])
    min_proj = float(np.min(forecast_vals))
    end_proj = float(forecast_vals[-1])
    daily_returns = np.diff(hist.values)
    volatility = float(np.std(daily_returns) / (abs(np.mean(hist.values)) + 1e-9))
    volatility = min(volatility, 1.0)

    below = np.where(forecast_vals < 0)[0]
    runway_days = int(below[0] + 1) if len(below) else 90 + int(max(0, end_proj) / (abs(np.mean(np.diff(forecast_vals))) + 1e-6))
    runway_days = min(runway_days, 999)

    total_ar = sum(float(r.get("amount", 0)) for r in (ar_records or []))
    total_ap = sum(float(r.get("amount", 0)) for r in (ap_records or []))
    ap_ar_ratio = (total_ap / total_ar) if total_ar > 0 else (2.5 if total_ap > 0 else 1.0)
    conf_reserve = min(1.0, current_cash / (total_ap + 1e-6)) if total_ap > 0 else 1.0

    features = np.array([[runway_days, min_proj, ap_ar_ratio, volatility, conf_reserve]])
    pred = int(_RISK_MODEL.predict(features)[0])
    proba = _RISK_MODEL.predict_proba(features)[0]
    confidence = round(float(np.max(proba)) * 100, 1)
    return {
        "risk": RISK_LABELS[pred],
        "confidence": confidence,
        "current_cash": current_cash,
        "min_proj": min_proj,
        "end_proj": end_proj,
        "volatility": volatility,
        "runway_days": runway_days,
        "total_ar": total_ar,
        "total_ap": total_ap,
        "ap_ar_ratio": ap_ar_ratio,
        "proba": proba,
    }


def _apply_schedule(forecast_vals, last_date, ar_records, ap_records):
    schedule = np.zeros(len(forecast_vals))
    for rec in (ar_records or []):
        d = pd.to_datetime(rec.get("due_date"), errors="coerce")
        if pd.isna(d):
            continue
        offset = (d.normalize() - last_date.normalize()).days
        if 0 < offset <= len(forecast_vals):
            schedule[offset - 1] += float(rec.get("amount", 0))
    for rec in (ap_records or []):
        d = pd.to_datetime(rec.get("due_date"), errors="coerce")
        if pd.isna(d):
            continue
        offset = (d.normalize() - last_date.normalize()).days
        if 0 < offset <= len(forecast_vals):
            schedule[offset - 1] -= float(rec.get("amount", 0))
    return forecast_vals + np.cumsum(schedule)


def quick_risk(transactions, opening_balance, ar_records, ap_records, currency="USD"):
    """Fast risk classification (linear-trend projection, no ARIMA fit)."""
    series = build_daily_balance(transactions, opening_balance)
    hist = series[-120:]
    y = hist.values.astype(float)
    x = np.arange(len(y))
    slope, intercept = (np.polyfit(x, y, 1) if len(y) >= 2 else (0.0, y[-1] if len(y) else 0.0))
    future = np.arange(len(y), len(y) + 90)
    forecast_vals = slope * future + intercept
    forecast_vals = _apply_schedule(forecast_vals, hist.index[-1], ar_records, ap_records)
    r = _risk_from_forecast(hist, forecast_vals, ar_records, ap_records, currency)
    return {
        "risk": r["risk"],
        "confidence": r["confidence"],
        "runway_days": r["runway_days"],
        "min_projected": round(r["min_proj"], 2),
        "projected_90d": round(r["end_proj"], 2),
        "volatility": round(r["volatility"], 3),
    }


def forecast_liquidity(transactions, opening_balance, ar_records, ap_records, currency="USD"):
    """Full 90-day forecast + risk classification for one company."""
    series = build_daily_balance(transactions, opening_balance)
    hist = series[-120:]
    forecast_vals, model_name = _arima_forecast(hist, steps=90)

    last_date = hist.index[-1]
    future_dates = [last_date + timedelta(days=i + 1) for i in range(90)]

    # Overlay scheduled AR inflows (+) and AP outflows (-) on their due dates
    schedule = np.zeros(90)
    for rec in (ar_records or []):
        d = pd.to_datetime(rec.get("due_date"), errors="coerce")
        if pd.isna(d):
            continue
        offset = (d.normalize() - last_date.normalize()).days
        if 0 < offset <= 90:
            schedule[offset - 1] += float(rec.get("amount", 0))
    for rec in (ap_records or []):
        d = pd.to_datetime(rec.get("due_date"), errors="coerce")
        if pd.isna(d):
            continue
        offset = (d.normalize() - last_date.normalize()).days
        if 0 < offset <= 90:
            schedule[offset - 1] -= float(rec.get("amount", 0))
    forecast_vals = forecast_vals + np.cumsum(schedule)

    hist_points = [{"date": d.strftime("%Y-%m-%d"), "value": round(float(v), 2)}
                   for d, v in zip(hist.index, hist.values)]
    fc_points = [{"date": d.strftime("%Y-%m-%d"), "value": round(float(v), 2)}
                 for d, v in zip(future_dates, forecast_vals)]

    current_cash = float(hist.values[-1])
    min_proj = float(np.min(forecast_vals))
    end_proj = float(forecast_vals[-1])
    daily_returns = np.diff(hist.values)
    volatility = float(np.std(daily_returns) / (abs(np.mean(hist.values)) + 1e-9))
    volatility = min(volatility, 1.0)

    # Cash runway: days until projected balance goes below zero (or 90+)
    below = np.where(forecast_vals < 0)[0]
    runway_days = int(below[0] + 1) if len(below) else 90 + int(max(0, end_proj) / (abs(np.mean(np.diff(forecast_vals))) + 1e-6))
    runway_days = min(runway_days, 999)

    total_ar = sum(float(r.get("amount", 0)) for r in (ar_records or []))
    total_ap = sum(float(r.get("amount", 0)) for r in (ap_records or []))
    ap_ar_ratio = (total_ap / total_ar) if total_ar > 0 else (2.5 if total_ap > 0 else 1.0)
    conf_reserve = min(1.0, current_cash / (total_ap + 1e-6)) if total_ap > 0 else 1.0

    features = np.array([[runway_days, min_proj, ap_ar_ratio, volatility, conf_reserve]])
    pred = int(_RISK_MODEL.predict(features)[0])
    proba = _RISK_MODEL.predict_proba(features)[0]
    confidence = round(float(np.max(proba)) * 100, 1)

    return {
        "model": model_name,
        "classifier": "RandomForest",
        "currency": currency,
        "history": hist_points,
        "forecast": fc_points,
        "risk": RISK_LABELS[pred],
        "confidence": confidence,
        "risk_probabilities": {RISK_LABELS[i]: round(float(proba[i]) * 100, 1) for i in range(3)},
        "metrics": {
            "current_cash": round(current_cash, 2),
            "projected_90d": round(end_proj, 2),
            "min_projected": round(min_proj, 2),
            "runway_days": runway_days,
            "volatility": round(volatility, 3),
            "total_ar": round(total_ar, 2),
            "total_ap": round(total_ap, 2),
            "ap_ar_ratio": round(ap_ar_ratio, 2),
            "net_change_90d": round(end_proj - current_cash, 2),
        },
    }
