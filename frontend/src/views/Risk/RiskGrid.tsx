import { Box, Typography } from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import FilterableGridToolbar from "../../components/FilterableGridToolbar";
import {
  formatRiskValue,
  metricLabels,
  type RiskSensitivity,
} from "./riskData";

const leftAligned = { align: "left", headerAlign: "left" } as const;
const middleAligned = { align: "center", headerAlign: "center" } as const;

const columns: GridColDef<RiskSensitivity>[] = [
  {
    ...leftAligned,
    field: "trade_id",
    headerName: "Trade",
    description: "Source trade identifier.",
    width: 105,
  },
  { ...leftAligned, field: "book_id", headerName: "Book", width: 120 },
  { ...leftAligned, field: "trader_id", headerName: "Trader", width: 100 },
  {
    ...leftAligned,
    field: "asset_class",
    headerName: "Asset class",
    width: 110,
  },
  { ...leftAligned, field: "product_type", headerName: "Product", width: 120 },
  {
    ...leftAligned,
    field: "instrument_description",
    headerName: "Instrument",
    flex: 1,
    minWidth: 230,
  },
  { ...leftAligned, field: "currency", headerName: "CCY", width: 75 },
  {
    ...leftAligned,
    field: "risk_metric",
    headerName: "Metric",
    description: "A trade can have several risk metrics.",
    width: 110,
    valueFormatter: (value) => metricLabels[value] ?? value,
  },
  {
    ...middleAligned,
    field: "value_usd",
    headerName: "Value",
    description: "Signed sensitivity in the displayed unit.",
    type: "number",
    width: 130,
    renderCell: ({ value }) => (
      <Box
        component="span"
        sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
      >
        {formatRiskValue(Number(value))}
      </Box>
    ),
  },
  {
    ...middleAligned,
    field: "display_unit",
    headerName: "Unit",
    description: "Unit specific to the selected risk metric.",
    width: 120,
  },
];

function RiskGridToolbar() {
  return <FilterableGridToolbar searchPlaceholder="Search trade…" />;
}

export default function RiskGrid({
  sensitivities,
}: {
  sensitivities: RiskSensitivity[];
}) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        One row per trade and risk metric. Repeated trade IDs are expected.
      </Typography>
      <DataGrid
        rows={sensitivities}
        columns={columns}
        getRowId={(row) => `${row.trade_id}-${row.risk_metric}`}
        initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
        pageSizeOptions={[50, 200]}
        disableRowSelectionOnClick
        showToolbar
        slots={{ toolbar: RiskGridToolbar }}
      />
    </Box>
  );
}
