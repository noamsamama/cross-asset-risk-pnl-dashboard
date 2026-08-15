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

## Data source architecture

The prototype consumes the supplied operational extracts through a data-source abstraction. The current implementation uses CSV files, while the calculation and API layers are independent of the transport. A PostgreSQL or HTTP implementation could replace the CSV adapter without changing the business logic.

## Calculations and controls

- Gross notional is the absolute local notional converted with the as-of USD FX rate.
- Direction carries the trade sign; signed quantities are normalized to absolute quantities and reported as a data-quality warning.
- Net risk is the signed sum of sensitivities; gross risk is the sum of their absolute values.
- Explained P&L applies current USD sensitivities to daily market moves. Options include delta, gamma, vega and calendar-day theta.
- The risk API reconciles grid rows to metric totals and metric totals to book totals. Unknown trades, ownership mismatches and failed reconciliations stop the request; incomplete coverage is reported as a warning.

## Data exploration

`notebooks/data_quality.ipynb` is an optional exploratory notebook for profiling schemas, dates, duplicates, joins, quotes and FX data. It never rewrites the raw extracts and is not required to run the API.
