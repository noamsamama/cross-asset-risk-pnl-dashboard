# Asia Desk Risk & P&L

A cross-asset dashboard for positions, explained P&L and risk across the Asia rates, credit, FX and equity-derivatives books.

## Prerequisites

The prototype was developed with:

- Python 3.12
- Node.js 24 and npm

## Source data

The raw extracts are deliberately excluded from Git. Create `data/` at the repository root and place these files inside it without renaming them:

```text
data/
├── trades.csv
├── market_data.csv
├── risk_sensitivities.csv
└── fx_rates.csv
```

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

- `GET /api/trades` — normalized trade blotter and data-quality issues
- `GET /api/pnl` — explained P&L, coverage and trade-level contributions
- `GET /api/risk` — desk aggregates, book totals, sensitivities and reconciliation

## Data flow

The backend reads the four CSV extracts on each request. The shared trade, FX and risk loaders normalize and validate source data before P&L or risk calculations run. This direct approach is deliberate for the supplied dataset size; replacing CSV transport would require changing these loaders.

The as-of date is the latest date in the FX extract. Risk must be entirely computed on that date, and future market or trade dates are rejected.

## Position calculations

- Gross notional is non-negative local notional converted with the as-of USD rate.
- Net notional applies `+1` to `BUY`/`RECEIVE` and `-1` to `SELL`/`PAY`.
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
- Conflicting duplicates, invalid schemas/dates/numbers/units/FX pairs, non-finite values, unknown trades, ownership mismatches and failed reconciliations stop the request with an actionable `503` response.

## Known limits

- Historical explained P&L uses current sensitivities rather than historical Greeks.
- Official P&L would require valuation snapshots, cash movements and realized/unrealized attribution, which are not supplied.
- FX conversion supports currencies with a direct USD pair in the extract.
- Quote freshness follows the extract contract that update date must equal snapshot date; no intraday cutoff was supplied.
- Data is revalidated on every request. This is appropriate for 40 trades; add versioned caching only if measured load requires it.

## Data exploration

`notebooks/data_quality.ipynb` is an optional exploratory notebook for profiling schemas, dates, duplicates, joins, quotes and FX data. It never rewrites the raw extracts and is not required to run the API.
