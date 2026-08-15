import { useState } from "react";
import {
  Alert,
  Box,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type HistoryPoint = {
  date: string;
  pnl_usd: number;
};

type Range = 5 | 10 | "all";

export default function PnlHistoryChart({
  data,
  error,
}: {
  data?: HistoryPoint[];
  error: string;
}) {
  const [range, setRange] = useState<Range>("all");
  const visibleData = range === "all" ? data : data?.slice(-range);
  const chartData = (visibleData ?? []).map((point) => ({
    date: point.date.slice(5),
    pnl: Number((point.pnl_usd / 1_000).toFixed(1)),
  }));

  return (
    <Paper variant="outlined" sx={{ height: "100%", minHeight: 320, p: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography variant="h6">P&amp;L history (k USD)</Typography>
        </Box>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={range}
          onChange={(_, next: Range | null) => next !== null && setRange(next)}
        >
          <ToggleButton value={5}>5D</ToggleButton>
          <ToggleButton value={10}>10D</ToggleButton>
          <ToggleButton value="all">1M</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {!data && !error && (
        <Typography color="text.secondary">Loading P&amp;L…</Typography>
      )}
      {data && (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 16, right: 16, left: 8 }}>
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
              name="P&L (USD k)"
              stroke="#1976d2"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
}
