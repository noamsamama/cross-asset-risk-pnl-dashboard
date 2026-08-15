import math

import pandas as pd
import pytest

from app.data import FX_FILE, TRADES_FILE, load_trades
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
    assert {issue.code for issue in trades.issues} >= {
        "DUPLICATE_TRADE_ID",
        "MATURED_LIVE_TRADE",
    }
    assert risk.reconciliation.status == "PASS"
    assert "Duration" not in {metric.risk_metric for metric in risk.by_metric}
    assert pnl.coverage.model_dump() == {"covered_trades": 37, "total_trades": 40}
    assert {issue.severity for issue in pnl.issues} == {"ERROR"}
    assert [(point.covered_trades) for point in pnl.history[-2:]] == [39, 37]
    assert max(
        contribution.date
        for contribution in pnl.contributions
        if contribution.trade_id == "TRD-012"
    ).isoformat() == "2026-08-04"


def test_representative_explained_pnl_values():
    pnl = load_pnl()
    latest = {
        row.trade_id: row.pnl_usd
        for row in pnl.contributions
        if row.date == pnl.as_of_date
    }
    expected = {
        "TRD-001": -6707.1424,
        "TRD-013": 87.8328,
        "TRD-016": 3015.0,
        "TRD-021": 18612.3158600671,
        "TRD-031": 117426.9542920884,
        "TRD-034": -205229.591722797,
    }
    assert all(math.isclose(latest[key], value) for key, value in expected.items())


def test_risk_rejects_wrong_date_and_unknown_trade(tmp_path):
    frame = pd.read_csv(RISK_FILE)
    frame["as_of_date"] = "2026-08-04"
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
    frame = frame.loc[
        ~((frame["trade_id"] == "TRD-031") & (frame["risk_metric"] == "Gamma_USD"))
    ]
    path = tmp_path / "missing-gamma.csv"
    frame.to_csv(path, index=False)

    risk = load_risk(path)

    assert risk.reconciliation.status == "WARNING"
    assert risk.covered_trade_count == 39
    assert risk.reconciliation.uncovered_trade_ids == ["TRD-031"]
    assert next(
        issue.severity
        for issue in risk.issues
        if issue.code == "INCOMPLETE_RISK_COVERAGE"
    ) == "ERROR"


def test_non_finite_trade_value_is_rejected(tmp_path):
    frame = pd.read_csv(TRADES_FILE).drop_duplicates("trade_id")
    frame["notional"] = frame["notional"].astype(float)
    frame.loc[frame["trade_id"] == "TRD-001", "notional"] = float("inf")
    path = tmp_path / "non-finite.csv"
    frame.to_csv(path, index=False)

    with pytest.raises(ValueError, match="Non-finite trade values"):
        load_trades(path)
