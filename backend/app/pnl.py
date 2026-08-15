from datetime import date
from functools import lru_cache
from pathlib import Path

import pandas as pd
from pydantic import BaseModel

from .data import (
    AS_OF_DATE,
    FX_FILE,
    TRADES_FILE,
    QualityIssue,
    load_trades,
)


MARKET_FILE = Path(__file__).resolve().parents[2] / "data" / "market_data.csv"
RISK_FILE = Path(__file__).resolve().parents[2] / "data" / "risk_sensitivities.csv"


class PnlByBook(BaseModel):
    book_id: str
    pnl_usd: float


class PnlHistoryPoint(BaseModel):
    date: date
    pnl_usd: float


class PnlCoverage(BaseModel):
    covered_trades: int
    total_trades: int


class PnlResponse(BaseModel):
    as_of_date: date
    methodology: str
    coverage: PnlCoverage
    issues: list[QualityIssue]
    by_book: list[PnlByBook]
    history: list[PnlHistoryPoint]


def _risk_value(risk: pd.DataFrame, trade_id: str, metric: str) -> float:
    value = risk.loc[trade_id, metric]
    if pd.isna(value):
        raise KeyError(metric)
    return float(value)


def _equity_underlying(instrument_id: str) -> str:
    prefix = instrument_id.split("-", 1)[0]
    return {
        "HSI": "HSI-INDEX",
        "KOSPI200": "KOSPI200-INDEX",
        "NKY": "NKY-INDEX",
    }[prefix]


@lru_cache(maxsize=1)
def load_pnl(
    trades_path: Path = TRADES_FILE,
    market_path: Path = MARKET_FILE,
    risk_path: Path = RISK_FILE,
    fx_path: Path = FX_FILE,
) -> PnlResponse:
    trades_response = load_trades(trades_path, fx_path)
    trades = pd.DataFrame(
        [trade.model_dump(mode="json") for trade in trades_response.trades]
    )
    market = pd.read_csv(market_path)
    risk_raw = pd.read_csv(risk_path)
    fx = pd.read_csv(fx_path)

    market["date"] = pd.to_datetime(market["date"], format="%Y-%m-%d")
    market["last_update_utc"] = pd.to_datetime(
        market["last_update_utc"], utc=True, errors="raise"
    )
    fx["date"] = pd.to_datetime(fx["date"], format="%Y-%m-%d")
    if market.duplicated(["date", "instrument_id"]).any():
        raise ValueError("Duplicate market quotes found")
    if fx.duplicated(["date", "ccy_pair"]).any():
        raise ValueError("Duplicate FX quotes found")
    if risk_raw.duplicated(["trade_id", "risk_metric"]).any():
        raise ValueError("Duplicate trade risk metrics found")

    stale_market_mask = (
        market["last_update_utc"].dt.date != market["date"].dt.date
    )
    stale_instruments = set(market.loc[stale_market_mask, "instrument_id"])
    stale_trade_ids = sorted(
        trades.loc[trades["instrument_id"].isin(stale_instruments), "trade_id"].tolist()
    )
    market = market.loc[~stale_market_mask].copy()

    risk = risk_raw.pivot(
        index="trade_id", columns="risk_metric", values="value_usd"
    )
    market_by_instrument = {
        instrument_id: quotes.set_index("date").sort_index()
        for instrument_id, quotes in market.groupby("instrument_id")
    }
    fx_by_pair = {
        ccy_pair: quotes.set_index("date").sort_index()
        for ccy_pair, quotes in fx.groupby("ccy_pair")
    }

    contributions: list[pd.DataFrame] = []
    missing_trade_ids: list[str] = []
    as_of_timestamp = pd.Timestamp(AS_OF_DATE)

    for trade in trades.itertuples():
        try:
            if trade.product_type in {"IRS", "GOVT_BOND"}:
                quotes = market_by_instrument[trade.instrument_id]
                move_bps = quotes["yield_pct"].diff() * 100
                pnl = -_risk_value(risk, trade.trade_id, "DV01") * move_bps
            elif trade.product_type == "CORP_BOND":
                quotes = market_by_instrument[trade.instrument_id]
                spread_move = quotes["spread_bps"].diff()
                rate_move = quotes["yield_pct"].diff() * 100 - spread_move
                pnl = (
                    -_risk_value(risk, trade.trade_id, "DV01") * rate_move
                    - _risk_value(risk, trade.trade_id, "Spread01") * spread_move
                )
            elif trade.product_type == "CDS":
                quotes = market_by_instrument[trade.instrument_id]
                pnl = _risk_value(risk, trade.trade_id, "CS01_USD") * quotes[
                    "spread_bps"
                ].diff()
            elif trade.asset_class == "FX":
                quotes = fx_by_pair[trade.instrument_id]
                pnl = _risk_value(risk, trade.trade_id, "Delta_USD") * quotes[
                    "spot_rate"
                ].pct_change(fill_method=None)
            elif trade.product_type == "EQ_FUTURE":
                quotes = market_by_instrument[trade.instrument_id]
                pnl = _risk_value(risk, trade.trade_id, "Delta_USD") * quotes[
                    "price"
                ].pct_change(fill_method=None)
            elif trade.product_type == "EQ_OPTION":
                option_quotes = market_by_instrument[trade.instrument_id]
                underlying_quotes = market_by_instrument[
                    _equity_underlying(trade.instrument_id)
                ]
                quotes = pd.concat(
                    [
                        underlying_quotes["price"].rename("underlying"),
                        option_quotes["implied_vol_pct"].rename("volatility"),
                    ],
                    axis=1,
                ).dropna()
                return_fraction = quotes["underlying"].pct_change(fill_method=None)
                return_pct_points = return_fraction * 100
                calendar_days = quotes.index.to_series().diff().dt.days
                pnl = (
                    _risk_value(risk, trade.trade_id, "Delta_USD")
                    * return_fraction
                    + 0.5
                    * _risk_value(risk, trade.trade_id, "Gamma_USD")
                    * return_pct_points.pow(2)
                    + _risk_value(risk, trade.trade_id, "Vega_USD")
                    * quotes["volatility"].diff()
                    + _risk_value(risk, trade.trade_id, "Theta_USD")
                    * calendar_days
                )
            else:
                raise KeyError(trade.product_type)
        except KeyError:
            missing_trade_ids.append(trade.trade_id)
            continue

        pnl = pnl.loc[pnl.index > pd.Timestamp(trade.trade_date)].dropna()
        if as_of_timestamp not in pnl.index:
            missing_trade_ids.append(trade.trade_id)
            continue
        contributions.append(
            pd.DataFrame(
                {
                    "date": pnl.index,
                    "trade_id": trade.trade_id,
                    "book_id": trade.book_id,
                    "pnl_usd": pnl.values,
                }
            )
        )

    if not contributions:
        raise ValueError("No trades have sufficient data for P&L")

    pnl = pd.concat(contributions, ignore_index=True)
    latest = pnl.loc[pnl["date"] == as_of_timestamp]
    by_book = (
        latest.groupby("book_id", as_index=False)["pnl_usd"].sum().sort_values("book_id")
    )
    history = pnl.groupby("date", as_index=False)["pnl_usd"].sum().sort_values("date")

    issues: list[QualityIssue] = []
    if stale_trade_ids:
        issues.append(
            QualityIssue(
                severity="WARNING",
                code="STALE_MARKET_QUOTE",
                count=len(stale_trade_ids),
                entity_ids=stale_trade_ids,
                message="Trades with stale market timestamps were excluded from P&L.",
            )
        )

    missing_trade_ids = sorted(set(missing_trade_ids))
    if missing_trade_ids:
        issues.append(
            QualityIssue(
                severity="WARNING",
                code="INCOMPLETE_PNL_COVERAGE",
                count=len(missing_trade_ids),
                entity_ids=missing_trade_ids,
                message="Trades without sufficient market or sensitivity data were excluded.",
            )
        )

    return PnlResponse(
        as_of_date=AS_OF_DATE,
        methodology=(
            "Current USD sensitivities applied to daily market moves; options include "
            "delta, gamma, vega and calendar-day theta. Trades enter the history "
            "after their trade date."
        ),
        coverage=PnlCoverage(
            covered_trades=trades_response.count - len(missing_trade_ids),
            total_trades=trades_response.count,
        ),
        issues=issues,
        by_book=[PnlByBook.model_validate(row) for row in by_book.to_dict("records")],
        history=[
            PnlHistoryPoint(date=row.date.date(), pnl_usd=row.pnl_usd)
            for row in history.itertuples()
        ],
    )
