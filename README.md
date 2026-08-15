# Cross-Asset Risk & P&L Dashboard

[![Live demo](https://img.shields.io/badge/live%20demo-render-46E3B7?logo=render)](https://cross-asset-risk-pnl-dashboard.onrender.com)
![Python](https://img.shields.io/badge/python-3.12-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-backend-009688?logo=fastapi)
![React](https://img.shields.io/badge/React-frontend-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-frontend-3178C6?logo=typescript)
![MUI](https://img.shields.io/badge/MUI-components-007FFF?logo=mui)
![pandas](https://img.shields.io/badge/pandas-data-150458?logo=pandas)
![Docker](https://img.shields.io/badge/Docker-deployed-2496ED?logo=docker)

### ▶️ [Open the live dashboard](https://cross-asset-risk-pnl-dashboard.onrender.com)

A cross-asset risk and P&L dashboard for an Asia trading book spanning **rates, credit, FX and equity derivatives**. It normalises trade, market, FX and sensitivity extracts, then presents positions, sensitivity-explained P&L and desk-level risk through a **FastAPI backend and a React frontend**, with data-quality controls surfaced at every step.

Each calculation follows standard desk methodology: trade normalisation and validation, position sign conventions, sensitivity-based P&L attribution (DV01, CS01, delta/gamma/vega/theta), and native-to-USD reconciliation to the as-of FX rate.

## What it computes

| Area | Coverage |
|---|---|
| **Explained P&L** | Sensitivity-based attribution across 5 product families: rates/govvies (DV01), corporate bonds (DV01 + Spread01), CDS (CS01), FX & equity futures (delta), equity options (delta/gamma/vega/theta) |
| **Risk aggregation** | Net and gross sensitivities per desk, native/USD reconciliation to the as-of FX rate within one cent |
| **Positions** | Gross and net notional with authoritative direction handling, product-aware notional availability |
| **Data quality** | Amber/red alerts for duplicates, stale quotes, matured live trades, incomplete coverage; hard `503` on invalid schemas or failed reconciliation |

**Stack:** Python · FastAPI · React · Docker · deployed on Render

> ⚠️ **Demo mode:** the public dashboard uses independently simulated data from `example_data/`. A green banner marks demo mode. These files must not be used for trading, valuation or control decisions.

## Source data

Operational extracts are excluded from Git and Docker builds. Do not copy them into issues, logs, screenshots, demo fixtures or commits.

Create `data/` at the repository root and place these files inside it without renaming them:

```text
data/
├── trades.csv
├── market_data.csv
├── risk_sensitivities.csv
└── fx_rates.csv
```

Source selection is all-or-nothing and is evaluated on every API request:

- When all four required files exist in `data/`, the API uses the operational extracts.
- When `data/` is missing or any required file is absent, the API uses all four committed synthetic extracts from `example_data/`.
- Operational and example files are never mixed. Adding or removing a complete operational set changes the source on the next request.

The synthetic files are generated deterministically by `notebooks/generate_example_data.ipynb`. The notebook reads only the operational CSV headers to preserve the schema contract; identifiers, dates, values, market paths and sensitivities are independently generated. Notebook outputs are cleared before commit.

## Installation

From the repository root, create and activate a Python environment, then install the backend dependencies:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
```

Install the locked frontend dependencies:

```bash
cd frontend
npm ci
cd ..
```

## Run locally

Start the API in one terminal:

```bash
source .venv/bin/activate
cd backend
uvicorn app.main:app --reload
```

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173/P&L` or `http://localhost:5173/Risk`. FastAPI documentation is available at `http://127.0.0.1:8000/docs`.

## Hosted demo

[Open the dashboard](https://cross-asset-risk-pnl-dashboard.onrender.com)

Render builds the React frontend and serves it with FastAPI as one Blueprint-managed Docker Web Service. The public image contains only `example_data/`; `.dockerignore` excludes local operational extracts and secrets.

| Render setting | Value          |
| -------------- | -------------- |
| Service type   | Web Service    |
| Runtime        | Docker         |
| Branch         | `main`         |
| Root directory | blank          |
| Dockerfile     | `./Dockerfile` |
| Build context  | `.`            |
| Region         | Frankfurt      |
| Health check   | `/api/hello`   |

Every push to `main` triggers a deployment. No database, disk, worker or cron job is required. The Free instance can sleep when idle, so its first request may take longer.

## Verification

```bash
cd backend
python -m pytest
```

```bash
cd frontend
npm run format:check
npm run lint
npm run build
```

## API

- `GET /api/trades` — normalized trade blotter, active data source and data-quality issues
- `GET /api/pnl` — explained P&L, active data source, coverage and trade-level contributions
- `GET /api/risk` — desk aggregates, active data source, book totals, sensitivities and reconciliation

## Data flow

The backend reads the four CSV extracts on each request. The shared trade, FX and risk loaders normalize and validate source data before P&L or risk calculations run. This direct approach is deliberate for the supplied dataset size; replacing CSV transport would require changing these loaders.

The as-of date is the latest date in the FX extract. Risk must be entirely computed on that date, and future market or trade dates are rejected.

## Position calculations

- Gross notional is non-negative local notional converted with the as-of USD rate.
- Net notional applies `+1` to `BUY`/`RECEIVE` and `-1` to `SELL`/`PAY`.
- Net notional remains available per trade, but is not presented as one desk total because notionals across unrelated products are not safely nettable.
- Equity derivatives have zero source notional and no contract multiplier or underlying equivalent-notional field. They are reported as unavailable, not zero, in USD notional views.
- Direction is authoritative. Negative quantities are normalized to absolute quantities and reported as a warning.
- Trades marked `LIVE` after maturity remain visible but are reported as a lifecycle warning; the source owner must decide whether to cancel or correct them.

## Explained P&L methodology

This is sensitivity-explained P&L, not official realized or valuation P&L. Current as-of USD sensitivities are applied to each valid daily market move:

- Rates and government bonds: `-DV01 × yield move (bp)`.
- Corporate bonds: `-DV01 × inferred rate move (bp) - Spread01 × spread move (bp)`, where inferred rate move is total yield move minus spread move.
- CDS: `CS01 × spread move (bp)`; positive CS01 represents protection-buyer exposure.
- FX and equity futures: `Delta_USD × fractional price return`.
- Equity options: `Delta_USD × return + 0.5 × Gamma_USD × return_pct² + Vega_USD × vol-point move + Theta_USD × calendar days`.

The formulas assume DV01 is positive long-duration PV01, `Delta_USD` is dollar-equivalent exposure, `Gamma_USD` is per squared percentage-point return, Vega is per volatility point, and Theta is per calendar day. Missing as-of data reduces current coverage, while valid earlier contributions remain in history with daily coverage counts.

## Risk and data controls

- Net risk is the signed sum and gross risk the absolute sum within one additive metric and unit.
- Per-trade Duration remains in the grid but is not summed. A portfolio Duration requires an agreed market-value or DV01 weighting.
- Product-specific required sensitivities are checked before coverage is marked complete.
- Native and USD risk values reconcile to as-of FX within one cent.
- Exact duplicates, mixed dates, missing settlements, matured live trades, signed quantities, stale quotes and incomplete coverage are visible as drill-down issues.
- Amber alerts identify records that remain usable after normalization or require attention without excluding them. Red alerts identify positions excluded from the displayed P&L or risk calculation; the coverage chip is also red whenever selected coverage is incomplete.
- Alert colors describe data-processing impact, not risk-limit utilisation. No approved book/metric limit extract was supplied, so the dashboard does not invent thresholds or breach status.
- Conflicting duplicates, invalid schemas/dates/numbers/units/FX pairs, non-finite values, unknown trades, ownership mismatches and failed reconciliations stop the request with an actionable `503` response.

## Known limits

- Historical explained P&L uses current sensitivities rather than historical Greeks.
- Official P&L would require valuation snapshots, cash movements and realized/unrealized attribution, which are not supplied.
- FX conversion supports currencies with a direct USD pair in the extract.
- Quote freshness follows the extract contract that update date must equal snapshot date; no intraday cutoff was supplied.
- Data is revalidated on every request. This is appropriate for 40 trades; add versioned caching only if measured load requires it.

## Data exploration

`notebooks/data_quality.ipynb` is an optional exploratory notebook for profiling schemas, dates, duplicates, joins, quotes and FX data. It never rewrites the raw extracts and is not required to run the API.
