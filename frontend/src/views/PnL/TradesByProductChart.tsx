import { Paper, Typography } from "@mui/material";
import ProductDonut from "./ProductDonut";
import { groupByProduct, type ProductTrade } from "./productMix";

export default function TradesByProductChart({
  trades,
}: {
  trades: ProductTrade[];
}) {
  const data = groupByProduct(trades, () => 1);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Paper variant="outlined" sx={{ height: "100%", p: 2 }}>
      <Typography variant="h6">Trades by product</Typography>
      <ProductDonut
        data={data}
        total={total.toLocaleString()}
        totalLabel="trades"
      />
    </Paper>
  );
}
