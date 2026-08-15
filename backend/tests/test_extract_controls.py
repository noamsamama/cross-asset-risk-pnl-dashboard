import math

import pandas as pd
import pytest

from app.data import (
    DATA_SOURCE,
    FX_FILE,
    REQUIRED_EXTRACTS,
    TRADES_FILE,
    load_trades,
    resolve_data_directory,
)
from app.pnl import load_pnl
from app.risk import RISK_FILE, load_risk


pytestmark = pytest.mark.skipif(
    not all(path.exists() for path in (TRADES_FILE, FX_FILE, RISK_FILE)),
    reason="source extracts are deliberately excluded from Git",
)


def test_current_extract_controls_and_coverage():
    trades = load_trades()
    risk = load_risk()
    pnl = load_pnl()

    assert trades.as_of_date == risk.as_of_date == pnl.as_of_date
    assert trades.data_source == risk.data_source == pnl.data_source == DATA_SOURCE
    assert {issue.code for issue in trades.issues} >= {
        "DUPLICATE_TRADE_ID",
        "MATURED_LIVE_TRADE",
    }
    assert risk.reconciliation.status == "PASS"
    assert "Duration" not in {metric.risk_metric for metric in risk.by_metric}
    assert pnl.coverage.model_dump() == {"covered_trades": 37, "total_trades": 40}
    assert {issue.severity for issue in pnl.issues} == {"ERROR"}
    expected_penultimate_coverage = 40 if DATA_SOURCE == "EXAMPLE" else 39
    assert [(point.covered_trades) for point in pnl.history[-2:]] == [
        expected_penultimate_coverage,
        37,
    ]
    stale_trade_id = "DEMO-012" if DATA_SOURCE == "EXAMPLE" else "TRD-012"
    assert max(
        contribution.date
        for contribution in pnl.contributions
        if contribution.trade_id == stale_trade_id
    ) < pnl.as_of_date


def test_representative_explained_pnl_values():
    pnl = load_pnl()
    latest = {
        row.trade_id: row.pnl_usd
        for row in pnl.contributions
        if row.date == pnl.as_of_date
    }
    expected = (
        {
            "DEMO-001": -113057.77000000028,
            "DEMO-014": 8655.288800000493,
            "DEMO-016": -235248.92999999874,
            "DEMO-021": 21806.600687609163,
            "DEMO-031": -51270.21330055391,
            "DEMO-034": 286000.1237782854,
        }
        if DATA_SOURCE == "EXAMPLE"
        else {
            "TRD-001": -6707.1424,
            "TRD-013": 87.8328,
            "TRD-016": 3015.0,
            "TRD-021": 18612.3158600671,
            "TRD-031": 117426.9542920884,
            "TRD-034": -205229.591722797,
        }
    )
    assert all(math.isclose(latest[key], value) for key, value in expected.items())


def test_risk_rejects_wrong_date_and_unknown_trade(tmp_path):
    frame = pd.read_csv(RISK_FILE)
    frame["as_of_date"] = "1900-01-01"
    path = tmp_path / "wrong-date.csv"
    frame.to_csv(path, index=False)
    with pytest.raises(ValueError, match="not entirely as of"):
        load_risk(path)

    frame = pd.read_csv(RISK_FILE)
    extra = frame.iloc[0].copy()
    extra["trade_id"] = "TRD-999"
    extra["risk_metric"] = "JTD_USD"
    extra["unit"] = "amount_usd"
    extra["ccy"] = "USD"
    extra["value_usd"] = extra["value"]
    frame.loc[len(frame)] = extra
    path = tmp_path / "unknown-trade.csv"
    frame.to_csv(path, index=False)
    with pytest.raises(ValueError, match=r"unknown trades: \['TRD-999'\]"):
        load_risk(path)


def test_missing_required_metric_reduces_risk_coverage(tmp_path):
    frame = pd.read_csv(RISK_FILE)
    target_trade = "DEMO-031" if DATA_SOURCE == "EXAMPLE" else "TRD-031"
    frame = frame.loc[
        ~(
            (frame["trade_id"] == target_trade)
            & (frame["risk_metric"] == "Gamma_USD")
        )
    ]
    path = tmp_path / "missing-gamma.csv"
    frame.to_csv(path, index=False)

    risk = load_risk(path)

    assert risk.reconciliation.status == "WARNING"
    assert risk.covered_trade_count == 39
    assert risk.reconciliation.uncovered_trade_ids == [target_trade]
    assert next(
        issue.severity
        for issue in risk.issues
        if issue.code == "INCOMPLETE_RISK_COVERAGE"
    ) == "ERROR"


def test_non_finite_trade_value_is_rejected(tmp_path):
    frame = pd.read_csv(TRADES_FILE).drop_duplicates("trade_id")
    target_trade = "DEMO-001" if DATA_SOURCE == "EXAMPLE" else "TRD-001"
    frame["notional"] = frame["notional"].astype(float)
    frame.loc[frame["trade_id"] == target_trade, "notional"] = float("inf")
    path = tmp_path / "non-finite.csv"
    frame.to_csv(path, index=False)

    with pytest.raises(ValueError, match="Non-finite trade values"):
        load_trades(path)


def test_dataset_selection_is_all_or_nothing(tmp_path):
    operational = tmp_path / "data"
    example = tmp_path / "example_data"
    operational.mkdir()
    example.mkdir()
    for name in REQUIRED_EXTRACTS:
        (example / name).touch()

    directory, source = resolve_data_directory(operational, example)
    assert (directory, source) == (example, "EXAMPLE")

    for name in sorted(REQUIRED_EXTRACTS)[:-1]:
        (operational / name).touch()
    directory, source = resolve_data_directory(operational, example)
    assert (directory, source) == (example, "EXAMPLE")

    (operational / sorted(REQUIRED_EXTRACTS)[-1]).touch()
    directory, source = resolve_data_directory(operational, example)
    assert (directory, source) == (operational, "OPERATIONAL")
