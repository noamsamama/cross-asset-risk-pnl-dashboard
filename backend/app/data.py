from datetime import date
import math
from pathlib import Path
from typing import Literal

import pandas as pd
from pydantic import BaseModel


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
OPERATIONAL_DATA_DIRECTORY = REPOSITORY_ROOT / "data"
EXAMPLE_DATA_DIRECTORY = REPOSITORY_ROOT / "example_data"
REQUIRED_EXTRACTS = {
    "trades.csv",
    "market_data.csv",
    "risk_sensitivities.csv",
    "fx_rates.csv",
}
EXAMPLE_DATA_NOTICE = (
    "Synthetic test data for demonstration only. These are not real positions, "
    "market data, P&L or risk and must not be used for trading or control decisions."
)


def resolve_data_directory(
    operational_directory: Path = OPERATIONAL_DATA_DIRECTORY,
    example_directory: Path = EXAMPLE_DATA_DIRECTORY,
) -> tuple[Path, Literal["OPERATIONAL", "EXAMPLE"]]:
    if all((operational_directory / name).is_file() for name in REQUIRED_EXTRACTS):
        return operational_directory, "OPERATIONAL"
    missing_examples = sorted(
        name for name in REQUIRED_EXTRACTS if not (example_directory / name).is_file()
    )
    if missing_examples:
        raise FileNotFoundError(
            "Operational extracts are incomplete and example extracts are missing: "
            f"{missing_examples}"
        )
    return example_directory, "EXAMPLE"


DATA_DIRECTORY, DATA_SOURCE = resolve_data_directory()
TRADES_FILE = DATA_DIRECTORY / "trades.csv"
FX_FILE = DATA_DIRECTORY / "fx_rates.csv"

PRODUCT_ASSET_CLASS = {
    "IRS": "RATES",
    "GOVT_BOND": "RATES",
    "CORP_BOND": "CREDIT",
    "CDS": "CREDIT",
    "FX_SPOT": "FX",
    "FX_FORWARD": "FX",
    "FX_NDF": "FX",
    "EQ_OPTION": "EQUITY",
    "EQ_FUTURE": "EQUITY",
}
DIRECTION_SIGN = {"BUY": 1, "RECEIVE": 1, "SELL": -1, "PAY": -1}


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
    gross_notional_usd: float | None
    net_notional_usd: float | None
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
    data_source: Literal["OPERATIONAL", "EXAMPLE"]
    data_notice: str | None
    count: int
    issues: list[QualityIssue]
    fx_rates: list[FxRate]
    trades: list[Trade]


def _require_columns(frame: pd.DataFrame, required: set[str], dataset: str) -> None:
    missing = sorted(required - set(frame.columns))
    if missing:
        raise ValueError(f"Missing required {dataset} columns: {missing}")


def _numeric(frame: pd.DataFrame, columns: tuple[str, ...], dataset: str) -> None:
    for column in columns:
        frame[column] = pd.to_numeric(frame[column], errors="raise")
        if not frame[column].dropna().map(math.isfinite).all():
            raise ValueError(f"Non-finite {dataset} values found in {column}")


def load_fx_rates(path: Path = FX_FILE) -> tuple[date, pd.DataFrame, dict[str, float]]:
    frame = pd.read_csv(path)
    _require_columns(
        frame,
        {"date", "ccy_pair", "base_ccy", "quote_ccy", "spot_rate", "source"},
        "FX",
    )
    frame["date"] = pd.to_datetime(
        frame["date"], format="%Y-%m-%d", errors="raise"
    ).dt.date
    _numeric(frame, ("spot_rate",), "FX")
    if frame.empty:
        raise ValueError("FX extract is empty")
    if (frame["spot_rate"] <= 0).any():
        raise ValueError("FX spot rates must be positive")
    if (frame["ccy_pair"] != frame["base_ccy"] + frame["quote_ccy"]).any():
        raise ValueError("FX pair must equal base_ccy + quote_ccy")
    if frame.duplicated(["date", "ccy_pair"]).any():
        raise ValueError("Duplicate FX quotes found")

    as_of_date = max(frame["date"])
    latest = frame.loc[frame["date"] == as_of_date]
    usd_rates = {"USD": 1.0}
    for rate in latest.itertuples():
        if rate.base_ccy == "USD":
            currency, usd_rate = rate.quote_ccy, 1 / rate.spot_rate
        elif rate.quote_ccy == "USD":
            currency, usd_rate = rate.base_ccy, rate.spot_rate
        else:
            continue
        if currency in usd_rates:
            raise ValueError(f"Duplicate USD conversion rate for {currency}")
        usd_rates[currency] = usd_rate
    return as_of_date, frame, usd_rates


def load_trades(path: Path = TRADES_FILE, fx_path: Path = FX_FILE) -> TradesResponse:
    frame = pd.read_csv(path)
    source_fields = set(Trade.model_fields) - {
        "gross_notional_usd",
        "net_notional_usd",
    }
    _require_columns(frame, source_fields, "trade")

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
                severity="WARNING",
                code="DUPLICATE_TRADE_ID",
                count=len(duplicate_ids),
                entity_ids=duplicate_ids,
                message="Duplicate trade record found; one identical copy was removed.",
            )
        )
    frame = frame.drop_duplicates("trade_id", keep="first").copy()

    required_text = (
        "trade_id",
        "book_id",
        "trader_id",
        "asset_class",
        "product_type",
        "instrument_id",
        "instrument_description",
        "currency",
        "direction",
        "counterparty_id",
        "counterparty_name",
        "status",
    )
    empty_text = frame[list(required_text)].isna() | frame[list(required_text)].apply(
        lambda column: column.astype("string").str.strip().eq("")
    )
    if empty_text.any(axis=None):
        ids = frame.loc[empty_text.any(axis=1), "trade_id"].astype(str).tolist()
        raise ValueError(f"Blank required trade values: {ids}")
    if not frame["currency"].str.fullmatch(r"[A-Z]{3}").all():
        raise ValueError("Trade currencies must be three uppercase letters")

    _numeric(frame, ("notional", "quantity", "trade_price"), "trade")
    if (frame["notional"] < 0).any():
        ids = frame.loc[frame["notional"] < 0, "trade_id"].tolist()
        raise ValueError(f"Negative trade notionals: {ids}")
    if (frame["quantity"] == 0).any():
        ids = frame.loc[frame["quantity"] == 0, "trade_id"].tolist()
        raise ValueError(f"Zero trade quantities: {ids}")

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
        raise ValueError(
            f"Invalid trade dates: {frame.loc[invalid_mask, 'trade_id'].tolist()}"
        )
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
            raise ValueError(
                f"Invalid {column} values: "
                f"{frame.loc[invalid_mask, 'trade_id'].tolist()}"
            )
        frame[column] = parsed.dt.date

    as_of_date, fx, usd_rates = load_fx_rates(fx_path)
    future_ids = frame.loc[frame["trade_date"] > as_of_date, "trade_id"].tolist()
    if future_ids:
        raise ValueError(f"Trades booked after {as_of_date}: {future_ids}")
    invalid_maturity_ids = frame.loc[
        frame["maturity_date"] < frame["trade_date"], "trade_id"
    ].tolist()
    if invalid_maturity_ids:
        raise ValueError(f"Maturity before trade date: {invalid_maturity_ids}")

    missing_settlement_ids = frame.loc[frame["settle_date"].isna(), "trade_id"].tolist()
    if missing_settlement_ids:
        issues.append(
            QualityIssue(
                severity="WARNING",
                code="MISSING_SETTLEMENT_DATE",
                count=len(missing_settlement_ids),
                entity_ids=missing_settlement_ids,
                message="Trades have no settlement date.",
            )
        )

    matured_live_ids = frame.loc[
        (frame["status"].str.upper() == "LIVE")
        & (frame["maturity_date"] < as_of_date),
        "trade_id",
    ].tolist()
    if matured_live_ids:
        issues.append(
            QualityIssue(
                severity="WARNING",
                code="MATURED_LIVE_TRADE",
                count=len(matured_live_ids),
                entity_ids=matured_live_ids,
                message="Trades are marked LIVE after their maturity date.",
            )
        )

    signed_quantity_ids = frame.loc[frame["quantity"] < 0, "trade_id"].tolist()
    if signed_quantity_ids:
        issues.append(
            QualityIssue(
                severity="WARNING",
                code="SIGNED_QUANTITY_NORMALIZED",
                count=len(signed_quantity_ids),
                entity_ids=signed_quantity_ids,
                message="Signed quantities normalized; direction retained separately.",
            )
        )
        frame["quantity"] = frame["quantity"].abs()

    invalid_product_ids = frame.loc[
        frame["product_type"].map(PRODUCT_ASSET_CLASS) != frame["asset_class"],
        "trade_id",
    ].tolist()
    if invalid_product_ids:
        raise ValueError(f"Product/asset-class mismatches: {invalid_product_ids}")
    if not frame["direction"].isin(DIRECTION_SIGN).all():
        ids = frame.loc[~frame["direction"].isin(DIRECTION_SIGN), "trade_id"].tolist()
        raise ValueError(f"Invalid trade directions: {ids}")

    missing_currencies = sorted(set(frame["currency"]) - set(usd_rates))
    if missing_currencies:
        raise ValueError(f"Missing USD conversion rates: {missing_currencies}")
    frame["gross_notional_usd"] = frame["notional"] * frame["currency"].map(
        usd_rates
    )
    unavailable_notional = (frame["asset_class"] == "EQUITY") & (
        frame["notional"] == 0
    )
    invalid_zero_notional = (frame["asset_class"] != "EQUITY") & (
        frame["notional"] == 0
    )
    if invalid_zero_notional.any():
        ids = frame.loc[invalid_zero_notional, "trade_id"].tolist()
        raise ValueError(f"Zero notionals outside equity derivatives: {ids}")
    frame["net_notional_usd"] = frame["gross_notional_usd"] * frame[
        "direction"
    ].map(DIRECTION_SIGN)
    frame.loc[
        unavailable_notional, ["gross_notional_usd", "net_notional_usd"]
    ] = None

    records = frame.astype(object).where(pd.notna(frame), None).to_dict("records")
    trades = [Trade.model_validate(record) for record in records]
    latest_fx = fx.loc[fx["date"] == as_of_date]
    return TradesResponse(
        as_of_date=as_of_date,
        data_source=(
            "EXAMPLE"
            if path.resolve().parent == EXAMPLE_DATA_DIRECTORY.resolve()
            else "OPERATIONAL"
        ),
        data_notice=(
            EXAMPLE_DATA_NOTICE
            if path.resolve().parent == EXAMPLE_DATA_DIRECTORY.resolve()
            else None
        ),
        count=len(trades),
        issues=issues,
        fx_rates=[
            FxRate(ccy_pair=rate.ccy_pair, spot_rate=rate.spot_rate)
            for rate in latest_fx.sort_values("ccy_pair").itertuples()
        ],
        trades=trades,
    )
