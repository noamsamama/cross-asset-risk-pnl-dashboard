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
import RiskByBookChart from "./RiskByBookChart";
import RiskGrid from "./RiskGrid";
import RiskSummaryTable from "./RiskSummaryTable";
import type { QualityIssue, RiskResponse } from "./riskData";

export default function RiskView() {
  const [data, setData] = useState<RiskResponse>();
  const [error, setError] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<QualityIssue>();

  useEffect(() => {
    fetch("/api/risk")
      .then((response) => {
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        return response.json();
      })
      .then(setData)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  const visibleSensitivities = selectedIssue
    ? data?.sensitivities.filter((sensitivity) =>
        selectedIssue.entity_ids.includes(sensitivity.trade_id),
      )
    : data?.sensitivities;

  return (
    <Container component="main" maxWidth={false} sx={{ py: 3 }}>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Box>
          <Typography variant="h4">Risk</Typography>
          <Typography color="text.secondary">
            {data
              ? `As of ${data.as_of_date} · computed ${new Date(
                  data.computed_at,
                ).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "UTC",
                })} UTC`
              : "Loading risk…"}
          </Typography>
        </Box>
        {data && (
          <Chip
            label={`${data.trade_count} trades · ${data.sensitivity_count} sensitivities`}
          />
        )}
      </Stack>

      {error && <Alert severity="error">Could not load risk: {error}</Alert>}

      {data && (
        <>
          <Stack spacing={1} sx={{ mb: data.issues.length ? 2 : 0 }}>
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
              gridTemplateColumns: {
                xs: "1fr",
                lg: "minmax(0, 1.2fr) minmax(440px, 0.8fr)",
              },
              gap: 2,
            }}
          >
            <RiskByBookChart metrics={data.by_metric} byBook={data.by_book} />
            <RiskSummaryTable metrics={data.by_metric} />
          </Box>

          <Divider sx={{ my: 3 }} />

          <RiskGrid sensitivities={visibleSensitivities ?? []} />
        </>
      )}
    </Container>
  );
}
