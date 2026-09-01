"""DataInitializer: seed companies, bank accounts, AR/AP records and ledgers."""
import random
from datetime import datetime, timedelta, timezone

# Public listed enterprises (real tickers) + internal private entities
COMPANIES = [
    {"name": "Tata Motors Ltd", "slug": "tatamotors", "kind": "public",
     "ticker": "TMCV.NS", "exchange": "NSE", "currency": "INR",
     "sector": "Automobile", "country": "India", "logo_bg": "#1B4D3E", "base": 4_200_000_000},
    {"name": "Reliance Industries Ltd", "slug": "reliance", "kind": "public",
     "ticker": "RELIANCE.NS", "exchange": "NSE", "currency": "INR",
     "sector": "Conglomerate", "country": "India", "logo_bg": "#0A2540", "base": 9_800_000_000},
    {"name": "Infosys Ltd", "slug": "infosys", "kind": "public",
     "ticker": "INFY.NS", "exchange": "NSE", "currency": "INR",
     "sector": "IT Services", "country": "India", "logo_bg": "#12233A", "base": 3_100_000_000},
    {"name": "Apple Inc.", "slug": "apple", "kind": "public",
     "ticker": "AAPL", "exchange": "NASDAQ", "currency": "USD",
     "sector": "Technology", "country": "United States", "logo_bg": "#1A1A1A", "base": 6_500_000_000},
    {"name": "Microsoft Corp.", "slug": "microsoft", "kind": "public",
     "ticker": "MSFT", "exchange": "NASDAQ", "currency": "USD",
     "sector": "Technology", "country": "United States", "logo_bg": "#0E2A47", "base": 7_200_000_000},
    {"name": "HDFC Bank Ltd", "slug": "hdfcbank", "kind": "public",
     "ticker": "HDFCBANK.NS", "exchange": "NSE", "currency": "INR",
     "sector": "Banking", "country": "India", "logo_bg": "#13293D", "base": 5_400_000_000},
    # Internal private entities
    {"name": "Meridian Logistics Pvt", "slug": "meridian-logistics", "kind": "private",
     "currency": "USD", "sector": "Logistics", "country": "United States",
     "logo_bg": "#2A1A3E", "base": 2_400_000},
    {"name": "Northwind Manufacturing", "slug": "northwind-mfg", "kind": "private",
     "currency": "USD", "sector": "Manufacturing", "country": "United States",
     "logo_bg": "#3E2A1A", "base": 1_150_000},
    {"name": "Helios Renewables", "slug": "helios-renewables", "kind": "private",
     "currency": "EUR", "sector": "Energy", "country": "Germany",
     "logo_bg": "#1A3E2A", "base": 780_000},
]

INFLOW_CATS = ["Customer Payment", "Interest Income", "Asset Sale", "Investment Inflow"]
OUTFLOW_CATS = ["Payroll", "Supplier Payment", "Rent & Utilities", "Tax Payment", "Loan Repayment"]
COUNTERPARTIES = ["Globex Corp", "Initech", "Umbrella Retail", "Soylent Foods", "Stark Supplies",
                  "Wayne Freight", "Acme Traders", "Vertex Systems", "Nimbus Cloud", "Orion Metals"]


def _gen_transactions(company_id, base_balance, currency, seed):
    rng = random.Random(seed)
    txns = []
    today = datetime.now(timezone.utc).date()
    balance = base_balance
    # scale of a "daily" flow relative to base cash
    scale = base_balance * 0.012
    for i in range(120, 0, -1):
        d = today - timedelta(days=i)
        n_events = rng.randint(1, 3)
        for _ in range(n_events):
            is_in = rng.random() < 0.52
            amt = round(abs(rng.gauss(scale, scale * 0.55)) + scale * 0.15, 2)
            if is_in:
                cat = rng.choice(INFLOW_CATS)
                balance += amt
                direction = "in"
            else:
                cat = rng.choice(OUTFLOW_CATS)
                balance -= amt
                direction = "out"
            txns.append({
                "company_id": company_id,
                "date": d.isoformat(),
                "description": f"{cat} - {rng.choice(COUNTERPARTIES)}",
                "category": cat,
                "direction": direction,
                "amount": amt,
                "currency": currency,
                "balance_after": round(balance, 2),
            })
    # normalize so last balance ~ base_balance
    drift = base_balance - balance
    for t in txns:
        t["balance_after"] = round(t["balance_after"] + drift, 2)
    return txns, round(balance + drift, 2)


def _gen_bank_accounts(company_id, final_balance, currency, seed):
    rng = random.Random(seed + 7)
    splits = [("Operating Account", "operating", 0.55),
              ("Reserve Account", "reserve", 0.30),
              ("Payroll Account", "payroll", 0.15)]
    return [{
        "company_id": company_id,
        "name": name,
        "account_type": atype,
        "currency": currency,
        "balance": round(final_balance * pct, 2),
    } for name, atype, pct in splits]


def _gen_arap(company_id, base_balance, currency, seed):
    rng = random.Random(seed + 13)
    today = datetime.now(timezone.utc).date()
    recs = []
    for _ in range(rng.randint(4, 7)):
        recs.append({
            "company_id": company_id, "kind": "AR",
            "counterparty": rng.choice(COUNTERPARTIES),
            "amount": round(base_balance * rng.uniform(0.02, 0.09), 2),
            "currency": currency,
            "due_date": (today + timedelta(days=rng.randint(5, 85))).isoformat(),
            "status": rng.choice(["open", "open", "overdue"]),
        })
    for _ in range(rng.randint(4, 7)):
        recs.append({
            "company_id": company_id, "kind": "AP",
            "counterparty": rng.choice(COUNTERPARTIES),
            "amount": round(base_balance * rng.uniform(0.02, 0.10), 2),
            "currency": currency,
            "due_date": (today + timedelta(days=rng.randint(5, 85))).isoformat(),
            "status": rng.choice(["open", "open", "overdue"]),
        })
    return recs


def build_entity_financials(company_id, base_balance, currency, seed=0):
    """Generate a full 120-day financial profile for a newly onboarded entity."""
    txns, final_bal = _gen_transactions(company_id, base_balance, currency, seed=seed)
    banks = _gen_bank_accounts(company_id, final_bal, currency, seed=seed)
    arap = _gen_arap(company_id, base_balance, currency, seed=seed)
    return txns, banks, arap


async def seed_data(db, force=False):
    existing = await db.companies.count_documents({})
    if existing > 0 and not force:
        return {"seeded": False, "companies": existing}
    if force:
        await db.companies.delete_many({})
        await db.bank_accounts.delete_many({})
        await db.ar_ap.delete_many({})
        await db.transactions.delete_many({})

    for i, c in enumerate(COMPANIES):
        base = c.pop("base")
        doc = {**c, "created_at": datetime.now(timezone.utc).isoformat()}
        res = await db.companies.insert_one(doc)
        cid = str(res.inserted_id)
        txns, final_bal = _gen_transactions(cid, base, c["currency"], seed=i * 100)
        if txns:
            await db.transactions.insert_many(txns)
        await db.bank_accounts.insert_many(_gen_bank_accounts(cid, final_bal, c["currency"], seed=i * 100))
        await db.ar_ap.insert_many(_gen_arap(cid, base, c["currency"], seed=i * 100))

    return {"seeded": True, "companies": len(COMPANIES)}
