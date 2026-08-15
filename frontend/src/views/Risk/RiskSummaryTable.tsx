import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { formatRiskValue, metricLabels, type RiskMetric } from "./riskData";

export default function RiskSummaryTable({
  metrics,
}: {
  metrics: RiskMetric[];
}) {
  return (
    <Paper variant="outlined" sx={{ height: "100%", p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Desk risk summary
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Metric</TableCell>
              <TableCell align="right">Net</TableCell>
              <TableCell align="right">Gross</TableCell>
              <TableCell align="right">Trades</TableCell>
              <TableCell>Unit</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {metrics.map((metric) => (
              <TableRow key={metric.risk_metric}>
                <TableCell>
                  {metricLabels[metric.risk_metric] ?? metric.risk_metric}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    color:
                      metric.net_value >= 0 ? "success.main" : "error.main",
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatRiskValue(metric.net_value)}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatRiskValue(metric.gross_value)}
                </TableCell>
                <TableCell align="right">{metric.trade_count}</TableCell>
                <TableCell>{metric.display_unit}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
