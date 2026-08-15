from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Literal

import pandas as pd
from pydantic import BaseModel


TRADES_FILE = Path(__file__).resolve().parents[2] / "data" / "trades.csv"
FX_FILE = Path(__file__).resolve().parents[2] / "data" / "fx_rates.csv"
AS_OF_DATE = date(2026, 8, 5)


class QualityIssue(BaseModel):
    severity: Literal["ERROR", "WARNING"]
    code: str
    count: int
    entity_ids: list[str]
    message: str


class Trade(BaseModel):
    trade_id: str
    book_id: str
    trader_id: str
    trade_date: date
    settle_date: date | None
    asset_class: Literal["RATES", "CREDIT", "FX", "EQUITY"]
    product_type: Literal[
        "IRS",
        "GOVT_BOND",
        "CORP_BOND",
        "CDS",
        "FX_SPOT",
        "FX_FORWARD",
        "FX_NDF",
        "EQ_OPTION",
        "EQ_FUTURE",
    ]
    instrument_id: str
    instrument_description: str
    currency: str
    notional: float
    gross_notional_usd: float
    quantity: float
    trade_price: float
    direction: Literal["BUY", "SELL", "PAY", "RECEIVE"]
    counterparty_id: str
    counterparty_name: str
    status: str
    maturity_date: date
    bloomberg_id: str | None
    internal_ref: str | None


class FxRate(BaseModel):
    ccy_pair: str
    spot_rate: float


class TradesResponse(BaseModel):
    as_of_date: date
    count: int
    issues: list[QualityIssue]
    fx_rates: list[FxRate]
    trades: list[Trade]


@lru_cache(maxsize=1)
def load_trades(path: Path = TRADES_FILE, fx_path: Path = FX_FILE) -> TradesResponse:
    frame = pd.read_csv(path)
    source_fields = set(Trade.model_fields) - {"gross_notional_usd"}
    missing_columns = sorted(source_fields - set(frame.columns))
    if missing_columns:
        raise ValueError(f"Missing required trade columns: {missing_columns}")

    issues: list[QualityIssue] = []
    duplicate_mask = frame.duplicated("trade_id", keep=False)
    duplicate_ids = sorted(frame.loc[duplicate_mask, "trade_id"].unique().tolist())
    conflicting_ids = [
        trade_id
        for trade_id in duplicate_ids
        if len(frame.loc[frame["trade_id"] == trade_id].drop_duplicates()) > 1
    ]
    if conflicting_ids:
        raise ValueError(f"Conflicting duplicate trades: {conflicting_ids}")
    if duplicate_ids:
        issues.append(
            QualityIssue(
                severity="ERROR",
                code="DUPLICATE_TRADE_ID",
                count=len(duplicate_ids),
                entity_ids=duplicate_ids,
                message="Exact duplicate rows found; first row retained.",
            )
        )

    frame = frame.drop_duplicates("trade_id", keep="first").copy()
    raw_trade_dates = frame["trade_date"].astype("string")
    iso_trade_dates = pd.to_datetime(
        raw_trade_dates, format="%Y-%m-%d", errors="coerce"
    )
    us_trade_dates = pd.to_datetime(
        raw_trade_dates, format="%m/%d/%Y", errors="coerce"
    )
    fallback_mask = iso_trade_dates.isna() & us_trade_dates.notna()
    invalid_mask = iso_trade_dates.isna() & us_trade_dates.isna()
    if invalid_mask.any():
        invalid_ids = frame.loc[invalid_mask, "trade_id"].tolist()
        raise ValueError(f"Invalid trade dates: {invalid_ids}")
    if fallback_mask.any():
        issues.append(
            QualityIssue(
                severity="WARNING",
                code="NON_ISO_TRADE_DATE",
                count=int(fallback_mask.sum()),
                entity_ids=frame.loc[fallback_mask, "trade_id"].tolist(),
                message="US-formatted trade dates normalized to ISO dates.",
            )
        )
    frame["trade_date"] = iso_trade_dates.fillna(us_trade_dates).dt.date

    for column in ("settle_date", "maturity_date"):
        parsed = pd.to_datetime(frame[column], format="%Y-%m-%d", errors="coerce")
        invalid_mask = frame[column].notna() & parsed.isna()
        if invalid_mask.any():
            invalid_ids = frame.loc[invalid_mask, "trade_id"].tolist()
            raise ValueError(f"Invalid {column} values: {invalid_ids}")
        frame[column] = parsed.dt.date

    fx = pd.read_csv(fx_path)
    fx["date"] = pd.to_datetime(fx["date"], format="%Y-%m-%d").dt.date
    fx = fx.loc[fx["date"] == AS_OF_DATE]
    if fx.empty:
        raise ValueError(f"No FX rates found for {AS_OF_DATE}")
    if fx["ccy_pair"].duplicated().any():
        raise ValueError("Duplicate FX pairs found for the as-of date")

    usd_rates = {"USD": 1.0}
    for rate in fx.itertuples():
        if rate.spot_rate <= 0:
            raise ValueError(f"Invalid FX rate for {rate.ccy_pair}")
        if rate.base_ccy == "USD":
            usd_rates[rate.quote_ccy] = 1 / rate.spot_rate
        elif rate.quote_ccy == "USD":
            usd_rates[rate.base_ccy] = rate.spot_rate

    missing_currencies = sorted(set(frame["currency"]) - set(usd_rates))
    if missing_currencies:
        raise ValueError(f"Missing USD conversion rates: {missing_currencies}")
    frame["gross_notional_usd"] = (
        frame["notional"].abs() * frame["currency"].map(usd_rates)
    )

    records = frame.astype(object).where(pd.notna(frame), None).to_dict("records")
    trades = [Trade.model_validate(record) for record in records]
    return TradesResponse(
        as_of_date=AS_OF_DATE,
        count=len(trades),
        issues=issues,
        fx_rates=[
            FxRate(ccy_pair=rate.ccy_pair, spot_rate=rate.spot_rate)
            for rate in fx.sort_values("ccy_pair").itertuples()
        ],
        trades=trades,
    )
