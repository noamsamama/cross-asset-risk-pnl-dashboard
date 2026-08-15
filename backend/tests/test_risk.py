import pandas as pd
import pytest

from app.risk import RiskByBook, RiskMetricSummary, _reconcile_risk


def risk_case():
    frame = pd.DataFrame(
        [
            {"trade_id": "T1", "risk_metric": "DV01", "value_usd": 10},
            {"trade_id": "T2", "risk_metric": "DV01", "value_usd": -3},
        ]
    )
    summary = [
        RiskMetricSummary(
            risk_metric="DV01",
            display_unit="USD/bp",
            net_value=7,
            gross_value=13,
            trade_count=2,
        )
    ]
    books = [
        RiskByBook(
            book_id="B1",
            risk_metric="DV01",
            display_unit="USD/bp",
            net_value=10,
            gross_value=10,
            trade_count=1,
        ),
        RiskByBook(
            book_id="B2",
            risk_metric="DV01",
            display_unit="USD/bp",
            net_value=-3,
            gross_value=3,
            trade_count=1,
        ),
    ]
    return frame, summary, books


def test_risk_reconciliation_passes_when_all_trades_are_covered():
    result = _reconcile_risk(*risk_case(), {"T1", "T2"})

    assert result.status == "PASS"
    assert result.uncovered_trade_ids == []
    assert result.all_sensitivities_mapped
    assert result.metric_totals_match_grid
    assert result.book_totals_match_desk


def test_risk_reconciliation_reports_uncovered_trades():
    result = _reconcile_risk(*risk_case(), {"T1", "T2", "T3"})

    assert result.status == "WARNING"
    assert result.uncovered_trade_ids == ["T3"]


def test_risk_reconciliation_rejects_unknown_trade():
    frame, summary, books = risk_case()

    with pytest.raises(ValueError, match="unknown trades"):
        _reconcile_risk(frame, summary, books, {"T1"})


def test_risk_reconciliation_rejects_bad_grid_total():
    frame, summary, books = risk_case()
    summary[0].net_value = 8

    with pytest.raises(ValueError, match="Risk grid does not reconcile"):
        _reconcile_risk(frame, summary, books, {"T1", "T2"})


def test_risk_reconciliation_rejects_bad_book_total():
    frame, summary, books = risk_case()
    books[0].net_value = 9

    with pytest.raises(ValueError, match="Risk books do not reconcile"):
        _reconcile_risk(frame, summary, books, {"T1", "T2"})
