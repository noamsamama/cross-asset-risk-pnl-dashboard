import { Box } from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import FilterableGridToolbar from "../../components/FilterableGridToolbar";
import {
  formatRiskValue,
  metricLabels,
  type RiskSensitivity,
} from "./riskData";

const leftAligned = { align: "left", headerAlign: "left" } as const;

const columns: GridColDef<RiskSensitivity>[] = [
  { ...leftAligned, field: "trade_id", headerName: "Trade", width: 105 },
  { ...leftAligned, field: "book_id", headerName: "Book", width: 120 },
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
  {
    ...leftAligned,
    field: "risk_metric",
    headerName: "Metric",
    width: 110,
    valueFormatter: (value) => metricLabels[value] ?? value,
  },
  {
    field: "value_usd",
    headerName: "Value",
    type: "number",
    align: "right",
    headerAlign: "right",
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
  { ...leftAligned, field: "display_unit", headerName: "Unit", width: 120 },
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
  );
}
