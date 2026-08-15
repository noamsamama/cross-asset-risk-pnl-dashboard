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
import GrossNotionalByProductChart from "./GrossNotionalByProductChart";
import PnlByBookChart from "./PnlByBookChart";
import PnlHistoryChart from "./PnlHistoryChart";
import TradeGrid, { type Trade } from "./TradeGrid";
import TradesByProductChart from "./TradesByProductChart";

type QualityIssue = {
  severity: "ERROR" | "WARNING";
  code: string;
  count: number;
  entity_ids: string[];
  message: string;
};

type TradesResponse = {
  as_of_date: string;
  count: number;
  issues: QualityIssue[];
  fx_rates: { ccy_pair: string; spot_rate: number }[];
  trades: Trade[];
};

type PnlResponse = {
  issues: QualityIssue[];
  by_book: { book_id: string; pnl_usd: number }[];
  history: { date: string; pnl_usd: number }[];
};

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
            }}
          >
            <PnlByBookChart
              asOfDate={data.as_of_date}
              data={pnlData?.by_book}
              error={pnlError}
            />
            <PnlHistoryChart data={pnlData?.history} error={pnlError} />
          </Box>

          <Divider sx={{ my: 3 }} />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: "repeat(2, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            <TradesByProductChart trades={visibleTrades ?? []} />
            <GrossNotionalByProductChart
              trades={visibleTrades ?? []}
              fxRates={data.fx_rates}
            />
          </Box>

          <Divider sx={{ my: 3 }} />

          <TradeGrid trades={visibleTrades ?? []} />
        </>
      )}
    </Container>
  );
}
