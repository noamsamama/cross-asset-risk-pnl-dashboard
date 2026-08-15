import { Box, Paper, Typography } from "@mui/material";
import ProductDonut from "./ProductDonut";
import { groupByProduct, type FxRate, type ProductTrade } from "./productMix";

export default function GrossNotionalByProductChart({
  trades,
  fxRates,
}: {
  trades: ProductTrade[];
  fxRates: FxRate[];
}) {
  const data = groupByProduct(trades, (trade) =>
    trade.gross_notional_usd === null
      ? null
      : trade.gross_notional_usd / 1_000_000,
  );
  const total = trades.reduce(
    (sum, trade) => sum + (trade.gross_notional_usd ?? 0),
    0,
  );
  const unavailable = trades.filter(
    (trade) => trade.gross_notional_usd === null,
  ).length;

  return (
    <Paper variant="outlined" sx={{ height: "100%", p: 2 }}>
      <Typography variant="h6">Gross notional by product</Typography>
      <Typography variant="body2" color="text.secondary">
        USD millions
        {unavailable
          ? ` · ${unavailable} equity positions excluded: equivalent notional unavailable`
          : ""}
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            xl: "minmax(0, 1fr) auto",
          },
          alignItems: "center",
          gap: { xs: 1, xl: 3 },
        }}
      >
        <ProductDonut
          data={data}
          total={(total / 1_000_000).toFixed(1)}
          totalLabel="USD m"
        />

        <Box sx={{ minWidth: { xl: 150 } }}>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mb: 0.5,
              fontWeight: 700,
            }}
          >
            FX rates used
          </Typography>
          <Box
            sx={{
              display: { xs: "flex", xl: "grid" },
              flexWrap: { xs: "wrap" },
              gridTemplateColumns: { xl: "auto auto" },
              columnGap: 2,
              rowGap: 0.5,
            }}
          >
            {fxRates.map((rate) => (
              <Box
                key={rate.ccy_pair}
                sx={{ display: { xs: "flex", xl: "contents" }, gap: 0.75 }}
              >
                <Typography variant="caption" color="text.secondary">
                  {rate.ccy_pair.replace(/(.{3})(.{3})/, "$1/$2")}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    textAlign: { xl: "right" },
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {rate.spot_rate.toLocaleString("en-US", {
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 4,
                  })}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}
