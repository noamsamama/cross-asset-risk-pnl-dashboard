import { useState } from "react";
import {
  Box,
  FormControl,
  MenuItem,
  Paper,
  Select,
  Typography,
} from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatRiskValue,
  metricLabels,
  type RiskByBook,
  type RiskMetric,
} from "./riskData";

export default function RiskByBookChart({
  metrics,
  byBook,
}: {
  metrics: RiskMetric[];
  byBook: RiskByBook[];
}) {
  const [selectedMetric, setSelectedMetric] = useState(
    metrics[0]?.risk_metric ?? "",
  );
  const metric = metrics.find((item) => item.risk_metric === selectedMetric);
  const chartData = byBook
    .filter((item) => item.risk_metric === selectedMetric)
    .map((item) => ({
      book: item.book_id.replace("-ASIA-01", ""),
      net: item.net_value,
      gross: item.gross_value,
    }));

  return (
    <Paper variant="outlined" sx={{ height: "100%", minHeight: 360, p: 2 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Typography variant="h6">
          Risk by book{metric ? ` (${metric.display_unit})` : ""}
        </Typography>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <Select
            aria-label="Risk metric"
            value={selectedMetric}
            onChange={(event) => setSelectedMetric(event.target.value)}
          >
            {metrics.map((item) => (
              <MenuItem key={item.risk_metric} value={item.risk_metric}>
                {metricLabels[item.risk_metric] ?? item.risk_metric}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 20, right: 16, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="book" tick={{ fontSize: 12 }} />
          <YAxis
            width={70}
            tick={{ fontSize: 12 }}
            tickFormatter={formatRiskValue}
          />
          <Tooltip
            formatter={(value) => formatRiskValue(Number(value))}
            labelFormatter={(book) => `${book} book`}
          />
          <Legend />
          <ReferenceLine y={0} stroke="#616161" />
          <Bar
            dataKey="gross"
            name="Gross"
            fill="#90a4ae"
            isAnimationActive={false}
          />
          <Bar dataKey="net" name="Net" isAnimationActive={false}>
            {chartData.map((item) => (
              <Cell
                key={item.book}
                fill={item.net >= 0 ? "#2e7d32" : "#d32f2f"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
}
