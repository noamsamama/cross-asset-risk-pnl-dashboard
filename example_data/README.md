# Synthetic example extracts

Every CSV in this directory is deterministic, independently simulated test data. It contains no operational identifiers or values and must not be used for trading, valuation, limits, controls, or financial decisions.

The API uses these files only when one or more required extracts are missing from `data/`. Dataset selection is all-or-nothing, so operational and example files are never mixed.

Regenerate the files with `notebooks/generate_example_data.ipynb`. The notebook reads only the original CSV column headers as a schema contract; its saved outputs are intentionally cleared.
