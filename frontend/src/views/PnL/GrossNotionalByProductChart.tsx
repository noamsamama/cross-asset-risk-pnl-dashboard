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
  const net = trades.reduce(
    (sum, trade) => sum + (trade.net_notional_usd ?? 0),
    0,
  );
  const unavailable = trades.filter(
    (trade) => trade.gross_notional_usd === null,
  ).length;

  return (
    <Paper variant="outlined" sx={{ height: "100%", p: 2 }}>
      <Typography variant="h6">Gross notional by product</Typography>
      <Typography variant="body2" color="text.secondary">
        USD millions · Net {`${(net / 1_000_000).toFixed(1)}m`}
        {unavailable
          ? ` · ${unavailable} equity trades have no equivalent-notional input`
          : ""}
      </Typography>

      <Box>
        <ProductDonut data={data} total={(total / 1_000_000).toFixed(1)} />

        <Box sx={{ mt: 1 }}>
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
              display: "flex",
              flexWrap: "wrap",
              columnGap: 2,
              rowGap: 0.5,
            }}
          >
            {fxRates.map((rate) => (
              <Box key={rate.ccy_pair} sx={{ display: "flex", gap: 0.75 }}>
                <Typography variant="caption" color="text.secondary">
                  {rate.ccy_pair.replace(/(.{3})(.{3})/, "$1/$2")}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
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
