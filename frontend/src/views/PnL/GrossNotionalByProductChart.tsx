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
  const data = groupByProduct(
    trades,
    (trade) => trade.gross_notional_usd / 1_000_000,
    1,
  );
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Paper variant="outlined" sx={{ height: "100%", p: 2 }}>
      <Typography variant="h6">Gross notional by product (m USD)</Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) auto" },
          alignItems: "center",
          columnGap: 5,
        }}
      >
        <ProductDonut data={data} total={total.toFixed(1)} />

        <Box sx={{ minWidth: 170 }}>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mb: 0.5,
              fontWeight: 700,
              textAlign: { xs: "left", md: "right" },
            }}
          >
            As-of FX rates
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "auto auto",
              justifyContent: { xs: "start", md: "end" },
              columnGap: 2,
              rowGap: 0.25,
            }}
          >
            {fxRates.map((rate) => (
              <Box key={rate.ccy_pair} sx={{ display: "contents" }}>
                <Typography variant="caption" color="text.secondary">
                  {rate.ccy_pair.replace(/(.{3})(.{3})/, "$1/$2")}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    textAlign: "right",
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
