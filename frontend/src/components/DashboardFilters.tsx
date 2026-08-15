import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
} from "@mui/material";

export type FilterableTrade = {
  trade_id: string;
  trader_id: string;
  book_id: string;
  product_type: string;
  currency: string;
};

export type TradeFilters = {
  trader: string;
  book: string;
  product: string;
  currency: string;
};

const emptyTradeFilters: TradeFilters = {
  trader: "",
  book: "",
  product: "",
  currency: "",
};

const unique = (values: string[]) => [...new Set(values)].sort();
const productLabel = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

function matchesFilters(
  trade: FilterableTrade,
  filters: TradeFilters,
  ignored: keyof TradeFilters,
) {
  return (
    (ignored === "trader" ||
      !filters.trader ||
      trade.trader_id === filters.trader) &&
    (ignored === "book" || !filters.book || trade.book_id === filters.book) &&
    (ignored === "product" ||
      !filters.product ||
      trade.product_type === filters.product) &&
    (ignored === "currency" ||
      !filters.currency ||
      trade.currency === filters.currency)
  );
}

function countedOptions(
  positions: FilterableTrade[],
  field: "book" | "product" | "currency",
  filters: TradeFilters,
) {
  const sourceField = {
    book: "book_id",
    product: "product_type",
    currency: "currency",
  }[field] as "book_id" | "product_type" | "currency";
  const counts = new Map(
    unique(positions.map((trade) => trade[sourceField])).map((option) => [
      option,
      new Set<string>(),
    ]),
  );

  positions
    .filter((trade) => matchesFilters(trade, filters, field))
    .forEach((trade) => counts.get(trade[sourceField])?.add(trade.trade_id));

  return [...counts].map(([option, tradeIds]) => ({
    option,
    count: tradeIds.size,
  }));
}

export default function DashboardFilters({
  positions,
  value,
  onChange,
}: {
  positions: FilterableTrade[];
  value: TradeFilters;
  onChange: (filters: TradeFilters) => void;
}) {
  const active = Object.values(value).some(Boolean);
  const books = countedOptions(positions, "book", value);
  const products = countedOptions(positions, "product", value);
  const currencies = countedOptions(positions, "currency", value);

  return (
    <Paper
      variant="outlined"
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, 1fr)",
          lg: "repeat(4, minmax(140px, 1fr)) auto",
        },
        gap: 1.5,
        alignItems: "center",
        p: 2,
        mb: 2,
      }}
    >
      <FormControl size="small">
        <InputLabel id="trader-filter-label">Trader</InputLabel>
        <Select
          labelId="trader-filter-label"
          label="Trader"
          value={value.trader}
          onChange={(event) =>
            onChange({ ...value, trader: event.target.value })
          }
        >
          <MenuItem value="">All traders</MenuItem>
          {unique(positions.map((trade) => trade.trader_id)).map((trader) => (
            <MenuItem key={trader} value={trader}>
              {trader}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small">
        <InputLabel id="book-filter-label">Book</InputLabel>
        <Select
          labelId="book-filter-label"
          label="Book"
          value={value.book}
          onChange={(event) => onChange({ ...value, book: event.target.value })}
        >
          <MenuItem value="">All books</MenuItem>
          {books.map(({ option, count }) => (
            <MenuItem key={option} value={option}>
              {option.replace(/-01$/, "")} ({count})
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small">
        <InputLabel id="product-filter-label">Product</InputLabel>
        <Select
          labelId="product-filter-label"
          label="Product"
          value={value.product}
          onChange={(event) =>
            onChange({ ...value, product: event.target.value })
          }
        >
          <MenuItem value="">All products</MenuItem>
          {products.map(({ option, count }) => (
            <MenuItem key={option} value={option}>
              {productLabel(option)} ({count})
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small">
        <InputLabel id="currency-filter-label">CCY</InputLabel>
        <Select
          labelId="currency-filter-label"
          label="CCY"
          value={value.currency}
          onChange={(event) =>
            onChange({ ...value, currency: event.target.value })
          }
        >
          <MenuItem value="">All currencies</MenuItem>
          {currencies.map(({ option, count }) => (
            <MenuItem key={option} value={option}>
              {option} ({count})
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Button
        disabled={!active}
        onClick={() => onChange(emptyTradeFilters)}
        sx={{ whiteSpace: "nowrap" }}
      >
        Clear filters
      </Button>
    </Paper>
  );
}
