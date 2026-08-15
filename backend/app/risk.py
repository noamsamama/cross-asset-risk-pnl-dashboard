from datetime import date, datetime
import math
from pathlib import Path
from typing import Literal

import pandas as pd
from pydantic import BaseModel

from .data import (
    FX_FILE,
    TRADES_FILE,
    QualityIssue,
    TradesResponse,
    load_fx_rates,
    load_trades,
)


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
SOURCE_UNITS = {
    "DV01": "amount",
    "Duration": "years",
    "Spread01": "amount",
    "CS01_USD": "amount_usd",
    "JTD_USD": "amount_usd",
    "Delta_USD": "amount_usd",
    "Gamma_USD": "amount_usd",
    "Vega_USD": "amount_usd",
    "Theta_USD": "amount_usd",
}
REQUIRED_METRICS = {
    "IRS": {"DV01", "Duration"},
    "GOVT_BOND": {"DV01", "Duration"},
    "CORP_BOND": {"DV01", "Spread01", "JTD_USD"},
    "CDS": {"CS01_USD", "JTD_USD"},
    "FX_SPOT": {"Delta_USD"},
    "FX_FORWARD": {"Delta_USD"},
    "FX_NDF": {"Delta_USD"},
    "EQ_FUTURE": {"Delta_USD"},
    "EQ_OPTION": {"Delta_USD", "Gamma_USD", "Vega_USD", "Theta_USD"},
}
ADDITIVE_METRICS = set(METRIC_UNITS) - {"Duration"}


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
    trader_id: str
    asset_class: str
    product_type: str
    instrument_id: str
    instrument_description: str
    currency: str
    risk_metric: str
    value_usd: float
    display_unit: str


class RiskReconciliation(BaseModel):
    status: Literal["PASS", "WARNING"]
    all_sensitivities_mapped: bool
    metric_totals_match_grid: bool
    book_totals_match_desk: bool
    uncovered_trade_ids: list[str]


class RiskResponse(BaseModel):
    as_of_date: date
    computed_at: datetime
    sensitivity_count: int
    trade_count: int
    covered_trade_count: int
    total_trade_count: int
    issues: list[QualityIssue]
    by_metric: list[RiskMetricSummary]
    by_book: list[RiskByBook]
    sensitivities: list[RiskSensitivity]
    reconciliation: RiskReconciliation


def load_risk_frame(
    risk_path: Path, trades_response: TradesResponse, fx_path: Path = FX_FILE
) -> tuple[pd.DataFrame, dict[str, list[str]]]:
    frame = pd.read_csv(risk_path)
    required = {
        "as_of_date",
        "trade_id",
        "book_id",
        "instrument_id",
        "risk_metric",
        "value",
        "ccy",
        "value_usd",
        "unit",
        "computation_timestamp",
    }
    missing_columns = sorted(required - set(frame.columns))
    if missing_columns:
        raise ValueError(f"Missing required risk columns: {missing_columns}")
    if frame.empty:
        raise ValueError("Risk extract is empty")
    if frame.duplicated(["trade_id", "risk_metric"]).any():
        raise ValueError("Duplicate trade risk metrics found")

    frame["as_of_date"] = pd.to_datetime(
        frame["as_of_date"], format="%Y-%m-%d", errors="raise"
    ).dt.date
    if set(frame["as_of_date"]) != {trades_response.as_of_date}:
        raise ValueError(
            f"Risk data is not entirely as of {trades_response.as_of_date}"
        )
    frame["computation_timestamp"] = pd.to_datetime(
        frame["computation_timestamp"], utc=True, errors="raise"
    )
    if set(frame["computation_timestamp"].dt.date) != {trades_response.as_of_date}:
        raise ValueError("Risk computation timestamps do not match the as-of date")
    for column in ("value", "value_usd"):
        frame[column] = pd.to_numeric(frame[column], errors="raise")
        if not frame[column].map(math.isfinite).all():
            raise ValueError(f"Non-finite risk values found in {column}")

    unknown_metrics = sorted(set(frame["risk_metric"]) - set(METRIC_UNITS))
    if unknown_metrics:
        raise ValueError(f"Unknown risk metrics: {unknown_metrics}")
    invalid_units = frame.loc[
        frame["unit"] != frame["risk_metric"].map(SOURCE_UNITS), "trade_id"
    ].unique()
    if len(invalid_units):
        raise ValueError(f"Invalid risk units: {sorted(invalid_units)}")

    trades = {trade.trade_id: trade for trade in trades_response.trades}
    unknown_trade_ids = sorted(set(frame["trade_id"]) - set(trades))
    if unknown_trade_ids:
        raise ValueError(f"Risk rows reference unknown trades: {unknown_trade_ids}")
    mismatched_trades = sorted(
        {
            row.trade_id
            for row in frame.itertuples()
            if (trades[row.trade_id].book_id, trades[row.trade_id].instrument_id)
            != (row.book_id, row.instrument_id)
        }
    )
    if mismatched_trades:
        raise ValueError(f"Risk/trade ownership mismatches: {mismatched_trades}")

    fx_as_of, _, usd_rates = load_fx_rates(fx_path)
    if fx_as_of != trades_response.as_of_date:
        raise ValueError("Risk and FX as-of dates do not match")
    conversion_errors: set[str] = set()
    for row in frame.itertuples():
        if row.unit in {"amount_usd", "years"}:
            expected = row.value
        elif row.ccy in usd_rates:
            expected = row.value * usd_rates[row.ccy]
        else:
            conversion_errors.add(row.trade_id)
            continue
        if not math.isclose(expected, row.value_usd, rel_tol=1e-6, abs_tol=0.01):
            conversion_errors.add(row.trade_id)
    if conversion_errors:
        raise ValueError(
            f"Risk native/USD value mismatches: {sorted(conversion_errors)}"
        )

    metrics_by_trade = frame.groupby("trade_id")["risk_metric"].agg(set).to_dict()
    missing_metrics: dict[str, list[str]] = {}
    unexpected_metrics: dict[str, list[str]] = {}
    for trade in trades_response.trades:
        expected = REQUIRED_METRICS[trade.product_type]
        actual = metrics_by_trade.get(trade.trade_id, set())
        if missing := sorted(expected - actual):
            missing_metrics[trade.trade_id] = missing
        if unexpected := sorted(actual - expected):
            unexpected_metrics[trade.trade_id] = unexpected
    if unexpected_metrics:
        raise ValueError(f"Unexpected risk metrics by trade: {unexpected_metrics}")
    return frame, missing_metrics


def _reconcile_risk(
    frame: pd.DataFrame,
    by_metric: list[RiskMetricSummary],
    by_book: list[RiskByBook],
    trade_ids: set[str],
    incomplete_trade_ids: set[str] | None = None,
) -> RiskReconciliation:
    unknown_trade_ids = sorted(set(frame["trade_id"]) - trade_ids)
    if unknown_trade_ids:
        raise ValueError(f"Risk rows reference unknown trades: {unknown_trade_ids}")

    for summary in by_metric:
        metric_rows = frame.loc[frame["risk_metric"] == summary.risk_metric]
        book_rows = [row for row in by_book if row.risk_metric == summary.risk_metric]
        expected = (
            metric_rows["value_usd"].sum(),
            metric_rows["value_usd"].abs().sum(),
            metric_rows["trade_id"].nunique(),
        )
        actual = (summary.net_value, summary.gross_value, summary.trade_count)
        books = (
            sum(row.net_value for row in book_rows),
            sum(row.gross_value for row in book_rows),
            sum(row.trade_count for row in book_rows),
        )
        if not all(
            math.isclose(float(left), float(right), rel_tol=1e-9, abs_tol=1e-6)
            for left, right in zip(actual, expected)
        ):
            raise ValueError(f"Risk grid does not reconcile for {summary.risk_metric}")
        if not all(
            math.isclose(float(left), float(right), rel_tol=1e-9, abs_tol=1e-6)
            for left, right in zip(books, actual)
        ):
            raise ValueError(f"Risk books do not reconcile for {summary.risk_metric}")

    uncovered_trade_ids = sorted(
        (trade_ids - set(frame["trade_id"])) | (incomplete_trade_ids or set())
    )
    return RiskReconciliation(
        status="WARNING" if uncovered_trade_ids else "PASS",
        all_sensitivities_mapped=True,
        metric_totals_match_grid=True,
        book_totals_match_desk=True,
        uncovered_trade_ids=uncovered_trade_ids,
    )


def load_risk(
    risk_path: Path = RISK_FILE,
    trades_path: Path = TRADES_FILE,
    fx_path: Path = FX_FILE,
) -> RiskResponse:
    trades_response = load_trades(trades_path, fx_path)
    frame, missing_metrics = load_risk_frame(risk_path, trades_response, fx_path)
    trades = {trade.trade_id: trade for trade in trades_response.trades}

    metric_order = [
        metric
        for metric in METRIC_UNITS
        if metric in ADDITIVE_METRICS and metric in set(frame["risk_metric"])
    ]
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
            trader_id=trades[row.trade_id].trader_id,
            asset_class=trades[row.trade_id].asset_class,
            product_type=trades[row.trade_id].product_type,
            instrument_id=row.instrument_id,
            instrument_description=trades[row.trade_id].instrument_description,
            currency=trades[row.trade_id].currency,
            risk_metric=row.risk_metric,
            value_usd=row.value_usd,
            display_unit=METRIC_UNITS[row.risk_metric],
        )
        for row in frame.sort_values(["book_id", "trade_id", "risk_metric"]).itertuples()
    ]

    reconciliation = _reconcile_risk(
        frame, by_metric, by_book, set(trades), set(missing_metrics)
    )
    issues = list(trades_response.issues)
    if reconciliation.uncovered_trade_ids:
        issues.append(
            QualityIssue(
                severity="WARNING",
                code="INCOMPLETE_RISK_COVERAGE",
                count=len(reconciliation.uncovered_trade_ids),
                entity_ids=reconciliation.uncovered_trade_ids,
                message="Trades do not have their complete required risk metrics.",
            )
        )
    if frame["computation_timestamp"].nunique() > 1:
        oldest = frame["computation_timestamp"].min()
        mixed_ids = sorted(
            frame.loc[
                frame["computation_timestamp"] == oldest, "trade_id"
            ].unique()
        )
        issues.append(
            QualityIssue(
                severity="WARNING",
                code="MIXED_RISK_TIMESTAMPS",
                count=len(mixed_ids),
                entity_ids=mixed_ids,
                message="Risk sensitivities have mixed computation timestamps.",
            )
        )

    return RiskResponse(
        as_of_date=trades_response.as_of_date,
        computed_at=frame["computation_timestamp"].min().to_pydatetime(),
        sensitivity_count=len(frame),
        trade_count=frame["trade_id"].nunique(),
        covered_trade_count=trades_response.count - len(reconciliation.uncovered_trade_ids),
        total_trade_count=trades_response.count,
        issues=issues,
        by_metric=by_metric,
        by_book=by_book,
        sensitivities=sensitivities,
        reconciliation=reconciliation,
    )
