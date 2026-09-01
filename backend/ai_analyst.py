"""AI Liquidity Analyst (Mock for College Presentation)"""
import os
import json
import asyncio

MODEL = "mock-analyst"

def brief_prompt(ctx: dict) -> str:
    return ""

async def generate_brief(ctx: dict, session_id: str) -> str:
    await asyncio.sleep(1) # simulate thinking
    return """### Verdict
Liquidity is generally safe across the portfolio, but there are some short-term tightening signals in subsidiary accounts.

### What the forecast says
- The 90-day cash path remains stable with a projected low point at day 45.
- Operating cash flows will easily cover obligations.
- Receivables are currently coming in faster than payables are going out.

### Working capital
- AR/AP aging is healthy, with DSO tracking well below industry benchmarks.
- No single client accounts for more than 15% of the upcoming receivables, indicating low concentration risk.

### Recommended actions
1. Draw $5M from the revolver on day 40 as a buffer against the projected day 45 trough.
2. Accelerate collections for invoices over 60 days past due.
3. Consider parking excess surplus in short-term T-bills for yield."""

def build_chat_input(portfolio_ctx: dict, history: list, question: str) -> str:
    return ""

async def stream_answer(session_id: str, portfolio_ctx: dict, history: list, question: str):
    response = "Based on my analysis of your current liquidity position, your 90-day forecast looks stable. The Random Forest model indicates low risk, and your AR/AP aging shows strong working capital management. I recommend moving excess cash into short-term investments to maximize yield."
    
    for word in response.split(" "):
        await asyncio.sleep(0.05) # simulate typing
        yield word + " "
