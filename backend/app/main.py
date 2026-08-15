from fastapi import FastAPI

from .data import TradesResponse, load_trades

app = FastAPI()


@app.get("/api/hello")
def hello():
    return {"status": "hello world"}


@app.get("/api/trades", response_model=TradesResponse)
def trades() -> TradesResponse:
    return load_trades()
