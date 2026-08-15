from datetime import date, datetime
from functools import lru_cache
import math
from pathlib import Path

import pandas as pd
from pydantic import BaseModel

from .data import AS_OF_DATE, TRADES_FILE, QualityIssue, load_trades


RISK_FILE = Path(__file__).resolve().parents[2] / "data" / "risk_sensitivities.csv"
METRIC_UNITS = {
    "DV01": "USD/bp",
    "Duration": "years",
    "Spread01": "USD/bp",
    "CS01_USD": "USD/bp",
    "JTD_USD": "USD",
    "Delta_USD": "USD",
    "Gamma_USD": "USD",
    "Vega_USD": "USD/vol point",
    "Theta_USD": "USD/day",
}


class RiskMetricSummary(BaseModel):
    risk_metric: str
    display_unit: str
    net_value: float
    gross_value: float
    trade_count: int


class RiskByBook(RiskMetricSummary):
    book_id: str


class RiskSensitivity(BaseModel):
    trade_id: str
    book_id: str
    asset_class: str
    product_type: str
    instrument_id: str
    instrument_description: str
    risk_metric: str
    value_usd: float
    display_unit: str


class RiskResponse(BaseModel):
    as_of_date: date
    computed_at: datetime
    sensitivity_count: int
    trade_count: int
    issues: list[QualityIssue]
    by_metric: list[RiskMetricSummary]
    by_book: list[RiskByBook]
    sensitivities: list[RiskSensitivity]


@lru_cache(maxsize=1)
def load_risk(
    risk_path: Path = RISK_FILE,
    trades_path: Path = TRADES_FILE,
) -> RiskResponse:
    frame = pd.read_csv(risk_path)
    required = {
        "as_of_date",
        "trade_id",
        "book_id",
        "instrument_id",
        "risk_metric",
        "value_usd",
        "computation_timestamp",
    }
    missing_columns = sorted(required - set(frame.columns))
    if missing_columns:
        raise ValueError(f"Missing required risk columns: {missing_columns}")
    if frame.duplicated(["trade_id", "risk_metric"]).any():
        raise ValueError("Duplicate trade risk metrics found")

    frame["as_of_date"] = pd.to_datetime(
        frame["as_of_date"], format="%Y-%m-%d", errors="raise"
    ).dt.date
    if set(frame["as_of_date"]) != {AS_OF_DATE}:
        raise ValueError(f"Risk data is not entirely as of {AS_OF_DATE}")

    frame["computation_timestamp"] = pd.to_datetime(
        frame["computation_timestamp"], utc=True, errors="raise"
    )
    frame["value_usd"] = pd.to_numeric(frame["value_usd"], errors="raise")
    if not frame["value_usd"].map(math.isfinite).all():
        raise ValueError("Non-finite USD risk values found")

    unknown_metrics = sorted(set(frame["risk_metric"]) - set(METRIC_UNITS))
    if unknown_metrics:
        raise ValueError(f"Unknown risk metrics: {unknown_metrics}")

    trades_response = load_trades(trades_path)
    trades = {trade.trade_id: trade for trade in trades_response.trades}
    missing_trades = sorted(set(frame["trade_id"]) - set(trades))
    if missing_trades:
        raise ValueError(f"Risk rows reference unknown trades: {missing_trades}")
    mismatched_trades = sorted(
        row.trade_id
        for row in frame.itertuples()
        if (trades[row.trade_id].book_id, trades[row.trade_id].instrument_id)
        != (row.book_id, row.instrument_id)
    )
    if mismatched_trades:
        raise ValueError(f"Risk/trade ownership mismatches: {mismatched_trades}")

    metric_order = [metric for metric in METRIC_UNITS if metric in set(frame.risk_metric)]
    metric_groups = frame.groupby("risk_metric", sort=False)
    by_metric = [
        RiskMetricSummary(
            risk_metric=metric,
            display_unit=METRIC_UNITS[metric],
            net_value=metric_groups.get_group(metric)["value_usd"].sum(),
            gross_value=metric_groups.get_group(metric)["value_usd"].abs().sum(),
            trade_count=metric_groups.get_group(metric)["trade_id"].nunique(),
        )
        for metric in metric_order
    ]

    book_groups = frame.groupby(["book_id", "risk_metric"])
    by_book: list[RiskByBook] = []
    for metric in metric_order:
        for book_id in sorted({trade.book_id for trade in trades_response.trades}):
            key = (book_id, metric)
            group = book_groups.get_group(key) if key in book_groups.groups else None
            by_book.append(
                RiskByBook(
                    book_id=book_id,
                    risk_metric=metric,
                    display_unit=METRIC_UNITS[metric],
                    net_value=0 if group is None else group["value_usd"].sum(),
                    gross_value=0 if group is None else group["value_usd"].abs().sum(),
                    trade_count=0 if group is None else group["trade_id"].nunique(),
                )
            )

    sensitivities = [
        RiskSensitivity(
            trade_id=row.trade_id,
            book_id=row.book_id,
            asset_class=trades[row.trade_id].asset_class,
            product_type=trades[row.trade_id].product_type,
            instrument_id=row.instrument_id,
            instrument_description=trades[row.trade_id].instrument_description,
            risk_metric=row.risk_metric,
            value_usd=row.value_usd,
            display_unit=METRIC_UNITS[row.risk_metric],
        )
        for row in frame.sort_values(["book_id", "trade_id", "risk_metric"]).itertuples()
    ]

    return RiskResponse(
        as_of_date=AS_OF_DATE,
        computed_at=frame["computation_timestamp"].max().to_pydatetime(),
        sensitivity_count=len(frame),
        trade_count=frame["trade_id"].nunique(),
        issues=trades_response.issues,
        by_metric=by_metric,
        by_book=by_book,
        sensitivities=sensitivities,
    )
