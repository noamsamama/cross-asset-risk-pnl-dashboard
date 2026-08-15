export type ProductTrade = {
  product_type: string;
  gross_notional_usd: number | null;
  net_notional_usd: number | null;
};

export type FxRate = {
  ccy_pair: string;
  spot_rate: number;
};

export type ProductSlice = {
  product: string;
  label: string;
  name: string;
  value: number;
  percentage: number;
};

export const productStyles: Record<string, { label: string; color: string }> = {
  IRS: { label: "IRS", color: "#1565c0" },
  GOVT_BOND: { label: "Government Bond", color: "#64b5f6" },
  CORP_BOND: { label: "Corporate Bond", color: "#2e7d32" },
  CDS: { label: "CDS", color: "#81c784" },
  FX_SPOT: { label: "FX Spot", color: "#ef6c00" },
  FX_FORWARD: { label: "FX Forward", color: "#fb8c00" },
  FX_NDF: { label: "FX NDF", color: "#ffb74d" },
  EQ_OPTION: { label: "Equity Option", color: "#7b1fa2" },
  EQ_FUTURE: { label: "Equity Future", color: "#ba68c8" },
};

export function groupByProduct(
  trades: ProductTrade[],
  value: (trade: ProductTrade) => number | null,
) {
  const totals = new Map<string, number>();
  trades.forEach((trade) => {
    const amount = value(trade);
    if (amount === null) return;
    totals.set(
      trade.product_type,
      (totals.get(trade.product_type) ?? 0) + amount,
    );
  });

  const positiveTotals = Array.from(totals).filter(([, total]) => total > 0);
  const grandTotal = positiveTotals.reduce((sum, [, total]) => sum + total, 0);
  return positiveTotals.map(([product, total]) => {
    const label = productStyles[product]?.label ?? product.replaceAll("_", " ");
    const percentage = grandTotal ? (total / grandTotal) * 100 : 0;
    return {
      product,
      label,
      name: `${label} · ${percentage.toFixed(1)}%`,
      value: total,
      percentage,
    };
  });
}
