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
  const effectiveMetric = metrics.some(
    (item) => item.risk_metric === selectedMetric,
  )
    ? selectedMetric
    : (metrics[0]?.risk_metric ?? "");
  const metric = metrics.find((item) => item.risk_metric === effectiveMetric);
  const chartData = byBook
    .filter((item) => item.risk_metric === effectiveMetric)
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
        <Box>
          <Typography variant="h6">
            {metric
              ? `${metricLabels[metric.risk_metric] ?? metric.risk_metric} by book`
              : "Risk by book"}
          </Typography>
          {metric && (
            <Typography variant="body2" color="text.secondary">
              {metric.display_unit}
            </Typography>
          )}
        </Box>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <Select
            aria-label="Risk metric"
            value={effectiveMetric}
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

      {chartData.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          No additive risk for the selected positions.
        </Typography>
      ) : (
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
      )}
    </Paper>
  );
}
