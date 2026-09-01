"""LiquidityIQ API — Enterprise Liquidity Management & 90-Day ML Cash Forecasting."""
import os
import io
import csv
import re
import uuid
import logging
from datetime import datetime, timezone

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import (FastAPI, APIRouter, Request, Response, HTTPException, Depends, Query,
                     UploadFile, File, WebSocket)
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

import auth as auth_mod
import market as market_mod
import scenario as scenario_mod
import analytics as analytics_mod
import alerts as alerts_mod
import ai_analyst
import stream as stream_mod
from ml_forecast import forecast_liquidity, quick_risk
from seed_data import seed_data, build_entity_financials
from models import (RegisterInput, LoginInput, CompanyInput, CompanyUpdate, OnboardTickerInput,
                    ScenarioInput, AlertRuleInput, AlertRuleUpdate, WatchlistInput, ChatInput,
                    RoleUpdate)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("liquidityiq")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="LiquidityIQ API")
api = APIRouter(prefix="/api")

ROLES = ("admin", "analyst", "viewer")
WRITE_ROLES = ("admin", "analyst")


async def current_user(request: Request):
    return await auth_mod.get_current_user_from_db(request, db)


def require_write(user: dict):
    if user.get("role") not in WRITE_ROLES:
        raise HTTPException(status_code=403, detail="Your role has read-only access")


def require_admin(user: dict):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")


def _oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")


def _serialize_company(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc


def _visibility(user: dict) -> dict:
    """Admins see everything; others see shared demo entities plus the ones they own."""
    if user.get("role") == "admin":
        return {}
    return {"$or": [{"owner_id": None}, {"owner_id": {"$exists": False}}, {"owner_id": user["_id"]}]}


async def _get_visible_company(cid: str, user: dict) -> dict:
    doc = await db.companies.find_one({"_id": _oid(cid), **_visibility(user)})
    if not doc:
        raise HTTPException(status_code=404, detail="Company not found")
    return doc


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-") or uuid.uuid4().hex[:8]


# ----------------------------- Auth -----------------------------
@api.post("/auth/register")
async def register(payload: RegisterInput, response: Response):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "password_hash": auth_mod.hash_password(payload.password),
        "name": payload.name or "User",
        "role": "analyst",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    auth_mod.set_auth_cookies(response, auth_mod.create_access_token(uid, email),
                              auth_mod.create_refresh_token(uid))
    return {"id": uid, "email": email, "name": doc["name"], "role": doc["role"]}


@api.post("/auth/login")
async def login(payload: LoginInput, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not auth_mod.verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    uid = str(user["_id"])
    auth_mod.set_auth_cookies(response, auth_mod.create_access_token(uid, email),
                              auth_mod.create_refresh_token(uid))
    return {"id": uid, "email": email, "name": user.get("name", "User"), "role": user.get("role", "user")}


@api.post("/auth/logout")
async def logout(response: Response, user=Depends(current_user)):
    auth_mod.clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return user


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    import jwt
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, auth_mod.get_jwt_secret(), algorithms=[auth_mod.JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        uid = payload["sub"]
        u = await db.users.find_one({"_id": ObjectId(uid)})
        if not u:
            raise HTTPException(status_code=401, detail="User not found")
        is_dev = os.environ.get("ENV", "development") != "production"
        response.set_cookie("access_token", auth_mod.create_access_token(uid, u["email"]),
                            httponly=True, secure=not is_dev,
                            samesite="lax" if is_dev else "none", max_age=3600, path="/")
        return {"ok": True}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


# ----------------------------- Companies -----------------------------
async def _company_financials(cid: str):
    banks = await db.bank_accounts.find({"company_id": cid}).to_list(50)
    arap = await db.ar_ap.find({"company_id": cid}).to_list(200)
    total_cash = sum(b.get("balance", 0) for b in banks)
    ar = [r for r in arap if r.get("kind") == "AR"]
    ap = [r for r in arap if r.get("kind") == "AP"]
    return banks, ar, ap, total_cash


@api.get("/companies")
async def list_companies(user=Depends(current_user)):
    docs = await db.companies.find(_visibility(user)).to_list(300)
    out = []
    for d in docs:
        cid = str(d["_id"])
        _, ar, ap, total_cash = await _company_financials(cid)
        c = _serialize_company(d)
        c["total_cash"] = round(total_cash, 2)
        c["total_ar"] = round(sum(r.get("amount", 0) for r in ar), 2)
        c["total_ap"] = round(sum(r.get("amount", 0) for r in ap), 2)
        c["is_owner"] = c.get("owner_id") == user["_id"]
        out.append(c)
    return out


@api.post("/companies")
async def create_company(payload: CompanyInput, user=Depends(current_user)):
    require_write(user)
    doc = {
        "name": payload.name,
        "slug": _slugify(payload.name),
        "kind": "private",
        "ticker": None,
        "exchange": None,
        "currency": (payload.currency or "USD").upper(),
        "sector": payload.sector,
        "country": payload.country,
        "logo_bg": payload.logo_bg,
        "owner_id": user["_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.companies.insert_one(doc)
    cid = str(res.inserted_id)
    txns, banks, arap = build_entity_financials(cid, float(payload.opening_cash), doc["currency"],
                                                seed=abs(hash(cid)) % 9999)
    if txns:
        await db.transactions.insert_many(txns)
    await db.bank_accounts.insert_many(banks)
    await db.ar_ap.insert_many(arap)
    return {**_serialize_company({**doc, "_id": res.inserted_id}), "generated_transactions": len(txns)}


@api.post("/companies/onboard")
async def onboard_ticker(payload: OnboardTickerInput, user=Depends(current_user)):
    require_write(user)
    ticker = payload.ticker.strip().upper()
    quote = market_mod.get_quote(ticker)
    if not quote.get("ok"):
        raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found on any supported exchange")
    if await db.companies.find_one({"ticker": ticker, **_visibility(user)}):
        raise HTTPException(status_code=400, detail=f"{ticker} is already in your portfolio")
    currency = quote.get("currency", "USD")
    price = quote.get("price") or 0
    volume = quote.get("volume") or 0
    # Derive a plausible treasury cash position from live market activity
    opening = payload.opening_cash or max(500_000.0, round(price * max(volume, 10_000) * 0.0015, 2))
    doc = {
        "name": quote.get("name") or ticker,
        "slug": _slugify(quote.get("name") or ticker),
        "kind": "public",
        "ticker": ticker,
        "exchange": quote.get("exchange") or "—",
        "currency": currency,
        "sector": "Listed Equity",
        "country": "India" if ticker.endswith((".NS", ".BO")) else "Global",
        "logo_bg": "#12233A",
        "owner_id": user["_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.companies.insert_one(doc)
    cid = str(res.inserted_id)
    txns, banks, arap = build_entity_financials(cid, float(opening), currency, seed=abs(hash(ticker)) % 9999)
    if txns:
        await db.transactions.insert_many(txns)
    await db.bank_accounts.insert_many(banks)
    await db.ar_ap.insert_many(arap)
    return {**_serialize_company({**doc, "_id": res.inserted_id}), "quote": quote,
            "opening_cash": round(opening, 2)}


@api.patch("/companies/{cid}")
async def update_company(cid: str, payload: CompanyUpdate, user=Depends(current_user)):
    require_write(user)
    doc = await _get_visible_company(cid, user)
    if doc.get("owner_id") not in (user["_id"], None) and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="You do not own this entity")
    if not doc.get("owner_id") and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Shared demo entities can only be edited by an admin")
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if "name" in updates:
        updates["slug"] = _slugify(updates["name"])
    if "currency" in updates:
        updates["currency"] = updates["currency"].upper()
    if updates:
        await db.companies.update_one({"_id": _oid(cid)}, {"$set": updates})
    return _serialize_company(await db.companies.find_one({"_id": _oid(cid)}))


@api.delete("/companies/{cid}")
async def delete_company(cid: str, user=Depends(current_user)):
    require_write(user)
    doc = await _get_visible_company(cid, user)
    if not doc.get("owner_id") and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Shared demo entities can only be deleted by an admin")
    if doc.get("owner_id") and doc.get("owner_id") != user["_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="You do not own this entity")
    await db.companies.delete_one({"_id": _oid(cid)})
    await db.transactions.delete_many({"company_id": cid})
    await db.bank_accounts.delete_many({"company_id": cid})
    await db.ar_ap.delete_many({"company_id": cid})
    await db.alert_rules.delete_many({"scope": cid})
    return {"deleted": True, "id": cid}


@api.get("/companies/{cid}")
async def get_company(cid: str, user=Depends(current_user)):
    d = await _get_visible_company(cid, user)
    banks, ar, ap, total_cash = await _company_financials(cid)
    txns = await db.transactions.find({"company_id": cid}).sort("date", -1).to_list(300)
    for t in txns:
        t["id"] = str(t.pop("_id"))
    for b in banks:
        b["id"] = str(b.pop("_id"))
    for r in (ar + ap):
        r["id"] = str(r.pop("_id"))
    c = _serialize_company(d)
    c["total_cash"] = round(total_cash, 2)
    c["is_owner"] = c.get("owner_id") == user["_id"]
    return {
        "company": c,
        "bank_accounts": banks,
        "ar": ar,
        "ap": ap,
        "transactions": txns[:60],
        "total_ar": round(sum(r.get("amount", 0) for r in ar), 2),
        "total_ap": round(sum(r.get("amount", 0) for r in ap), 2),
    }


@api.get("/companies/{cid}/forecast")
async def company_forecast(cid: str, user=Depends(current_user)):
    d = await _get_visible_company(cid, user)
    banks, ar, ap, total_cash = await _company_financials(cid)
    txns = await db.transactions.find({"company_id": cid}).to_list(2000)
    result = forecast_liquidity(txns, total_cash, ar, ap, currency=d.get("currency", "USD"))
    result["company_name"] = d.get("name")
    return result


@api.post("/companies/{cid}/scenario")
async def company_scenario(cid: str, payload: ScenarioInput, user=Depends(current_user)):
    d = await _get_visible_company(cid, user)
    banks, ar, ap, total_cash = await _company_financials(cid)
    txns = await db.transactions.find({"company_id": cid}).to_list(2000)
    out = scenario_mod.simulate(txns, total_cash, ar, ap, d.get("currency", "USD"), payload.model_dump())
    out["company_name"] = d.get("name")
    return out


@api.get("/companies/{cid}/analytics")
async def company_analytics(cid: str, user=Depends(current_user)):
    d = await _get_visible_company(cid, user)
    banks, ar, ap, total_cash = await _company_financials(cid)
    txns = await db.transactions.find({"company_id": cid}).to_list(2000)
    return {
        "currency": d.get("currency", "USD"),
        "ar_aging": analytics_mod.aging(ar),
        "ap_aging": analytics_mod.aging(ap),
        "kpis": analytics_mod.kpis(txns, ar, ap, total_cash),
        "categories": analytics_mod.category_breakdown(txns),
    }


# ----------------------------- Ledger -----------------------------
@api.get("/companies/{cid}/transactions")
async def list_transactions(cid: str, search: str = "", direction: str = "", category: str = "",
                            date_from: str = "", date_to: str = "",
                            page: int = Query(1, ge=1), limit: int = Query(25, ge=5, le=200),
                            user=Depends(current_user)):
    await _get_visible_company(cid, user)
    q: dict = {"company_id": cid}
    if search:
        q["$or"] = [{"description": {"$regex": re.escape(search), "$options": "i"}},
                    {"category": {"$regex": re.escape(search), "$options": "i"}}]
    if direction in ("in", "out"):
        q["direction"] = direction
    if category:
        q["category"] = category
    if date_from or date_to:
        rng = {}
        if date_from:
            rng["$gte"] = date_from
        if date_to:
            rng["$lte"] = date_to
        q["date"] = rng
    total = await db.transactions.count_documents(q)
    docs = await db.transactions.find(q).sort("date", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    for t in docs:
        t["id"] = str(t.pop("_id"))
    cats = await db.transactions.distinct("category", {"company_id": cid})
    inflow = sum(t["amount"] for t in docs if t.get("direction") == "in")
    outflow = sum(t["amount"] for t in docs if t.get("direction") == "out")
    return {
        "items": docs, "total": total, "page": page, "limit": limit,
        "pages": max(1, -(-total // limit)),
        "categories": sorted(c for c in cats if c),
        "page_inflow": round(inflow, 2), "page_outflow": round(outflow, 2),
    }


@api.get("/companies/{cid}/transactions/export")
async def export_transactions(cid: str, user=Depends(current_user)):
    d = await _get_visible_company(cid, user)
    docs = await db.transactions.find({"company_id": cid}).sort("date", -1).to_list(5000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["date", "description", "category", "direction", "amount", "currency", "balance_after"])
    for t in docs:
        w.writerow([t.get("date"), t.get("description"), t.get("category"), t.get("direction"),
                    t.get("amount"), t.get("currency"), t.get("balance_after")])
    filename = f"{d.get('slug', 'ledger')}-ledger.csv"
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@api.post("/companies/{cid}/transactions/import")
async def import_transactions(cid: str, file: UploadFile = File(...), user=Depends(current_user)):
    require_write(user)
    d = await _get_visible_company(cid, user)
    raw = (await file.read()).decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(raw))
    rows, errors = [], []
    for i, row in enumerate(reader, start=2):
        try:
            amount = abs(float(str(row.get("amount", "0")).replace(",", "")))
            direction = (row.get("direction") or "").strip().lower()
            if direction not in ("in", "out"):
                direction = "in" if float(str(row.get("amount", "0")).replace(",", "")) >= 0 else "out"
            date = (row.get("date") or "").strip()[:10]
            if not date:
                raise ValueError("missing date")
            rows.append({
                "company_id": cid,
                "date": date,
                "description": (row.get("description") or "Imported entry").strip()[:200],
                "category": (row.get("category") or "Imported").strip()[:80],
                "direction": direction,
                "amount": amount,
                "currency": (row.get("currency") or d.get("currency", "USD")).strip().upper(),
                "balance_after": None,
            })
        except Exception as e:
            errors.append({"line": i, "error": str(e)})
    if rows:
        await db.transactions.insert_many(rows)
    return {"imported": len(rows), "skipped": len(errors), "errors": errors[:10]}


# ----------------------------- Market (live) -----------------------------
@api.get("/market/search")
async def market_search(q: str = Query(..., min_length=1), user=Depends(current_user)):
    return {"query": q, "results": market_mod.search_symbols(q)}


@api.get("/market/quote/{ticker}")
async def market_quote(ticker: str, user=Depends(current_user)):
    return market_mod.get_quote(ticker)


@api.get("/market/history/{ticker}")
async def market_history(ticker: str, rng: str = "6mo", user=Depends(current_user)):
    return {"ticker": ticker.upper(), "series": market_mod.get_history(ticker, rng=rng)}


@api.get("/market/fx")
async def market_fx(base: str = "USD", user=Depends(current_user)):
    return market_mod.get_fx_rates(base)


@api.get("/market/watchlist")
async def market_watchlist(user=Depends(current_user)):
    docs = await db.companies.find({"kind": "public", **_visibility(user)}).to_list(50)
    quotes = []
    for d in docs:
        if d.get("ticker"):
            q = market_mod.get_quote(d["ticker"])
            q["company_id"] = str(d["_id"])
            quotes.append(q)
    return {"quotes": quotes}


# ----------------------------- Personal watchlist -----------------------------
@api.get("/watchlist")
async def get_watchlist(user=Depends(current_user)):
    items = await db.watchlist.find({"user_id": user["_id"]}).sort("created_at", 1).to_list(60)
    out = []
    for it in items:
        q = market_mod.get_quote(it["symbol"])
        out.append({"id": str(it["_id"]), "symbol": it["symbol"], "note": it.get("note"),
                    "created_at": it.get("created_at"), "quote": q})
    return {"items": out}


@api.post("/watchlist")
async def add_watchlist(payload: WatchlistInput, user=Depends(current_user)):
    symbol = payload.symbol.strip().upper()
    quote = market_mod.get_quote(symbol)
    if not quote.get("ok"):
        raise HTTPException(status_code=404, detail=f"Ticker '{symbol}' not found")
    if await db.watchlist.find_one({"user_id": user["_id"], "symbol": symbol}):
        raise HTTPException(status_code=400, detail=f"{symbol} is already on your watchlist")
    doc = {"user_id": user["_id"], "symbol": symbol, "note": payload.note,
           "created_at": datetime.now(timezone.utc).isoformat()}
    res = await db.watchlist.insert_one(doc)
    return {"id": str(res.inserted_id), "symbol": symbol, "quote": quote}


@api.delete("/watchlist/{wid}")
async def remove_watchlist(wid: str, user=Depends(current_user)):
    res = await db.watchlist.delete_one({"_id": _oid(wid), "user_id": user["_id"]})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Watchlist item not found")
    return {"deleted": True}


# ----------------------------- Dashboard -----------------------------
async def _entity_metrics(user: dict):
    docs = await db.companies.find(_visibility(user)).to_list(300)
    fx = market_mod.get_fx_rates("USD").get("rates", {})

    def to_usd(amount, cur):
        if cur == "USD" or not fx:
            return amount
        rate = fx.get(cur)
        return amount / rate if rate else amount

    totals = {"cash": 0.0, "ar": 0.0, "ap": 0.0}
    public = private = 0
    risk_counts = {"LOW_RISK": 0, "MEDIUM_RISK": 0, "HIGH_RISK": 0}
    entities = []
    for d in docs:
        cid = str(d["_id"])
        banks, ar, ap, total_cash = await _company_financials(cid)
        cur = d.get("currency", "USD")
        cash_u = to_usd(total_cash, cur)
        ar_u = to_usd(sum(r.get("amount", 0) for r in ar), cur)
        ap_u = to_usd(sum(r.get("amount", 0) for r in ap), cur)
        totals["cash"] += cash_u
        totals["ar"] += ar_u
        totals["ap"] += ap_u
        if d.get("kind") == "public":
            public += 1
        else:
            private += 1
        txns = await db.transactions.find({"company_id": cid}).to_list(2000)
        fc = quick_risk(txns, total_cash, ar, ap, currency=cur)
        risk_counts[fc["risk"]] += 1
        entities.append({
            "id": cid, "name": d.get("name"), "kind": d.get("kind"),
            "ticker": d.get("ticker"), "exchange": d.get("exchange"),
            "currency": cur, "sector": d.get("sector"), "logo_bg": d.get("logo_bg", "#111"),
            "cash_usd": round(cash_u, 2), "ar_usd": round(ar_u, 2), "ap_usd": round(ap_u, 2),
            "risk": fc["risk"], "confidence": fc["confidence"], "runway_days": fc["runway_days"],
            "min_projected": fc["min_projected"], "projected_90d": fc["projected_90d"],
            "is_owner": d.get("owner_id") == user["_id"],
        })
    return docs, totals, public, private, risk_counts, entities


@api.get("/dashboard/summary")
async def dashboard_summary(user=Depends(current_user)):
    docs, totals, public, private, risk_counts, entities = await _entity_metrics(user)
    rules = await _rules_for(user)
    triggered = alerts_mod.evaluate(rules, entities)
    return {
        "totals": {
            "cash_usd": round(totals["cash"], 2),
            "ar_usd": round(totals["ar"], 2),
            "ap_usd": round(totals["ap"], 2),
            "net_position_usd": round(totals["cash"] + totals["ar"] - totals["ap"], 2),
            "entities": len(docs), "public": public, "private": private,
        },
        "risk_distribution": risk_counts,
        "entities": entities,
        "alert_count": len(triggered),
        "critical_count": sum(1 for a in triggered if a["severity"] == "critical"),
    }


# ----------------------------- Alerts -----------------------------
async def _rules_for(user: dict):
    docs = await db.alert_rules.find({"user_id": user["_id"]}).to_list(100)
    if not docs:
        seeded = [{**r, "user_id": user["_id"], "created_at": datetime.now(timezone.utc).isoformat()}
                  for r in alerts_mod.DEFAULT_RULES]
        await db.alert_rules.insert_many(seeded)
        docs = await db.alert_rules.find({"user_id": user["_id"]}).to_list(100)
    out = []
    for d in docs:
        d = dict(d)
        d["id"] = str(d.pop("_id"))
        d.pop("user_id", None)
        out.append(d)
    return out


@api.get("/alerts/rules")
async def get_rules(user=Depends(current_user)):
    return {"rules": await _rules_for(user), "metrics": alerts_mod.METRICS, "operators": alerts_mod.OPS}


@api.post("/alerts/rules")
async def create_rule(payload: AlertRuleInput, user=Depends(current_user)):
    require_write(user)
    if payload.metric not in alerts_mod.METRICS:
        raise HTTPException(status_code=400, detail="Unknown metric")
    if payload.op not in alerts_mod.OPS:
        raise HTTPException(status_code=400, detail="Unknown operator")
    doc = {**payload.model_dump(), "user_id": user["_id"],
           "created_at": datetime.now(timezone.utc).isoformat()}
    res = await db.alert_rules.insert_one(doc)
    doc.pop("user_id")
    return {**doc, "id": str(res.inserted_id)}


@api.patch("/alerts/rules/{rid}")
async def update_rule(rid: str, payload: AlertRuleUpdate, user=Depends(current_user)):
    require_write(user)
    updates = payload.model_dump(exclude_none=True)
    res = await db.alert_rules.update_one({"_id": _oid(rid), "user_id": user["_id"]}, {"$set": updates})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Rule not found")
    d = await db.alert_rules.find_one({"_id": _oid(rid)})
    d["id"] = str(d.pop("_id"))
    d.pop("user_id", None)
    return d


@api.delete("/alerts/rules/{rid}")
async def delete_rule(rid: str, user=Depends(current_user)):
    require_write(user)
    res = await db.alert_rules.delete_one({"_id": _oid(rid), "user_id": user["_id"]})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"deleted": True}


@api.get("/alerts")
async def get_alerts(user=Depends(current_user)):
    _, _, _, _, _, entities = await _entity_metrics(user)
    rules = await _rules_for(user)
    triggered = alerts_mod.evaluate(rules, entities)
    return {
        "alerts": triggered,
        "count": len(triggered),
        "critical": sum(1 for a in triggered if a["severity"] == "critical"),
        "warning": sum(1 for a in triggered if a["severity"] == "warning"),
        "rules_evaluated": len(rules),
        "entities_scanned": len(entities),
    }


# ----------------------------- AI Liquidity Analyst -----------------------------
async def _company_ai_context(cid: str, user: dict):
    d = await _get_visible_company(cid, user)
    banks, ar, ap, total_cash = await _company_financials(cid)
    txns = await db.transactions.find({"company_id": cid}).to_list(2000)
    fc = forecast_liquidity(txns, total_cash, ar, ap, currency=d.get("currency", "USD"))
    trough_idx = min(range(len(fc["forecast"])), key=lambda i: fc["forecast"][i]["value"])
    return {
        "entity": {"name": d.get("name"), "ticker": d.get("ticker"), "kind": d.get("kind"),
                   "sector": d.get("sector"), "country": d.get("country"),
                   "currency": d.get("currency", "USD")},
        "cash_position": round(total_cash, 2),
        "bank_accounts": [{"name": b.get("name"), "type": b.get("account_type"),
                           "balance": b.get("balance")} for b in banks],
        "forecast": {
            "model": fc["model"], "risk": fc["risk"], "confidence": fc["confidence"],
            "risk_probabilities": fc["risk_probabilities"], "metrics": fc["metrics"],
            "trough": {"day": trough_idx + 1, "date": fc["forecast"][trough_idx]["date"],
                       "value": fc["forecast"][trough_idx]["value"]},
            "path_weekly": fc["forecast"][::7],
        },
        "ar_aging": analytics_mod.aging(ar),
        "ap_aging": analytics_mod.aging(ap),
        "kpis": analytics_mod.kpis(txns, ar, ap, total_cash),
        "largest_receivables": sorted(
            [{"counterparty": r.get("counterparty"), "amount": r.get("amount"),
              "due_date": r.get("due_date"), "status": r.get("status")} for r in ar],
            key=lambda x: -(x["amount"] or 0))[:6],
        "largest_payables": sorted(
            [{"counterparty": r.get("counterparty"), "amount": r.get("amount"),
              "due_date": r.get("due_date"), "status": r.get("status")} for r in ap],
            key=lambda x: -(x["amount"] or 0))[:6],
    }, d


@api.post("/ai/brief/{cid}")
async def ai_brief(cid: str, user=Depends(current_user)):
    ctx, d = await _company_ai_context(cid, user)
    session_id = f"brief-{cid}-{uuid.uuid4().hex[:8]}"
    try:
        text = await ai_analyst.generate_brief(ctx, session_id)
    except Exception as e:
        logger.exception("AI brief failed")
        raise HTTPException(status_code=502, detail=f"AI analyst unavailable: {e}")
    doc = {"user_id": user["_id"], "company_id": cid, "company_name": d.get("name"),
           "model": ai_analyst.MODEL, "content": text,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.ai_briefs.insert_one(doc)
    return {"company_id": cid, "company_name": d.get("name"), "model": ai_analyst.MODEL,
            "content": text, "risk": ctx["forecast"]["risk"],
            "created_at": doc["created_at"]}


@api.get("/ai/brief/{cid}/latest")
async def latest_brief(cid: str, user=Depends(current_user)):
    await _get_visible_company(cid, user)
    d = await db.ai_briefs.find_one({"user_id": user["_id"], "company_id": cid},
                                    sort=[("created_at", -1)])
    if not d:
        return {"content": None}
    return {"content": d.get("content"), "created_at": d.get("created_at"), "model": d.get("model")}


@api.get("/ai/sessions")
async def ai_sessions(user=Depends(current_user)):
    docs = await db.ai_sessions.find({"user_id": user["_id"]}).sort("updated_at", -1).to_list(50)
    return {"sessions": [{"session_id": d["session_id"], "title": d.get("title", "New chat"),
                          "updated_at": d.get("updated_at"),
                          "message_count": len(d.get("messages", []))} for d in docs]}


@api.get("/ai/sessions/{sid}")
async def ai_session(sid: str, user=Depends(current_user)):
    d = await db.ai_sessions.find_one({"session_id": sid, "user_id": user["_id"]})
    if not d:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"session_id": sid, "title": d.get("title"), "messages": d.get("messages", [])}


@api.delete("/ai/sessions/{sid}")
async def delete_session(sid: str, user=Depends(current_user)):
    await db.ai_sessions.delete_one({"session_id": sid, "user_id": user["_id"]})
    return {"deleted": True}


@api.post("/ai/chat")
async def ai_chat(payload: ChatInput, user=Depends(current_user)):
    session_id = payload.session_id or f"chat-{uuid.uuid4().hex[:12]}"
    sess = await db.ai_sessions.find_one({"session_id": session_id, "user_id": user["_id"]})
    history = sess.get("messages", []) if sess else []

    if payload.company_id:
        ctx, _ = await _company_ai_context(payload.company_id, user)
    else:
        _, totals, public, private, risk_counts, entities = await _entity_metrics(user)
        ctx = {
            "scope": "portfolio",
            "totals_usd": {k: round(v, 2) for k, v in totals.items()},
            "net_position_usd": round(totals["cash"] + totals["ar"] - totals["ap"], 2),
            "entity_count": len(entities), "public": public, "private": private,
            "risk_distribution": risk_counts,
            "entities": entities,
        }

    now = datetime.now(timezone.utc).isoformat()
    user_msg = {"role": "user", "content": payload.message, "ts": now}

    async def gen():
        collected = []
        try:
            async for chunk in ai_analyst.stream_answer(session_id, ctx, history, payload.message):
                collected.append(chunk)
                yield chunk
        except Exception as e:
            logger.exception("AI chat failed")
            yield f"\n\n[AI analyst unavailable: {e}]"
        answer = "".join(collected)
        await db.ai_sessions.update_one(
            {"session_id": session_id, "user_id": user["_id"]},
            {"$push": {"messages": {"$each": [user_msg, {"role": "assistant", "content": answer,
                                                          "ts": datetime.now(timezone.utc).isoformat()}]}},
             "$set": {"updated_at": datetime.now(timezone.utc).isoformat(),
                      "company_id": payload.company_id},
             "$setOnInsert": {"created_at": now, "title": payload.message[:60]}},
            upsert=True)

    return StreamingResponse(gen(), media_type="text/plain",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no",
                                      "X-Session-Id": session_id})


# ----------------------------- Team & Admin -----------------------------
@api.get("/team/users")
async def team_users(user=Depends(current_user)):
    require_admin(user)
    docs = await db.users.find().sort("created_at", 1).to_list(200)
    out = []
    for d in docs:
        owned = await db.companies.count_documents({"owner_id": str(d["_id"])})
        out.append({"id": str(d["_id"]), "email": d.get("email"), "name": d.get("name"),
                    "role": d.get("role", "viewer"), "created_at": d.get("created_at"),
                    "entities_owned": owned})
    return {"users": out, "roles": list(ROLES)}


@api.patch("/team/users/{uid}")
async def update_user_role(uid: str, payload: RoleUpdate, user=Depends(current_user)):
    require_admin(user)
    if payload.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Role must be one of {', '.join(ROLES)}")
    if uid == user["_id"] and payload.role != "admin":
        raise HTTPException(status_code=400, detail="You cannot demote your own admin account")
    res = await db.users.update_one({"_id": _oid(uid)}, {"$set": {"role": payload.role}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": uid, "role": payload.role}


@api.post("/admin/reseed")
async def reseed(user=Depends(current_user)):
    require_admin(user)
    return await seed_data(db, force=True)


@api.get("/")
async def root():
    return {"service": "LiquidityIQ", "status": "operational"}


@app.websocket("/api/ws/prices")
async def ws_prices(websocket: WebSocket):
    await stream_mod.price_socket(websocket)


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Session-Id"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.transactions.create_index([("company_id", 1), ("date", -1)])
    await db.watchlist.create_index([("user_id", 1), ("symbol", 1)], unique=True)
    await db.ai_sessions.create_index([("user_id", 1), ("session_id", 1)])
    await auth_mod.seed_admin(db)
    await db.users.update_many({"role": {"$nin": list(ROLES)}}, {"$set": {"role": "analyst"}})
    res = await seed_data(db)
    logger.info(f"Startup seed: {res}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
