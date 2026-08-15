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

const emptyTradeFilters: TradeFilters = {
  trader: "",
  book: "",
  product: "",
  currency: "",
};

type PnlContribution = {
  date: string;
  trade_id: string;
  pnl_usd: number;
};

type PnlResponse = {
  issues: QualityIssue[];
  contributions: PnlContribution[];
};

function aggregatePnl(
  contributions: PnlContribution[],
  trades: Trade[],
  asOfDate: string,
) {
  const selectedTrades = new Map(
    trades.map((trade) => [trade.trade_id, trade]),
  );
  const byBook = new Map<string, number>();
  const history = new Map<string, number>();

  contributions.forEach((point) => {
    const trade = selectedTrades.get(point.trade_id);
    if (!trade) return;

    history.set(point.date, (history.get(point.date) ?? 0) + point.pnl_usd);
    if (point.date === asOfDate) {
      byBook.set(
        trade.book_id,
        (byBook.get(trade.book_id) ?? 0) + point.pnl_usd,
      );
    }
  });

  return {
    byBook: [...byBook]
      .map(([book_id, pnl_usd]) => ({ book_id, pnl_usd }))
      .sort((left, right) => left.book_id.localeCompare(right.book_id)),
    history: [...history]
      .map(([date, pnl_usd]) => ({ date, pnl_usd }))
      .sort((left, right) => left.date.localeCompare(right.date)),
  };
}

export default function PnlView() {
  const [data, setData] = useState<TradesResponse>();
  const [pnlData, setPnlData] = useState<PnlResponse>();
  const [error, setError] = useState("");
  const [pnlError, setPnlError] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<QualityIssue>();
  const [filters, setFilters] = useState<TradeFilters>(emptyTradeFilters);

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

  const issueTrades = selectedIssue
    ? data?.trades.filter((trade) =>
        selectedIssue.entity_ids.includes(trade.trade_id),
      )
    : data?.trades;
  const visibleTrades = (issueTrades ?? []).filter(
    (trade) =>
      (!filters.trader || trade.trader_id === filters.trader) &&
      (!filters.book || trade.book_id === filters.book) &&
      (!filters.product || trade.product_type === filters.product) &&
      (!filters.currency || trade.currency === filters.currency),
  );
  const visiblePnl =
    data && pnlData
      ? aggregatePnl(pnlData.contributions, visibleTrades, data.as_of_date)
      : undefined;
  return (
    <Container component="main" maxWidth={false} sx={{ py: 3 }}>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Box>
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

          <DashboardFilters
            positions={data.trades}
            value={filters}
            onChange={setFilters}
          />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "repeat(2, 1fr)" },
              gap: 2,
            }}
          >
            <PnlByBookChart
              asOfDate={data.as_of_date}
              data={visiblePnl?.byBook}
              error={pnlError}
            />
            <PnlHistoryChart data={visiblePnl?.history} error={pnlError} />
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
