"""Pydantic domain models for LiquidityIQ (MongoDB documents)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, List, Optional, Any
from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, Field, ConfigDict, EmailStr


def _to_str_id(v: Any) -> Any:
    if isinstance(v, ObjectId):
        return str(v)
    return v


PyObjectId = Annotated[str, BeforeValidator(_to_str_id)]


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc: dict):
        if not doc:
            return None
        return cls(**doc)

    def to_mongo(self) -> dict:
        data = self.model_dump(by_alias=True, exclude_none=True)
        data.pop("_id", None)
        return data


# ---------------- Users ----------------
class User(BaseDocument):
    email: str
    password_hash: str
    name: str = "User"
    role: str = "user"
    created_at: str = Field(default_factory=utcnow_iso)


class RegisterInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = "User"


class LoginInput(BaseModel):
    email: EmailStr
    password: str


# ---------------- Companies ----------------
class Company(BaseDocument):
    name: str
    slug: str
    kind: str  # "private" | "public"
    ticker: Optional[str] = None
    exchange: Optional[str] = None  # NSE, BSE, NASDAQ, NYSE
    currency: str = "USD"
    sector: Optional[str] = None
    country: Optional[str] = None
    logo_bg: str = "#111111"
    created_at: str = Field(default_factory=utcnow_iso)


class BankAccount(BaseDocument):
    company_id: str
    name: str
    account_type: str  # operating, reserve, payroll
    currency: str = "USD"
    balance: float = 0.0


class ArApRecord(BaseDocument):
    company_id: str
    kind: str  # "AR" | "AP"
    counterparty: str
    amount: float
    currency: str = "USD"
    due_date: str
    status: str = "open"  # open | paid | overdue


class Transaction(BaseDocument):
    company_id: str
    date: str  # ISO date
    description: str
    category: str  # inflow category / outflow category
    direction: str  # "in" | "out"
    amount: float
    currency: str = "USD"
    balance_after: Optional[float] = None


# ---------------- Inputs ----------------
class CompanyInput(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    currency: str = "USD"
    sector: Optional[str] = "General"
    country: Optional[str] = "United States"
    opening_cash: float = Field(default=1_000_000, gt=0)
    logo_bg: str = "#1B4D3E"


class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    currency: Optional[str] = None
    sector: Optional[str] = None
    country: Optional[str] = None
    logo_bg: Optional[str] = None


class OnboardTickerInput(BaseModel):
    ticker: str = Field(min_length=1, max_length=24)
    opening_cash: Optional[float] = None


class ScenarioInput(BaseModel):
    revenue_shock_pct: float = 0.0
    cost_shock_pct: float = 0.0
    ar_delay_days: float = 0
    collection_rate_pct: float = 100.0
    ap_accelerate_days: float = 0
    capex_amount: float = 0.0
    capex_day: float = 30
    fx_shock_pct: float = 0.0
    credit_line: float = 0.0


class AlertRuleInput(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    metric: str
    op: str
    value: float
    severity: str = "warning"
    scope: str = "all"
    active: bool = True


class AlertRuleUpdate(BaseModel):
    name: Optional[str] = None
    metric: Optional[str] = None
    op: Optional[str] = None
    value: Optional[float] = None
    severity: Optional[str] = None
    scope: Optional[str] = None
    active: Optional[bool] = None


class WatchlistInput(BaseModel):
    symbol: str = Field(min_length=1, max_length=24)
    note: Optional[str] = None


class ChatInput(BaseModel):
    session_id: Optional[str] = None
    message: str = Field(min_length=1, max_length=4000)
    company_id: Optional[str] = None


class RoleUpdate(BaseModel):
    role: str

