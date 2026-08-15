export type QualityIssue = {
  severity: "ERROR" | "WARNING";
  code: string;
  count: number;
  entity_ids: string[];
  message: string;
};

export type RiskMetric = {
  risk_metric: string;
  display_unit: string;
  net_value: number;
  gross_value: number;
  trade_count: number;
};

export type RiskByBook = RiskMetric & {
  book_id: string;
};

export type RiskSensitivity = {
  trade_id: string;
  book_id: string;
  asset_class: string;
  product_type: string;
  instrument_id: string;
  instrument_description: string;
  risk_metric: string;
  value_usd: number;
  display_unit: string;
};

export type RiskResponse = {
  as_of_date: string;
  computed_at: string;
  sensitivity_count: number;
  trade_count: number;
  issues: QualityIssue[];
  by_metric: RiskMetric[];
  by_book: RiskByBook[];
  sensitivities: RiskSensitivity[];
};

export const metricLabels: Record<string, string> = {
  DV01: "DV01",
  Duration: "Duration",
  Spread01: "Spread01",
  CS01_USD: "CS01",
  JTD_USD: "JTD",
  Delta_USD: "Delta",
  Gamma_USD: "Gamma",
  Vega_USD: "Vega",
  Theta_USD: "Theta",
};

export function formatRiskValue(value: number) {
  return Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}
