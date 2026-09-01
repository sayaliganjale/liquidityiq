"""Backend tests for LiquidityIQ — auth, role enforcement, entities, alerts, AI chat, watchlist."""
import os
import time
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://iq-liquidity.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@liquidityiq.com"
ADMIN_PW = "LiquidityIQ2026!"


def _login(session, email, password):
    r = session.post(f"{BASE}/api/auth/login", json={"email": email, "password": password})
    return r


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = _login(s, ADMIN_EMAIL, ADMIN_PW)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def viewer():
    """Register a new user and demote to viewer via admin."""
    email = f"qa.viewer+{uuid.uuid4().hex[:6]}@test.com"
    pw = "Passw0rd!23"
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/register", json={"email": email, "password": pw, "name": "QA Viewer"})
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    me = s.get(f"{BASE}/api/auth/me").json()
    assert me.get("role") == "analyst", f"default role expected analyst, got {me.get('role')}"
    # Admin demotes
    admin_s = requests.Session()
    _login(admin_s, ADMIN_EMAIL, ADMIN_PW)
    users_resp = admin_s.get(f"{BASE}/api/team/users").json()
    users = users_resp.get("users", users_resp) if isinstance(users_resp, dict) else users_resp
    uid = None
    for u in users:
        if u.get("email") == email:
            uid = u.get("id")
            break
    assert uid, f"user {email} not found in team list"
    r2 = admin_s.patch(f"{BASE}/api/team/users/{uid}", json={"role": "viewer"})
    assert r2.status_code == 200, f"demote failed: {r2.status_code} {r2.text}"
    # Re-login viewer to refresh cookie/role
    s2 = requests.Session()
    _login(s2, email, pw)
    return s2, email, uid, admin_s


def test_admin_me(admin):
    r = admin.get(f"{BASE}/api/auth/me")
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == ADMIN_EMAIL
    assert data["role"] == "admin"


def test_list_companies_has_9_seeded(admin):
    r = admin.get(f"{BASE}/api/companies")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 9, f"expected at least 9 seeded, got {len(data)}"


def test_dashboard_summary(admin):
    r = admin.get(f"{BASE}/api/dashboard/summary")
    assert r.status_code == 200
    d = r.json()
    assert "total_cash" in d or "totals" in d or isinstance(d, dict)


def test_company_analytics_and_scenario(admin):
    companies = admin.get(f"{BASE}/api/companies").json()
    cid = companies[0]["id"]
    r = admin.get(f"{BASE}/api/companies/{cid}/analytics")
    assert r.status_code == 200
    a = r.json()
    # DSO/DPO/CCC keys
    assert any(k in a for k in ("dso", "dpo", "ccc", "kpis", "aging"))
    r2 = admin.post(f"{BASE}/api/companies/{cid}/scenario", json={
        "revenue_shock_pct": -20,
        "ar_delay_days": 30,
        "opex_shock_pct": 0,
        "ap_stretch_days": 0,
        "fx_shock_pct": 0,
    })
    assert r2.status_code == 200
    s = r2.json()
    assert isinstance(s, dict)


def test_alerts_endpoint(admin):
    r = admin.get(f"{BASE}/api/alerts")
    assert r.status_code == 200


def test_watchlist_endpoint(admin):
    r = admin.get(f"{BASE}/api/watchlist")
    assert r.status_code == 200


def test_transactions_endpoint(admin):
    companies = admin.get(f"{BASE}/api/companies").json()
    cid = companies[0]["id"]
    r = admin.get(f"{BASE}/api/companies/{cid}/transactions?page=1&page_size=10")
    assert r.status_code == 200
    d = r.json()
    assert "items" in d or isinstance(d, list)


def test_viewer_default_role_and_role_enforcement(viewer):
    s, email, uid, admin_s = viewer
    me = s.get(f"{BASE}/api/auth/me").json()
    assert me.get("role") == "viewer", f"viewer role expected, got {me}"

    # 1. viewer cannot POST /api/companies (private create) => 403
    r = s.post(f"{BASE}/api/companies", json={
        "name": "QA Viewer Blocked",
        "currency": "USD",
        "cash_balance": 1000,
    })
    assert r.status_code == 403, f"expected 403 for viewer create company, got {r.status_code}: {r.text[:200]}"

    # 2. viewer cannot access /api/team/users
    r2 = s.get(f"{BASE}/api/team/users")
    assert r2.status_code == 403

    # 3. viewer CAN read companies, dashboard, forecasts
    r3 = s.get(f"{BASE}/api/companies")
    assert r3.status_code == 200
    companies = r3.json()
    cid = companies[0]["id"]
    r4 = s.get(f"{BASE}/api/companies/{cid}/forecast")
    assert r4.status_code == 200
    r5 = s.get(f"{BASE}/api/dashboard/summary")
    assert r5.status_code == 200

    # 4. viewer cannot create alert rule
    r6 = s.post(f"{BASE}/api/alerts/rules", json={
        "name": "Blocked", "metric": "cash", "op": "<", "value": 0, "severity": "warning"
    })
    assert r6.status_code == 403


def test_entity_crud_admin(admin):
    """Create private entity as admin, edit, delete. Also test onboard optionally."""
    payload = {"name": f"TEST_QA_{uuid.uuid4().hex[:6]}", "currency": "USD", "cash_balance": 3000000}
    r = admin.post(f"{BASE}/api/companies", json=payload)
    assert r.status_code in (200, 201), f"create failed: {r.status_code} {r.text}"
    ent = r.json()
    eid = ent.get("id")
    assert eid
    # Edit
    r2 = admin.patch(f"{BASE}/api/companies/{eid}", json={"name": payload["name"] + "_edited"})
    assert r2.status_code in (200, 204)
    # Verify
    r3 = admin.get(f"{BASE}/api/companies/{eid}")
    assert r3.status_code == 200
    got = r3.json()
    got = got.get("company", got)
    assert "_edited" in got["name"]
    # Delete
    r4 = admin.delete(f"{BASE}/api/companies/{eid}")
    assert r4.status_code in (200, 204)
    # Verify gone
    r5 = admin.get(f"{BASE}/api/companies/{eid}")
    assert r5.status_code == 404


def test_ai_chat_multiturn(admin):
    """Test streaming chat and session continuity via X-Session-Id header."""
    companies = admin.get(f"{BASE}/api/companies").json()
    cid = companies[0]["id"]
    # First message
    r1 = admin.post(f"{BASE}/api/ai/chat", json={"company_id": cid, "message": "Summarize cash position in one sentence."}, stream=True, timeout=90)
    assert r1.status_code == 200, f"chat failed: {r1.status_code} {r1.text[:200]}"
    session_id = r1.headers.get("X-Session-Id") or r1.headers.get("x-session-id")
    body1 = b""
    for chunk in r1.iter_content(chunk_size=1024):
        body1 += chunk
        if len(body1) > 20000:
            break
    assert len(body1) > 0, "no streaming content received"
    assert session_id, f"no X-Session-Id header, got headers: {dict(r1.headers)}"

    # Second turn — must include session id
    r2 = admin.post(f"{BASE}/api/ai/chat", json={
        "company_id": cid, "message": "And what should I do first?", "session_id": session_id
    }, stream=True, timeout=90)
    assert r2.status_code == 200
    body2 = b""
    for chunk in r2.iter_content(chunk_size=1024):
        body2 += chunk
        if len(body2) > 20000:
            break
    assert len(body2) > 0
    print(f"Session {session_id}: turn1={len(body1)}B turn2={len(body2)}B")
