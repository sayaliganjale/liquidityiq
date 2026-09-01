"""Live market data: Yahoo Finance quotes/search + ExchangeRate FX sync.

All functions are null-safe and degrade gracefully on rate limits / errors.
"""
import time
import requests

_UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

# tiny in-memory cache: key -> (expires_ts, value)
_CACHE: dict = {}


def _cache_get(key: str):
    hit = _CACHE.get(key)
    if hit and hit[0] > time.time():
        return hit[1]
    return None


def _cache_set(key: str, value, ttl: int):
    _CACHE[key] = (time.time() + ttl, value)


EXCHANGE_MAP = {
    "NMS": "NASDAQ", "NGM": "NASDAQ", "NAS": "NASDAQ",
    "NYQ": "NYSE", "NYS": "NYSE", "PCX": "NYSE",
    "NSI": "NSE", "BSE": "BSE", "BOM": "BSE",
}


def get_quote(ticker: str) -> dict:
    """Real-time quote from Yahoo Finance chart API. Never raises."""
    ticker = (ticker or "").strip().upper()
    if not ticker:
        return {"symbol": ticker, "ok": False, "error": "empty ticker"}
    cached = _cache_get(f"q:{ticker}")
    if cached:
        return cached
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
        params = {"interval": "1d", "range": "1mo"}
        r = requests.get(url, params=params, headers=_UA, timeout=8)
        data = r.json()
        result = (data.get("chart", {}).get("result") or [None])[0]
        if not result:
            return {"symbol": ticker, "ok": False, "error": "not found"}
        meta = result.get("meta", {})
        ts = result.get("timestamp") or []
        quotes = (result.get("indicators", {}).get("quote") or [{}])[0]
        closes = [c for c in (quotes.get("close") or []) if c is not None]
        exch_code = meta.get("exchangeName") or ""
        out = {
            "symbol": meta.get("symbol", ticker),
            "ok": True,
            "name": meta.get("longName") or meta.get("shortName") or ticker,
            "price": meta.get("regularMarketPrice"),
            "previousClose": meta.get("chartPreviousClose") or meta.get("previousClose"),
            "currency": meta.get("currency", "USD"),
            "exchange": EXCHANGE_MAP.get(exch_code, exch_code),
            "dayHigh": meta.get("regularMarketDayHigh"),
            "dayLow": meta.get("regularMarketDayLow"),
            "fiftyTwoWeekHigh": meta.get("fiftyTwoWeekHigh"),
            "fiftyTwoWeekLow": meta.get("fiftyTwoWeekLow"),
            "volume": meta.get("regularMarketVolume"),
            "spark": closes[-30:],
        }
        price = out["price"] or 0
        prev = out["previousClose"] or price
        out["change"] = round(price - prev, 2) if price else 0
        out["changePercent"] = round(((price - prev) / prev * 100), 2) if prev else 0
        _cache_set(f"q:{ticker}", out, ttl=30)
        return out
    except Exception as e:
        return {"symbol": ticker, "ok": False, "error": str(e)}


def search_symbols(query: str) -> list:
    """Live global ticker search across NSE/BSE/NASDAQ/NYSE. Never raises."""
    query = (query or "").strip()
    if not query:
        return []
    cached = _cache_get(f"s:{query.lower()}")
    if cached:
        return cached
    try:
        url = "https://query2.finance.yahoo.com/v1/finance/search"
        r = requests.get(url, params={"q": query, "quotesCount": 12, "newsCount": 0},
                         headers=_UA, timeout=8)
        data = r.json()
        out = []
        for q in data.get("quotes", []):
            if q.get("quoteType") != "EQUITY":
                continue
            out.append({
                "symbol": q.get("symbol"),
                "name": q.get("longname") or q.get("shortname") or q.get("symbol"),
                "exchange": q.get("exchDisp") or q.get("exchange"),
                "sector": q.get("sector"),
                "industry": q.get("industry"),
                "type": q.get("typeDisp", "Equity"),
            })
        _cache_set(f"s:{query.lower()}", out, ttl=60)
        return out
    except Exception:
        return []


def get_history(ticker: str, rng: str = "6mo", interval: str = "1d") -> list:
    """Historical close series for charting. Returns [{date, close}]."""
    ticker = (ticker or "").strip().upper()
    if not ticker:
        return []
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
        r = requests.get(url, params={"interval": interval, "range": rng},
                         headers=_UA, timeout=8)
        data = r.json()
        result = (data.get("chart", {}).get("result") or [None])[0]
        if not result:
            return []
        ts = result.get("timestamp") or []
        closes = (result.get("indicators", {}).get("quote") or [{}])[0].get("close") or []
        out = []
        for t, c in zip(ts, closes):
            if c is None:
                continue
            out.append({"date": time.strftime("%Y-%m-%d", time.gmtime(t)), "close": round(c, 2)})
        return out
    except Exception:
        return []


def get_fx_rates(base: str = "USD") -> dict:
    """Multi-currency sync via free ExchangeRate-API. Never raises."""
    base = (base or "USD").strip().upper()
    cached = _cache_get(f"fx:{base}")
    if cached:
        return cached
    try:
        r = requests.get(f"https://open.er-api.com/v6/latest/{base}", timeout=8)
        data = r.json()
        if data.get("result") != "success":
            return {"base": base, "ok": False, "rates": {}}
        out = {
            "base": base,
            "ok": True,
            "updated": data.get("time_last_update_utc"),
            "rates": data.get("rates", {}),
        }
        _cache_set(f"fx:{base}", out, ttl=1800)
        return out
    except Exception:
        return {"base": base, "ok": False, "rates": {}}
