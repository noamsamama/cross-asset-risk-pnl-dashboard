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
  methodology: string;
  coverage: { covered_trades: number; total_trades: number };
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
  const history = new Map<string, { pnl_usd: number; tradeIds: Set<string> }>();
  const coveredAsOf = new Set<string>();

  contributions.forEach((point) => {
    const trade = selectedTrades.get(point.trade_id);
    if (!trade) return;

    const day = history.get(point.date) ?? {
      pnl_usd: 0,
      tradeIds: new Set<string>(),
    };
    day.pnl_usd += point.pnl_usd;
    day.tradeIds.add(point.trade_id);
    history.set(point.date, day);
    if (point.date === asOfDate) {
      coveredAsOf.add(point.trade_id);
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
      .map(([date, day]) => ({
        date,
        pnl_usd: day.pnl_usd,
        covered_trades: day.tradeIds.size,
      }))
      .sort((left, right) => left.date.localeCompare(right.date)),
    coveredTrades: coveredAsOf.size,
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
  const showIssue = (issue: QualityIssue) => {
    setSelectedIssue(issue);
    setFilters(emptyTradeFilters);
  };
  return (
    <Container component="main" maxWidth={false} sx={{ py: 3 }}>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Box>
          <Typography variant="h4">
            Positions &amp; Explained P&amp;L
          </Typography>
          <Typography color="text.secondary">
            {data ? `As of ${data.as_of_date}` : "Loading trades…"}
          </Typography>
          {pnlData && (
            <Typography variant="body2" color="text.secondary">
              Current-sensitivity explained P&amp;L; daily coverage is shown in
              history.
            </Typography>
          )}
        </Box>
        {data && (
          <Chip
            label={
              visiblePnl
                ? `${visiblePnl.coveredTrades} of ${visibleTrades.length} P&L-covered · ${visibleTrades.length} of ${data.count} positions`
                : `${visibleTrades.length} of ${data.count} positions`
            }
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
                    onClick={() => showIssue(issue)}
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
                    onClick={() => showIssue(issue)}
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
            positions={issueTrades ?? []}
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
            <PnlHistoryChart
              data={visiblePnl?.history}
              totalTrades={visibleTrades.length}
              error={pnlError}
            />
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
