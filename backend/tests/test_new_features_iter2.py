"""Iteration 2: WebSocket price stream + out-of-scope AI answering."""
import os
import json
import asyncio
import requests
import pytest
import websockets

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://iq-liquidity.preview.emergentagent.com").rstrip("/")
WS_BASE = BASE.replace("https://", "wss://").replace("http://", "ws://")
ADMIN_EMAIL = "admin@liquidityiq.com"
ADMIN_PW = "LiquidityIQ2026!"


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW})
    assert r.status_code == 200
    return s


def test_websocket_price_stream_ticks():
    """WS should connect at /api/ws/prices and push ticks after subscription."""
    async def run():
        url = f"{WS_BASE}/api/ws/prices"
        async with websockets.connect(url, open_timeout=10) as ws:
            await ws.send(json.dumps({"symbols": ["AAPL", "MSFT"]}))
            # Collect frames for up to 12s (push interval ~5s)
            got = []
            end = asyncio.get_event_loop().time() + 12
            while asyncio.get_event_loop().time() < end and len(got) < 3:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=8)
                    got.append(json.loads(msg))
                except asyncio.TimeoutError:
                    break
            return got
    frames = asyncio.get_event_loop().run_until_complete(run())
    assert len(frames) >= 1, f"expected at least 1 frame from WS, got {frames}"
    # look for tick-like content
    found_symbol = False
    for f in frames:
        s = json.dumps(f).upper()
        if "AAPL" in s or "MSFT" in s:
            found_symbol = True
            break
    assert found_symbol, f"no ticker payload in frames: {frames}"


def test_ai_answers_out_of_scope(admin):
    """AI must answer non-treasury questions (per new SYSTEM prompt)."""
    companies = admin.get(f"{BASE}/api/companies").json()
    cid = companies[0]["id"]
    r = admin.post(
        f"{BASE}/api/ai/chat",
        json={"company_id": cid, "message": "Explain how a transformer neural network works in three sentences."},
        stream=True, timeout=90,
    )
    assert r.status_code == 200
    body = b""
    for chunk in r.iter_content(chunk_size=1024):
        body += chunk
        if len(body) > 30000:
            break
    text = body.decode("utf-8", errors="ignore").lower()
    assert len(text) > 50, f"too short: {text[:200]}"
    # refusal markers should NOT be present
    refusals = ["i can only help with treasury", "out of scope", "i'm unable to answer", "cannot answer questions outside"]
    for rf in refusals:
        assert rf not in text, f"AI refused out-of-scope question: found '{rf}' in: {text[:400]}"
    # substantive answer markers
    assert any(k in text for k in ["transformer", "attention", "neural", "token", "model"]), f"no substantive content: {text[:400]}"
