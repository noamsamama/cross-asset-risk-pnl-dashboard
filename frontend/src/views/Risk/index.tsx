import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import DashboardFilters, {
  type TradeFilters,
} from "../../components/DashboardFilters";
import RiskByBookChart from "./RiskByBookChart";
import RiskGrid from "./RiskGrid";
import RiskSummaryTable from "./RiskSummaryTable";
import type {
  QualityIssue,
  RiskByBook,
  RiskMetric,
  RiskResponse,
  RiskSensitivity,
} from "./riskData";

const emptyTradeFilters: TradeFilters = {
  trader: "",
  book: "",
  product: "",
  currency: "",
};

type RiskAccumulator = RiskMetric & { tradeIds: Set<string> };
type BookAccumulator = RiskByBook & { tradeIds: Set<string> };

function aggregateRisk(
  sensitivities: RiskSensitivity[],
  metricDefinitions: RiskMetric[],
) {
  const metrics = new Map<string, RiskAccumulator>(
    metricDefinitions.map((metric) => [
      metric.risk_metric,
      {
        ...metric,
        net_value: 0,
        gross_value: 0,
        trade_count: 0,
        tradeIds: new Set<string>(),
      },
    ]),
  );
  const books = new Map<string, BookAccumulator>();

  sensitivities.forEach((sensitivity) => {
    const metric = metrics.get(sensitivity.risk_metric);
    if (!metric) return;
    metric.net_value += sensitivity.value_usd;
    metric.gross_value += Math.abs(sensitivity.value_usd);
    metric.tradeIds.add(sensitivity.trade_id);

    const key = `${sensitivity.book_id}-${sensitivity.risk_metric}`;
    const book = books.get(key) ?? {
      book_id: sensitivity.book_id,
      risk_metric: sensitivity.risk_metric,
      display_unit: sensitivity.display_unit,
      net_value: 0,
      gross_value: 0,
      trade_count: 0,
      tradeIds: new Set<string>(),
    };
    book.net_value += sensitivity.value_usd;
    book.gross_value += Math.abs(sensitivity.value_usd);
    book.tradeIds.add(sensitivity.trade_id);
    books.set(key, book);
  });

  return {
    metrics: [...metrics.values()].map(({ tradeIds, ...metric }) => ({
      ...metric,
      trade_count: tradeIds.size,
    })),
    byBook: [...books.values()]
      .map(({ tradeIds, ...book }) => ({
        ...book,
        trade_count: tradeIds.size,
      }))
      .sort(
        (left, right) =>
          left.book_id.localeCompare(right.book_id) ||
          left.risk_metric.localeCompare(right.risk_metric),
      ),
  };
}

export default function RiskView() {
  const [data, setData] = useState<RiskResponse>();
  const [error, setError] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<QualityIssue>();
  const [filters, setFilters] = useState<TradeFilters>(emptyTradeFilters);

  useEffect(() => {
    fetch("/api/risk")
      .then((response) => {
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        return response.json();
      })
      .then(setData)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  const issueSensitivities = selectedIssue
    ? data?.sensitivities.filter((sensitivity) =>
        selectedIssue.entity_ids.includes(sensitivity.trade_id),
      )
    : data?.sensitivities;
  const visibleSensitivities = (issueSensitivities ?? []).filter(
    (sensitivity) =>
      (!filters.trader || sensitivity.trader_id === filters.trader) &&
      (!filters.book || sensitivity.book_id === filters.book) &&
      (!filters.product || sensitivity.product_type === filters.product) &&
      (!filters.currency || sensitivity.currency === filters.currency),
  );
  const visibleRisk = data
    ? aggregateRisk(visibleSensitivities, data.by_metric)
    : undefined;
  const visibleTradeCount = new Set(
    visibleSensitivities.map((sensitivity) => sensitivity.trade_id),
  ).size;

  return (
    <Container component="main" maxWidth={false} sx={{ py: 3 }}>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Box>
          <Typography variant="h4">Risk</Typography>
          <Typography color="text.secondary">
            {data
              ? `As of ${data.as_of_date} · computed ${new Date(
                  data.computed_at,
                ).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "UTC",
                })} UTC`
              : "Loading risk…"}
          </Typography>
        </Box>
        {data && (
          <Chip
            label={`${visibleTradeCount} of ${data.trade_count} trades · ${visibleSensitivities.length} sensitivities`}
          />
        )}
      </Stack>

      {error && <Alert severity="error">Could not load risk: {error}</Alert>}

      {data && (
        <>
          <Stack spacing={1} sx={{ mb: data.issues.length ? 2 : 0 }}>
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
          </Stack>

          {selectedIssue && (
            <Chip
              label={`Filtered by ${selectedIssue.code}`}
              onDelete={() => setSelectedIssue(undefined)}
              sx={{ mb: 2 }}
            />
          )}

          <DashboardFilters
            positions={data.sensitivities}
            value={filters}
            onChange={setFilters}
          />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: "minmax(0, 1.2fr) minmax(440px, 0.8fr)",
              },
              gap: 2,
            }}
          >
            <RiskByBookChart
              metrics={visibleRisk?.metrics ?? []}
              byBook={visibleRisk?.byBook ?? []}
            />
            <RiskSummaryTable metrics={visibleRisk?.metrics ?? []} />
          </Box>

          <Divider sx={{ my: 3 }} />

          <RiskGrid sensitivities={visibleSensitivities ?? []} />
        </>
      )}
    </Container>
  );
}
