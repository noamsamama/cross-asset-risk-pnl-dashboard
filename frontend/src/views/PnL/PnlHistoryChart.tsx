import { useState } from "react";
import {
  Alert,
  Box,
  Paper,
  TextField,
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
  const [fromDate, setFromDate] = useState("");
  const visibleData = fromDate
    ? data?.filter((point) => point.date >= fromDate)
    : range === "all"
      ? data
      : data?.slice(-range);
  const chartData = (visibleData ?? []).map((point) => ({
    date: point.date.slice(5),
    pnl: Number((point.pnl_usd / 1_000).toFixed(1)),
  }));

  return (
    <Paper variant="outlined" sx={{ height: "100%", minHeight: 320, p: 2 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Box>
          <Typography variant="h6">Daily explained P&amp;L</Typography>
          <Typography variant="body2" color="text.secondary">
            USD thousands
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={fromDate ? null : range}
            onChange={(_, next: Range | null) => {
              if (next === null) return;
              setRange(next);
              setFromDate("");
            }}
          >
            <ToggleButton value={5}>5D</ToggleButton>
            <ToggleButton value={10}>10D</ToggleButton>
            <ToggleButton value="all">1M</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            label="From"
            type="date"
            size="small"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: {
                min: data?.at(0)?.date,
                max: data?.at(-1)?.date,
                "aria-label": "Show P&L from date",
              },
            }}
            sx={{ width: 150 }}
          />
        </Box>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {!data && !error && (
        <Typography color="text.secondary">
          Loading explained P&amp;L…
        </Typography>
      )}
      {visibleData?.length === 0 && (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          No explained P&amp;L in the selected date range.
        </Typography>
      )}
      {visibleData && visibleData.length > 0 && (
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
              name="Explained P&L (USD k)"
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
