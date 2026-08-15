import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type QualityIssue = {
  severity: "ERROR" | "WARNING";
  code: string;
  count: number;
  entity_ids: string[];
  message: string;
};

type Trade = {
  trade_id: string;
  book_id: string;
  trader_id: string;
  trade_date: string;
  asset_class: string;
  product_type: string;
  instrument_description: string;
  currency: string;
  notional: number;
  gross_notional_usd: number;
  direction: string;
  maturity_date: string;
};

type TradesResponse = {
  as_of_date: string;
  count: number;
  issues: QualityIssue[];
  fx_rates: { ccy_pair: string; spot_rate: number }[];
  trades: Trade[];
};

type PnlResponse = {
  as_of_date: string;
  methodology: string;
  coverage: { covered_trades: number; total_trades: number };
  issues: QualityIssue[];
  by_book: { book_id: string; pnl_usd: number }[];
  history: { date: string; pnl_usd: number }[];
};

const columns: GridColDef<Trade>[] = [
  { field: "trade_id", headerName: "Trade", width: 105 },
  { field: "book_id", headerName: "Book", width: 105 },
  { field: "trader_id", headerName: "Trader", width: 100 },
  { field: "asset_class", headerName: "Asset class", width: 115 },
  { field: "product_type", headerName: "Product", width: 120 },
  {
    field: "instrument_description",
    headerName: "Instrument",
    flex: 1,
    minWidth: 220,
  },
  { field: "currency", headerName: "CCY", width: 75 },
  { field: "notional", headerName: "Notional", type: "number", width: 140 },
  { field: "direction", headerName: "Direction", width: 105 },
  { field: "maturity_date", headerName: "Maturity", width: 115 },
];

const chartColors = [
  "#1976d2",
  "#9c27b0",
  "#2e7d32",
  "#ed6c02",
  "#d32f2f",
  "#0288d1",
  "#6d4c41",
  "#757575",
  "#5e35b1",
];

function groupByProduct(trades: Trade[], value: (trade: Trade) => number) {
  const totals = new Map<string, number>();
  trades.forEach((trade) => {
    totals.set(
      trade.product_type,
      (totals.get(trade.product_type) ?? 0) + value(trade),
    );
  });
  return Array.from(totals, ([name, total]) => ({ name, value: total }));
}

export default function PnlView() {
  const [data, setData] = useState<TradesResponse>();
  const [pnlData, setPnlData] = useState<PnlResponse>();
  const [error, setError] = useState("");
  const [pnlError, setPnlError] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<QualityIssue>();

  useEffect(() => {
    fetch("/api/trades")
      .then((response) => {
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        return response.json();
      })
      .then(setData)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    fetch("/api/pnl")
      .then((response) => {
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        return response.json();
      })
      .then(setPnlData)
      .catch((reason: Error) => setPnlError(reason.message));
  }, []);

  const visibleTrades = selectedIssue
    ? data?.trades.filter((trade) =>
        selectedIssue.entity_ids.includes(trade.trade_id),
      )
    : data?.trades;
  const tradeCountByProduct = groupByProduct(visibleTrades ?? [], () => 1);
  const notionalByProduct = groupByProduct(
    visibleTrades ?? [],
    (trade) => trade.gross_notional_usd / 1_000_000,
  );
  const pnlByBook = (pnlData?.by_book ?? []).map((book) => ({
    book: book.book_id.replace("-ASIA-01", ""),
    pnl: Number((book.pnl_usd / 1_000).toFixed(1)),
  }));
  const pnlHistory = (pnlData?.history ?? []).map((point) => ({
    date: point.date.slice(5),
    pnl: Number((point.pnl_usd / 1_000).toFixed(1)),
  }));

  return (
    <Container component="main" maxWidth={false} sx={{ py: 3 }}>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Box>
          <Typography variant="h4">Positions &amp; P&amp;L</Typography>
          <Typography color="text.secondary">
            {data ? `As of ${data.as_of_date}` : "Loading trades…"}
          </Typography>
        </Box>
        {data && (
          <Chip
            label={`${visibleTrades?.length ?? 0} of ${data.count} trades`}
          />
        )}
      </Stack>

      {error && <Alert severity="error">Could not load trades: {error}</Alert>}

      {data && (
        <>
          <Stack spacing={1} sx={{ mb: 2 }}>
            {data.issues.map((issue) => (
              <Alert
                key={issue.code}
                severity={issue.severity === "ERROR" ? "error" : "warning"}
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => setSelectedIssue(issue)}
                  >
                    View trades
                  </Button>
                }
              >
                {issue.message} ({issue.count})
              </Alert>
            ))}
            {pnlData?.issues.map((issue) => (
              <Alert
                key={issue.code}
                severity="warning"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => setSelectedIssue(issue)}
                  >
                    View trades
                  </Button>
                }
              >
                {issue.message} ({issue.count})
              </Alert>
            ))}
          </Stack>

          {selectedIssue && (
            <Chip
              label={`Filtered by ${selectedIssue.code}`}
              onDelete={() => setSelectedIssue(undefined)}
              sx={{ mb: 2 }}
            />
          )}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "repeat(2, 1fr)" },
              gap: 2,
              mb: 3,
            }}
          >
            <Paper variant="outlined" sx={{ p: 2, minHeight: 320 }}>
              <Typography variant="h6">
                Estimated 1-day explained P&amp;L by book
              </Typography>
              <Typography color="text.secondary">USD thousands</Typography>
              {pnlError && <Alert severity="error">{pnlError}</Alert>}
              {!pnlData && !pnlError && (
                <Typography color="text.secondary">Loading P&amp;L…</Typography>
              )}
              {pnlData && (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={pnlByBook}
                    margin={{ top: 16, right: 16, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="book" tick={{ fontSize: 12 }} />
                    <YAxis width={65} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <ReferenceLine y={0} stroke="#616161" />
                    <Bar dataKey="pnl" name="P&L (USDk)">
                      {pnlByBook.map((book) => (
                        <Cell
                          key={book.book}
                          fill={book.pnl >= 0 ? "#2e7d32" : "#d32f2f"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, minHeight: 320 }}>
              <Typography variant="h6">Explained P&amp;L history</Typography>
              <Typography color="text.secondary">
                Daily · USD thousands
              </Typography>
              {pnlError && <Alert severity="error">{pnlError}</Alert>}
              {!pnlData && !pnlError && (
                <Typography color="text.secondary">Loading P&amp;L…</Typography>
              )}
              {pnlData && (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart
                    data={pnlHistory}
                    margin={{ top: 16, right: 16, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      interval="preserveStartEnd"
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis width={65} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <ReferenceLine y={0} stroke="#616161" />
                    <Line
                      type="linear"
                      dataKey="pnl"
                      name="P&L (USDk)"
                      stroke="#1976d2"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Box>

          {pnlData && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 3 }}
            >
              Coverage: {pnlData.coverage.covered_trades}/
              {pnlData.coverage.total_trades} trades. {pnlData.methodology}
            </Typography>
          )}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "repeat(2, 1fr)" },
              gap: 2,
              mb: 3,
            }}
          >
            <Paper variant="outlined" sx={{ p: 2, minHeight: 320 }}>
              <Typography variant="h6">Trades by product</Typography>
              <Typography color="text.secondary">Number of trades</Typography>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={tradeCountByProduct}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={0}
                    stroke="none"
                  >
                    {tradeCountByProduct.map((item, index) => (
                      <Cell
                        key={item.name}
                        fill={chartColors[index % chartColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, minHeight: 320 }}>
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", gap: 2 }}
              >
                <Box>
                  <Typography variant="h6">
                    Gross notional by product
                  </Typography>
                  <Typography color="text.secondary">USD millions</Typography>
                </Box>
                <Box sx={{ maxWidth: "58%", textAlign: "right" }}>
                  <Typography
                    variant="caption"
                    sx={{ display: "block", fontWeight: 700 }}
                  >
                    As-of FX rates
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {data.fx_rates
                      .map(
                        (rate) =>
                          `${rate.ccy_pair} ${rate.spot_rate.toLocaleString(undefined, { maximumFractionDigits: 4 })}`,
                      )
                      .join(" · ")}
                  </Typography>
                </Box>
              </Stack>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={notionalByProduct}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={0}
                    stroke="none"
                  >
                    {notionalByProduct.map((item, index) => (
                      <Cell
                        key={item.name}
                        fill={chartColors[index % chartColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Box>

          <Typography variant="h6" sx={{ mb: 1 }}>
            Trade blotter
          </Typography>
          <DataGrid
            rows={visibleTrades ?? []}
            columns={columns}
            getRowId={(trade) => trade.trade_id}
            initialState={{ pagination: { paginationModel: { pageSize: 40 } } }}
            pageSizeOptions={[40, 200]}
            disableRowSelectionOnClick
          />
        </>
      )}
    </Container>
  );
}
