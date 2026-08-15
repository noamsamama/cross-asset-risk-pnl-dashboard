import { Box, Container, Paper, Typography } from "@mui/material";

export default function RiskView() {
  return (
    <Container component="main" maxWidth={false} sx={{ py: 3 }}>
      <Typography variant="h4">Risk</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Sensitivities and concentrations across the desk.
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "repeat(2, 1fr)" },
          gap: 2,
        }}
      >
        <Paper variant="outlined" sx={{ p: 2, minHeight: 320 }}>
          <Typography variant="h6">Risk by book</Typography>
          <Typography color="text.secondary">
            Chart data coming next.
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, minHeight: 320 }}>
          <Typography variant="h6">Risk by sensitivity type</Typography>
          <Typography color="text.secondary">
            Chart data coming next.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}
