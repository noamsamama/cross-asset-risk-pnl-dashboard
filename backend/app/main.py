from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .data import TradesResponse, load_trades, resolve_data_directory
from .pnl import PnlResponse, load_pnl
from .risk import RiskResponse, load_risk

app = FastAPI()
FRONTEND_DIRECTORY = Path(__file__).resolve().parents[2] / "frontend" / "dist"


def active_data_directory() -> Path:
    directory, _ = resolve_data_directory()
    return directory


@app.exception_handler(ValueError)
def invalid_source_data(_: Request, error: ValueError):
    return JSONResponse(status_code=503, content={"detail": str(error)})


@app.get("/api/hello")
def hello():
    return {"status": "hello world"}


@app.get("/api/trades", response_model=TradesResponse)
def trades() -> TradesResponse:
    directory = active_data_directory()
    return load_trades(directory / "trades.csv", directory / "fx_rates.csv")


@app.get("/api/pnl", response_model=PnlResponse)
def pnl() -> PnlResponse:
    directory = active_data_directory()
    return load_pnl(
        directory / "trades.csv",
        directory / "market_data.csv",
        directory / "risk_sensitivities.csv",
        directory / "fx_rates.csv",
    )


@app.get("/api/risk", response_model=RiskResponse)
def risk() -> RiskResponse:
    directory = active_data_directory()
    return load_risk(
        directory / "risk_sensitivities.csv",
        directory / "trades.csv",
        directory / "fx_rates.csv",
    )


if FRONTEND_DIRECTORY.is_dir():
    assets_directory = FRONTEND_DIRECTORY / "assets"
    if assets_directory.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_directory), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        if path.startswith("api/"):
            raise HTTPException(status_code=404)

        root = FRONTEND_DIRECTORY.resolve()
        requested = (root / path).resolve()
        if requested.is_relative_to(root) and requested.is_file():
            return FileResponse(requested)
        return FileResponse(root / "index.html")
