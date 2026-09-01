"""Risk rules engine: evaluates user-defined thresholds against live entity metrics."""
from datetime import datetime, timezone

METRICS = {
    "runway_days": "Cash runway (days)",
    "min_projected": "Minimum projected cash",
    "cash_usd": "Current cash (USD)",
    "confidence": "Model confidence (%)",
    "risk_level": "Risk level (0=low,1=medium,2=high)",
}
OPS = {"lt": "<", "lte": "<=", "gt": ">", "gte": ">=", "eq": "="}
RISK_ORDINAL = {"LOW_RISK": 0, "MEDIUM_RISK": 1, "HIGH_RISK": 2}

DEFAULT_RULES = [
    {"name": "Runway below 30 days", "metric": "runway_days", "op": "lt", "value": 30,
     "severity": "critical", "scope": "all", "active": True},
    {"name": "Projected cash turns negative", "metric": "min_projected", "op": "lt", "value": 0,
     "severity": "critical", "scope": "all", "active": True},
    {"name": "High risk classification", "metric": "risk_level", "op": "gte", "value": 2,
     "severity": "warning", "scope": "all", "active": True},
    {"name": "Medium or higher risk", "metric": "risk_level", "op": "gte", "value": 1,
     "severity": "warning", "scope": "all", "active": True},
    {"name": "Model confidence below 85%", "metric": "confidence", "op": "lt", "value": 85,
     "severity": "warning", "scope": "all", "active": True},
    {"name": "Runway below 120 days", "metric": "runway_days", "op": "lt", "value": 120,
     "severity": "info", "scope": "all", "active": True},
]


def _compare(actual, op, target):
    if actual is None:
        return False
    return {
        "lt": actual < target, "lte": actual <= target,
        "gt": actual > target, "gte": actual >= target,
        "eq": actual == target,
    }.get(op, False)


def evaluate(rules, entities):
    """entities: list of dicts with id/name/cash_usd/risk/confidence/runway_days/min_projected."""
    triggered = []
    now = datetime.now(timezone.utc).isoformat()
    for rule in rules:
        if not rule.get("active", True):
            continue
        scope = rule.get("scope", "all")
        for e in entities:
            if scope not in ("all", e["id"]):
                continue
            metric = rule.get("metric")
            actual = RISK_ORDINAL.get(e.get("risk"), 1) if metric == "risk_level" else e.get(metric)
            if _compare(actual, rule.get("op"), float(rule.get("value", 0))):
                triggered.append({
                    "rule_id": rule.get("id"),
                    "rule_name": rule.get("name"),
                    "severity": rule.get("severity", "warning"),
                    "company_id": e["id"],
                    "company_name": e.get("name"),
                    "metric": metric,
                    "metric_label": METRICS.get(metric, metric),
                    "operator": OPS.get(rule.get("op"), rule.get("op")),
                    "threshold": float(rule.get("value", 0)),
                    "actual": actual,
                    "currency": e.get("currency", "USD"),
                    "detected_at": now,
                })
    order = {"critical": 0, "warning": 1, "info": 2}
    triggered.sort(key=lambda a: order.get(a["severity"], 3))
    return triggered
