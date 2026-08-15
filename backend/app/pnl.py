from datetime import date
from pathlib import Path

import pandas as pd
from pydantic import BaseModel

from .data import (
    FX_FILE,
    TRADES_FILE,
    QualityIssue,
    _numeric,
    _require_columns,
    load_fx_rates,
    load_trades,
)
from .risk import RISK_FILE, load_risk_frame


MARKET_FILE = Path(__file__).resolve().parents[2] / "data" / "market_data.csv"


class PnlByBook(BaseModel):
    book_id: str
    pnl_usd: float


class PnlHistoryPoint(BaseModel):
    date: date
    pnl_usd: float
    covered_trades: int


class PnlContribution(BaseModel):
    date: date
    trade_id: str
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
    contributions: list[PnlContribution]


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


def _load_market(
    path: Path, as_of_date: date
) -> tuple[pd.DataFrame, set[str]]:
    frame = pd.read_csv(path)
    _require_columns(
        frame,
        {
            "date",
            "instrument_id",
            "instrument_description",
            "asset_class",
            "price",
            "yield_pct",
            "spread_bps",
            "implied_vol_pct",
            "px_bid",
            "px_ask",
            "px_mid",
            "price_type",
            "source",
            "last_update_utc",
        },
        "market",
    )
    if frame.empty:
        raise ValueError("Market extract is empty")
    frame["date"] = pd.to_datetime(
        frame["date"], format="%Y-%m-%d", errors="raise"
    )
    frame["last_update_utc"] = pd.to_datetime(
        frame["last_update_utc"], utc=True, errors="raise"
    )
    if frame.duplicated(["date", "instrument_id"]).any():
        raise ValueError("Duplicate market quotes found")
    if (frame["date"].dt.date > as_of_date).any():
        raise ValueError(f"Market data contains dates after {as_of_date}")
    _numeric(
        frame,
        (
            "price",
            "yield_pct",
            "spread_bps",
            "implied_vol_pct",
            "px_bid",
            "px_ask",
            "px_mid",
        ),
        "market",
    )
    complete_quotes = frame[["px_bid", "px_mid", "px_ask"]].notna().all(axis=1)
    invalid_quotes = complete_quotes & ~(
        (frame["px_bid"] <= frame["px_mid"])
        & (frame["px_mid"] <= frame["px_ask"])
    )
    if invalid_quotes.any():
        instruments = sorted(frame.loc[invalid_quotes, "instrument_id"].unique())
        raise ValueError(f"Invalid bid/mid/ask quotes: {instruments}")

    stale_mask = frame["last_update_utc"].dt.date != frame["date"].dt.date
    stale_as_of_instruments = set(
        frame.loc[
            stale_mask & (frame["date"].dt.date == as_of_date), "instrument_id"
        ]
    )
    return frame.loc[~stale_mask].copy(), stale_as_of_instruments


def _market_dependencies(trade) -> set[str]:
    if trade.asset_class == "FX":
        return set()
    if trade.product_type == "EQ_OPTION":
        return {trade.instrument_id, _equity_underlying(trade.instrument_id)}
    return {trade.instrument_id}


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
    market, stale_as_of_instruments = _load_market(
        market_path, trades_response.as_of_date
    )
    risk_raw, missing_metrics = load_risk_frame(
        risk_path, trades_response, fx_path
    )
    fx_as_of, fx, _ = load_fx_rates(fx_path)
    if fx_as_of != trades_response.as_of_date:
        raise ValueError("Trade and FX as-of dates do not match")
    fx["date"] = pd.to_datetime(fx["date"])

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
    missing_as_of_ids: set[str] = set()
    as_of_timestamp = pd.Timestamp(trades_response.as_of_date)

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
            missing_as_of_ids.add(trade.trade_id)
            continue

        pnl = pnl.loc[pnl.index > pd.Timestamp(trade.trade_date)].dropna()
        if pnl.empty:
            missing_as_of_ids.add(trade.trade_id)
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
        if as_of_timestamp not in pnl.index:
            missing_as_of_ids.add(trade.trade_id)

    if not contributions:
        raise ValueError("No trades have sufficient data for explained P&L")

    pnl = pd.concat(contributions, ignore_index=True)
    latest = pnl.loc[pnl["date"] == as_of_timestamp]
    if latest.empty:
        raise ValueError("No trades have as-of explained P&L")
    by_book = (
        latest.groupby("book_id", as_index=False)["pnl_usd"].sum().sort_values("book_id")
    )
    history = (
        pnl.groupby("date", as_index=False)
        .agg(pnl_usd=("pnl_usd", "sum"), covered_trades=("trade_id", "nunique"))
        .sort_values("date")
    )

    trade_models = {trade.trade_id: trade for trade in trades_response.trades}
    stale_trade_ids = sorted(
        trade_id
        for trade_id, trade in trade_models.items()
        if _market_dependencies(trade) & stale_as_of_instruments
    )
    incomplete_risk_ids = sorted(set(missing_metrics) & missing_as_of_ids)
    insufficient_ids = sorted(
        missing_as_of_ids - set(stale_trade_ids) - set(incomplete_risk_ids)
    )
    issues: list[QualityIssue] = []
    if stale_trade_ids:
        issues.append(
            QualityIssue(
                severity="ERROR",
                code="STALE_MARKET_QUOTE",
                count=len(stale_trade_ids),
                entity_ids=stale_trade_ids,
                message="Trades were excluded from as-of P&L by stale market quotes.",
            )
        )
    if incomplete_risk_ids:
        issues.append(
            QualityIssue(
                severity="ERROR",
                code="INCOMPLETE_PNL_RISK",
                count=len(incomplete_risk_ids),
                entity_ids=incomplete_risk_ids,
                message="Trades were excluded from P&L by missing required risk metrics.",
            )
        )
    if insufficient_ids:
        issues.append(
            QualityIssue(
                severity="ERROR",
                code="INCOMPLETE_PNL_COVERAGE",
                count=len(insufficient_ids),
                entity_ids=insufficient_ids,
                message="Trades were excluded from as-of P&L by missing market data.",
            )
        )

    covered_ids = set(latest["trade_id"])
    return PnlResponse(
        as_of_date=trades_response.as_of_date,
        methodology=(
            "Explained P&L using current USD sensitivities and daily market moves; "
            "options include delta, gamma, vega and calendar-day theta. History "
            "retains each valid daily contribution and reports daily coverage."
        ),
        coverage=PnlCoverage(
            covered_trades=len(covered_ids),
            total_trades=trades_response.count,
        ),
        issues=issues,
        by_book=[PnlByBook.model_validate(row) for row in by_book.to_dict("records")],
        history=[
            PnlHistoryPoint(
                date=row.date.date(),
                pnl_usd=row.pnl_usd,
                covered_trades=row.covered_trades,
            )
            for row in history.itertuples()
        ],
        contributions=[
            PnlContribution(
                date=row.date.date(),
                trade_id=row.trade_id,
                pnl_usd=row.pnl_usd,
            )
            for row in pnl.itertuples()
        ],
    )
