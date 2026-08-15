import { Alert, AlertTitle } from "@mui/material";

export default function DemoDataBanner({ notice }: { notice?: string | null }) {
  return (
    <Alert severity="success" sx={{ mb: 2 }}>
      <AlertTitle>Demo mode — synthetic test data</AlertTitle>
      {notice ??
        "These are not real positions, market data, P&L or risk. Do not use them for trading or control decisions."}
    </Alert>
  );
}
