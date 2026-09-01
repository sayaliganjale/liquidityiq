"""Live price streaming over WebSocket with a shared short-TTL quote cache."""
import asyncio
import time
import logging

from fastapi import WebSocket, WebSocketDisconnect

import market

logger = logging.getLogger("liquidityiq.stream")

CACHE_TTL = 4.0
PUSH_INTERVAL = 5.0
MAX_SYMBOLS = 40

_cache: dict[str, tuple[float, dict]] = {}
_locks: dict[str, asyncio.Lock] = {}


async def quote_cached(symbol: str) -> dict:
    now = time.time()
    hit = _cache.get(symbol)
    if hit and now - hit[0] < CACHE_TTL:
        return hit[1]
    lock = _locks.setdefault(symbol, asyncio.Lock())
    async with lock:
        hit = _cache.get(symbol)
        if hit and time.time() - hit[0] < CACHE_TTL:
            return hit[1]
        q = await asyncio.to_thread(market.get_quote, symbol)
        _cache[symbol] = (time.time(), q)
        return q


def _slim(q: dict) -> dict:
    return {
        "symbol": q.get("symbol"),
        "ok": q.get("ok", False),
        "name": q.get("name"),
        "price": q.get("price"),
        "change": q.get("change"),
        "changePercent": q.get("changePercent"),
        "currency": q.get("currency"),
        "exchange": q.get("exchange"),
        "dayHigh": q.get("dayHigh"),
        "dayLow": q.get("dayLow"),
        "volume": q.get("volume"),
        "previousClose": q.get("previousClose"),
    }


async def price_socket(ws: WebSocket):
    await ws.accept()
    state = {"symbols": [], "dirty": True}

    async def reader():
        while True:
            msg = await ws.receive_json()
            if isinstance(msg, dict) and isinstance(msg.get("symbols"), list):
                syms = []
                for s in msg["symbols"][:MAX_SYMBOLS]:
                    s = str(s).strip().upper()
                    if s and s not in syms:
                        syms.append(s)
                state["symbols"] = syms
                state["dirty"] = True

    async def pusher():
        while True:
            syms = list(state["symbols"])
            if syms:
                quotes = await asyncio.gather(*[quote_cached(s) for s in syms],
                                              return_exceptions=True)
                payload = [_slim(q) for q in quotes if isinstance(q, dict)]
                await ws.send_json({"type": "tick", "ts": time.time(), "quotes": payload})
                state["dirty"] = False
                # Immediately honour a fresh subscription, otherwise pace the feed
                for _ in range(int(PUSH_INTERVAL * 10)):
                    if state["dirty"]:
                        break
                    await asyncio.sleep(0.1)
            else:
                await asyncio.sleep(0.3)

    tasks = [asyncio.create_task(reader()), asyncio.create_task(pusher())]
    try:
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_EXCEPTION)
        for t in pending:
            t.cancel()
        for t in done:
            exc = t.exception()
            if exc and not isinstance(exc, WebSocketDisconnect):
                logger.warning(f"price socket ended: {exc}")
    except WebSocketDisconnect:
        pass
    finally:
        for t in tasks:
            t.cancel()
