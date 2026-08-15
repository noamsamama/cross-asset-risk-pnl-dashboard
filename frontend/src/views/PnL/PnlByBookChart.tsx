import { Alert, Box, Paper, Typography } from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type BookPnl = {
  book_id: string;
  pnl_usd: number;
};

export default function PnlByBookChart({
  asOfDate,
  data,
  error,
}: {
  asOfDate?: string;
  data?: BookPnl[];
  error: string;
}) {
  const chartData = (data ?? []).map((book) => ({
    book: book.book_id.replace("-ASIA-01", ""),
    pnl: Number((book.pnl_usd / 1_000).toFixed(1)),
  }));

  return (
    <Paper variant="outlined" sx={{ height: "100%", minHeight: 320, p: 2 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 2,
        }}
      >
        <Typography variant="h6">
          1d explained P&amp;L by book (k USD)
        </Typography>
        {asOfDate && (
          <Typography variant="body2" color="text.secondary">
            As of {asOfDate}
          </Typography>
        )}
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      {!data && !error && (
        <Typography color="text.secondary">
          Loading explained P&amp;L…
        </Typography>
      )}
      {data?.length === 0 && (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          No as-of explained P&amp;L for the selected positions.
        </Typography>
      )}
      {data && data.length > 0 && (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 16, right: 16, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="book" tick={{ fontSize: 12 }} />
            <YAxis width={65} tick={{ fontSize: 12 }} />
            <Tooltip />
            <ReferenceLine y={0} stroke="#616161" />
            <Bar
              dataKey="pnl"
              name="Explained P&L (k USD)"
              isAnimationActive={false}
            >
              {chartData.map((book) => (
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
  );
}
