# RAD Risk & P&L Tool

## Data source architecture

The prototype consumes the supplied operational extracts through a data-source abstraction. The current implementation uses CSV files, while the calculation and API layers are independent of the transport. A PostgreSQL or HTTP implementation could replace the CSV adapter without changing the business logic.

## Data exploration

`notebooks/data_quality.ipynb` is an optional exploratory notebook for profiling schemas, dates, duplicates, joins, quotes, and FX data. It never rewrites the raw extracts and is not required to run the API, so it can be removed once the confirmed validation rules live in backend code.
