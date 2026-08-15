"""Deterministically generate synthetic demo extracts from the source schemas."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIRECTORY = REPOSITORY_ROOT / "data"
OUTPUT_DIRECTORY = REPOSITORY_ROOT / "example_data"
AS_OF_DATE = pd.Timestamp("2025-02-14")
RANDOM_SEED = 20_250_214
EXTRACTS = (
    "trades.csv",
    "market_data.csv",
    "risk_sensitivities.csv",
    "fx_rates.csv",
)

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
BOOKS = {
    "RATES": "RATES-DEMO-01",
    "CREDIT": "CREDIT-DEMO-01",
    "FX": "FX-DEMO-01",
    "EQUITY": "EQD-DEMO-01",
}
REQUIRED_METRICS = {
    "IRS": ("DV01", "Duration"),
    "GOVT_BOND": ("DV01", "Duration"),
    "CORP_BOND": ("DV01", "Spread01", "JTD_USD"),
    "CDS": ("CS01_USD", "JTD_USD"),
    "FX_SPOT": ("Delta_USD",),
    "FX_FORWARD": ("Delta_USD",),
    "FX_NDF": ("Delta_USD",),
    "EQ_FUTURE": ("Delta_USD",),
    "EQ_OPTION": ("Delta_USD", "Gamma_USD", "Vega_USD", "Theta_USD"),
}
METRIC_UNITS = {
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
FX_BASE_LEVELS = {
    "AUDUSD": 0.72,
    "EURUSD": 1.12,
    "USDCNH": 7.18,
    "USDHKD": 7.79,
    "USDJPY": 145.0,
    "USDKRW": 1_320.0,
    "USDSGD": 1.35,
}


def _source_columns() -> dict[str, list[str]]:
    missing = [name for name in EXTRACTS if not (SOURCE_DIRECTORY / name).exists()]
    if missing:
        raise FileNotFoundError(
            "The generator needs the source extracts only to read their column headers: "
            f"{missing}"
        )
    return {
        name: pd.read_csv(SOURCE_DIRECTORY / name, nrows=0).columns.tolist()
        for name in EXTRACTS
    }


def _generate_fx(rng: np.random.Generator) -> pd.DataFrame:
    dates = pd.bdate_range(end=AS_OF_DATE, periods=24)
    rows: list[dict[str, object]] = []
    for pair, base_level in FX_BASE_LEVELS.items():
        shocks = rng.normal(0, 0.0025, len(dates))
        levels = base_level * np.cumprod(1 + shocks)
        for date, level in zip(dates, levels):
            rows.append(
                {
                    "date": date.strftime("%Y-%m-%d"),
                    "ccy_pair": pair,
                    "base_ccy": pair[:3],
                    "quote_ccy": pair[3:],
                    "spot_rate": round(float(level), 6),
                    "source": "SYNTHETIC_GENERATOR",
                }
            )
    return pd.DataFrame(rows)


def _usd_rates(fx: pd.DataFrame) -> dict[str, float]:
    latest = fx.loc[fx["date"] == AS_OF_DATE.strftime("%Y-%m-%d")]
    rates = {"USD": 1.0}
    for row in latest.itertuples():
        if row.base_ccy == "USD":
            rates[row.quote_ccy] = 1 / row.spot_rate
        elif row.quote_ccy == "USD":
            rates[row.base_ccy] = row.spot_rate
    return rates


def _trade_blueprints() -> list[tuple[str, str]]:
    return (
        [("IRS", currency) for currency in ("JPY", "KRW", "AUD", "SGD")]
        + [
            ("GOVT_BOND", currency)
            for currency in ("JPY", "JPY", "KRW", "SGD", "AUD", "KRW")
        ]
        + [
            ("CORP_BOND", currency)
            for currency in ("USD", "USD", "JPY", "USD", "SGD", "HKD", "CNH")
        ]
        + [("CDS", "USD") for _ in range(3)]
        + [
            (product, pair[3:])
            for product, pair in (
                ("FX_SPOT", "USDJPY"),
                ("FX_SPOT", "EURUSD"),
                ("FX_FORWARD", "USDSGD"),
                ("FX_SPOT", "AUDUSD"),
                ("FX_NDF", "USDCNH"),
                ("FX_NDF", "USDKRW"),
                ("FX_SPOT", "USDHKD"),
                ("FX_FORWARD", "USDJPY"),
                ("FX_FORWARD", "EURUSD"),
                ("FX_FORWARD", "AUDUSD"),
            )
        ]
        + [
            ("EQ_OPTION", "JPY"),
            ("EQ_OPTION", "JPY"),
            ("EQ_OPTION", "HKD"),
            ("EQ_FUTURE", "JPY"),
            ("EQ_FUTURE", "KRW"),
            ("EQ_OPTION", "HKD"),
            ("EQ_OPTION", "JPY"),
            ("EQ_FUTURE", "KRW"),
            ("EQ_FUTURE", "JPY"),
            ("EQ_OPTION", "HKD"),
        ]
    )


def _instrument(
    trade_number: int, product: str, currency: str
) -> tuple[str, str]:
    if product == "IRS":
        return (
            f"DEMO-IRS-{trade_number:03d}",
            f"Synthetic {currency} receive/pay-fixed swap",
        )
    if product == "GOVT_BOND":
        return (
            f"DEMO-GOVT-{trade_number:03d}",
            f"Synthetic {currency} sovereign bond",
        )
    if product == "CORP_BOND":
        if trade_number == 11:
            identifier = "DEMO-CORP-MISSING"
        elif trade_number in {12, 13}:
            identifier = "DEMO-CORP-STALE"
        else:
            identifier = f"DEMO-CORP-{trade_number:03d}"
        return identifier, f"Synthetic {currency} corporate bond"
    if product == "CDS":
        return f"DEMO-CDS-{trade_number:03d}", "Synthetic sovereign five-year CDS"
    if product.startswith("FX_"):
        pairs = (
            "USDJPY",
            "EURUSD",
            "USDSGD",
            "AUDUSD",
            "USDCNH",
            "USDKRW",
            "USDHKD",
            "USDJPY",
            "EURUSD",
            "AUDUSD",
        )
        pair = pairs[trade_number - 21]
        return pair, f"Synthetic {pair[:3]}/{pair[3:]} {product[3:].lower()}"
    equity_instruments = (
        "NKY-CALL-42000-2025-06",
        "NKY-PUT-39000-2025-06",
        "HSI-CALL-22000-2025-06",
        "NKY-FUT-2025-06",
        "KOSPI200-FUT-2025-06",
        "HSI-PUT-19000-2025-06",
        "NKY-CALL-41000-2025-06",
        "KOSPI200-FUT-2025-09",
        "NKY-FUT-2025-09",
        "HSI-CALL-21000-2025-09",
    )
    identifier = equity_instruments[trade_number - 31]
    return identifier, f"Synthetic {identifier.replace('-', ' ')} position"


def _generate_trades(
    rng: np.random.Generator, usd_rates: dict[str, float]
) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    directions = ("RECEIVE", "PAY", "BUY", "SELL")
    for index, (product, currency) in enumerate(_trade_blueprints(), start=1):
        asset_class = PRODUCT_ASSET_CLASS[product]
        instrument_id, description = _instrument(index, product, currency)
        direction = directions[(index - 1) % len(directions)]
        if product in {"CDS", "FX_SPOT", "FX_FORWARD", "FX_NDF", "EQ_OPTION", "EQ_FUTURE"}:
            direction = "BUY" if index % 3 else "SELL"

        trade_date = AS_OF_DATE - pd.Timedelta(days=180 + (index * 17) % 520)
        settlement = None if index in {7, 26} else trade_date + pd.Timedelta(days=2)
        if index in {21, 22, 23, 24}:
            maturity = AS_OF_DATE - pd.Timedelta(days=20 + index)
        else:
            maturity = AS_OF_DATE + pd.Timedelta(days=365 + (index % 8) * 180)

        usd_notional = 4_000_000 + index * 650_000
        notional = 0.0 if asset_class == "EQUITY" else usd_notional / usd_rates[currency]
        quantity = float(20 + index * 3)
        if index == 39:
            quantity *= -1
        trade_price = float(rng.uniform(75, 125))
        if asset_class == "FX":
            trade_price = float(rng.uniform(0.7, 150))
        elif asset_class == "EQUITY":
            trade_price = float(rng.uniform(250, 42_000))

        date_string = (
            trade_date.strftime("%m/%d/%Y")
            if index in {2, 19}
            else trade_date.strftime("%Y-%m-%d")
        )
        rows.append(
            {
                "trade_id": f"DEMO-{index:03d}",
                "book_id": BOOKS[asset_class],
                "trader_id": f"DEMO-{asset_class[:2]}-TRADER-{1 + index % 2:02d}",
                "trade_date": date_string,
                "settle_date": "" if settlement is None else settlement.strftime("%Y-%m-%d"),
                "asset_class": asset_class,
                "product_type": product,
                "instrument_id": instrument_id,
                "instrument_description": description,
                "currency": currency,
                "notional": round(notional, 2),
                "quantity": quantity,
                "trade_price": round(trade_price, 4),
                "direction": direction,
                "counterparty_id": f"DEMO-CP-{1 + index % 9:03d}",
                "counterparty_name": f"Synthetic Counterparty {1 + index % 9:02d}",
                "status": "LIVE",
                "maturity_date": maturity.strftime("%Y-%m-%d"),
                "bloomberg_id": f"DEMO-BBG-{index:03d}",
                "internal_ref": f"DEMO-REF-{index:04d}",
            }
        )

    rows.append(dict(rows[6]))
    return pd.DataFrame(rows)


def _market_metadata(trades: pd.DataFrame) -> dict[str, dict[str, str]]:
    metadata: dict[str, dict[str, str]] = {}
    for trade in trades.drop_duplicates("trade_id").itertuples():
        if trade.asset_class == "FX":
            continue
        metadata[trade.instrument_id] = {
            "asset_class": trade.asset_class,
            "product_type": trade.product_type,
            "description": trade.instrument_description,
        }
        if trade.product_type == "EQ_OPTION":
            prefix = trade.instrument_id.split("-", 1)[0]
            metadata.setdefault(
                f"{prefix}-INDEX",
                {
                    "asset_class": "EQUITY",
                    "product_type": "EQ_INDEX",
                    "description": f"Synthetic {prefix} equity index",
                },
            )
    return metadata


def _random_walk(
    rng: np.random.Generator, base: float, count: int, volatility: float
) -> np.ndarray:
    return base * np.cumprod(1 + rng.normal(0, volatility, count))


def _generate_market(
    rng: np.random.Generator, trades: pd.DataFrame
) -> pd.DataFrame:
    dates = pd.bdate_range(end=AS_OF_DATE, periods=24)
    metadata = _market_metadata(trades)
    rows: list[dict[str, object]] = []
    for instrument_number, (instrument_id, meta) in enumerate(
        sorted(metadata.items()), start=1
    ):
        product = meta["product_type"]
        available_dates = dates[:-1] if instrument_id == "DEMO-CORP-MISSING" else dates
        count = len(available_dates)
        prices = _random_walk(rng, 90 + instrument_number * 3, count, 0.008)
        yields = _random_walk(rng, 2.0 + instrument_number * 0.07, count, 0.015)
        spreads = _random_walk(rng, 65 + instrument_number * 4, count, 0.025)
        vols = _random_walk(rng, 18 + instrument_number * 0.3, count, 0.02)

        for position, date in enumerate(available_dates):
            price: float | None = None
            yield_pct: float | None = None
            spread_bps: float | None = None
            implied_vol_pct: float | None = None
            price_type = "LAST"
            if product in {"IRS", "GOVT_BOND", "CORP_BOND"}:
                yield_pct = float(yields[position])
                price_type = "PAR_RATE" if product == "IRS" else "CLEAN"
            if product in {"GOVT_BOND", "CORP_BOND"}:
                price = float(prices[position])
            if product in {"CORP_BOND", "CDS"}:
                spread_bps = float(spreads[position])
                if product == "CDS":
                    price_type = "SPREAD"
            if product in {"EQ_FUTURE", "EQ_INDEX"}:
                price = float(prices[position] * (120 if "NKY" in instrument_id else 10))
            if product == "EQ_OPTION":
                price = float(prices[position] / 10)
                implied_vol_pct = float(vols[position])

            mid = price
            bid = None if mid is None else mid * 0.999
            ask = None if mid is None else mid * 1.001
            stale = instrument_id == "DEMO-CORP-STALE" and date == AS_OF_DATE
            update_date = date - pd.Timedelta(days=1) if stale else date
            rows.append(
                {
                    "date": date.strftime("%Y-%m-%d"),
                    "instrument_id": instrument_id,
                    "instrument_description": meta["description"],
                    "asset_class": meta["asset_class"],
                    "price": None if price is None else round(price, 6),
                    "yield_pct": None if yield_pct is None else round(yield_pct, 6),
                    "spread_bps": None if spread_bps is None else round(spread_bps, 6),
                    "implied_vol_pct": (
                        None if implied_vol_pct is None else round(implied_vol_pct, 6)
                    ),
                    "px_bid": None if bid is None else round(bid, 6),
                    "px_ask": None if ask is None else round(ask, 6),
                    "px_mid": None if mid is None else round(mid, 6),
                    "price_type": price_type,
                    "source": "SYNTHETIC_GENERATOR",
                    "last_update_utc": f"{update_date:%Y-%m-%d}T06:15:00Z",
                }
            )
    return pd.DataFrame(rows)


def _risk_value(metric: str, trade_number: int, sign: int) -> float:
    if metric == "Duration":
        return round(1.5 + (trade_number % 10) * 0.65, 4)
    if metric == "DV01":
        return sign * (18_000 + trade_number * 1_150)
    if metric == "Spread01":
        return sign * (8_000 + trade_number * 700)
    if metric == "CS01_USD":
        return sign * (12_000 + trade_number * 850)
    if metric == "JTD_USD":
        return sign * (1_200_000 + trade_number * 110_000)
    if metric == "Delta_USD":
        return sign * (3_500_000 + trade_number * 320_000)
    if metric == "Gamma_USD":
        return sign * (22_000 + trade_number * 900)
    if metric == "Vega_USD":
        return sign * (14_000 + trade_number * 600)
    if metric == "Theta_USD":
        return -sign * (2_000 + trade_number * 125)
    raise KeyError(metric)


def _generate_risk(
    trades: pd.DataFrame, usd_rates: dict[str, float]
) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    unique_trades = trades.drop_duplicates("trade_id")
    for trade_number, trade in enumerate(unique_trades.itertuples(), start=1):
        sign = 1 if trade.direction in {"BUY", "RECEIVE"} else -1
        for metric in REQUIRED_METRICS[trade.product_type]:
            unit = METRIC_UNITS[metric]
            value_usd = _risk_value(metric, trade_number, sign)
            if unit == "amount":
                ccy = trade.currency
                value = value_usd / usd_rates[ccy]
            else:
                ccy = "USD" if unit == "amount_usd" else trade.currency
                value = value_usd
            rows.append(
                {
                    "as_of_date": AS_OF_DATE.strftime("%Y-%m-%d"),
                    "trade_id": trade.trade_id,
                    "book_id": trade.book_id,
                    "instrument_id": trade.instrument_id,
                    "risk_metric": metric,
                    "value": round(value, 6),
                    "ccy": ccy,
                    "value_usd": round(value_usd, 6),
                    "unit": unit,
                    "computation_timestamp": f"{AS_OF_DATE:%Y-%m-%d}T06:30:00Z",
                    "notes": "Synthetic example data",
                }
            )
    return pd.DataFrame(rows)


def _validate(
    frames: dict[str, pd.DataFrame], columns: dict[str, list[str]]
) -> None:
    for name, frame in frames.items():
        if frame.columns.tolist() != columns[name]:
            raise AssertionError(f"{name} columns differ from the source contract")

    trades = frames["trades.csv"]
    unique_trades = trades.drop_duplicates("trade_id")
    assert len(trades) == 41 and len(unique_trades) == 40
    assert trades["trade_date"].astype(str).str.contains("/").sum() == 2
    assert (trades.drop_duplicates("trade_id")["settle_date"] == "").sum() == 2
    assert (unique_trades["quantity"] < 0).sum() == 1
    maturity = pd.to_datetime(unique_trades["maturity_date"])
    assert (maturity < AS_OF_DATE).sum() == 4

    risk = frames["risk_sensitivities.csv"]
    assert set(risk["trade_id"]) == set(unique_trades["trade_id"])
    assert not risk.duplicated(["trade_id", "risk_metric"]).any()
    assert set(frames["fx_rates.csv"]["source"]) == {"SYNTHETIC_GENERATOR"}
    assert set(frames["market_data.csv"]["source"]) == {"SYNTHETIC_GENERATOR"}


def generate_example_data() -> dict[str, int]:
    """Generate all four example extracts and return their row counts."""
    columns = _source_columns()
    rng = np.random.default_rng(RANDOM_SEED)
    fx = _generate_fx(rng)
    rates = _usd_rates(fx)
    trades = _generate_trades(rng, rates)
    market = _generate_market(rng, trades)
    risk = _generate_risk(trades, rates)
    frames = {
        "trades.csv": trades,
        "market_data.csv": market,
        "risk_sensitivities.csv": risk,
        "fx_rates.csv": fx,
    }
    frames = {name: frame.loc[:, columns[name]] for name, frame in frames.items()}
    _validate(frames, columns)

    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    for name, frame in frames.items():
        frame.to_csv(OUTPUT_DIRECTORY / name, index=False, na_rep="")
    return {name: len(frame) for name, frame in frames.items()}


if __name__ == "__main__":
    print(generate_example_data())
