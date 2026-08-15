from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .data import TradesResponse, load_trades
from .pnl import PnlResponse, load_pnl
from .risk import RiskResponse, load_risk

app = FastAPI()


@app.exception_handler(ValueError)
def invalid_source_data(_: Request, error: ValueError):
    return JSONResponse(status_code=503, content={"detail": str(error)})


@app.get("/api/hello")
def hello():
    return {"status": "hello world"}


@app.get("/api/trades", response_model=TradesResponse)
def trades() -> TradesResponse:
    return load_trades()


@app.get("/api/pnl", response_model=PnlResponse)
def pnl() -> PnlResponse:
    return load_pnl()


@app.get("/api/risk", response_model=RiskResponse)
def risk() -> RiskResponse:
    return load_risk()
