# Asia Desk Risk & P&L

## Data source architecture

The prototype consumes the supplied operational extracts through a data-source abstraction. The current implementation uses CSV files, while the calculation and API layers are independent of the transport. A PostgreSQL or HTTP implementation could replace the CSV adapter without changing the business logic.

## Data exploration

`notebooks/data_quality.ipynb` is an optional exploratory notebook for profiling schemas, dates, duplicates, joins, quotes, and FX data. It never rewrites the raw extracts and is not required to run the API, so it can be removed once the confirmed validation rules live in backend code.

## Calculations and controls

- Gross notional is the absolute local notional converted with the as-of USD FX rate.
- Direction carries the trade sign; signed quantities are normalized to absolute quantities and reported as a data-quality warning.
- Net risk is the signed sum of sensitivities; gross risk is the sum of their absolute values.
- Explained P&L applies current USD sensitivities to daily market moves. Options include delta, gamma, vega and calendar-day theta.
- The risk API reconciles grid rows to metric totals and metric totals to book totals. Unknown trades, ownership mismatches and failed reconciliations stop the request; incomplete coverage is reported as a warning.

## Run locally

```bash
cd backend
uvicorn app.main:app --reload
```

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173/P&L` or `http://localhost:5173/Risk`.
