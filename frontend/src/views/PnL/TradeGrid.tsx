import { Box } from "@mui/material";
import {
  ColumnsPanelTrigger,
  DataGrid,
  FilterPanelTrigger,
  GridToolbarExport,
  QuickFilter,
  QuickFilterControl,
  Toolbar,
  ToolbarButton,
  type GridColDef,
  useGridRootProps,
} from "@mui/x-data-grid";

export type Trade = {
  trade_id: string;
  book_id: string;
  trader_id: string;
  trade_date: string;
  asset_class: string;
  product_type: string;
  instrument_description: string;
  currency: string;
  notional: number;
  gross_notional_usd: number;
  direction: string;
  maturity_date: string;
};

const columns: GridColDef<Trade>[] = [
  { field: "trade_id", headerName: "Trade", width: 105 },
  { field: "book_id", headerName: "Book", width: 105 },
  { field: "trader_id", headerName: "Trader", width: 100 },
  { field: "asset_class", headerName: "Asset class", width: 115 },
  { field: "product_type", headerName: "Product", width: 120 },
  {
    field: "instrument_description",
    headerName: "Instrument",
    flex: 1,
    minWidth: 220,
  },
  { field: "currency", headerName: "CCY", width: 75 },
  {
    field: "notional",
    headerName: "Notional",
    type: "number",
    width: 140,
    renderCell: ({ row, value }) => {
      const color = ["BUY", "RECEIVE"].includes(row.direction)
        ? "success.main"
        : ["SELL", "PAY"].includes(row.direction)
          ? "error.main"
          : "text.primary";

      return (
        <Box component="span" sx={{ color, fontWeight: 600 }}>
          {Number(value).toLocaleString("en-US")}
        </Box>
      );
    },
  },
  { field: "direction", headerName: "Direction", width: 105 },
  { field: "maturity_date", headerName: "Maturity", width: 115 },
];

function TradeGridToolbar() {
  const rootProps = useGridRootProps();
  const ColumnsIcon = rootProps.slots.columnSelectorIcon;
  const FilterIcon = rootProps.slots.openFilterButtonIcon;

  return (
    <Toolbar style={{ paddingLeft: 0, justifyContent: "flex-start" }}>
      <QuickFilter defaultExpanded>
        <QuickFilterControl placeholder="Search trades…" />
      </QuickFilter>
      <ColumnsPanelTrigger
        render={<ToolbarButton aria-label="Choose columns" />}
      >
        <ColumnsIcon fontSize="small" />
      </ColumnsPanelTrigger>
      <FilterPanelTrigger render={<ToolbarButton aria-label="Filter trades" />}>
        <FilterIcon fontSize="small" />
      </FilterPanelTrigger>
      <Box sx={{ flex: 1 }} />
      <GridToolbarExport
        csvOptions={{ allColumns: false }}
        printOptions={{ disableToolbarButton: true }}
      />
    </Toolbar>
  );
}

export default function TradeGrid({ trades }: { trades: Trade[] }) {
  return (
    <DataGrid
      rows={trades}
      columns={columns}
      getRowId={(trade) => trade.trade_id}
      initialState={{ pagination: { paginationModel: { pageSize: 40 } } }}
      pageSizeOptions={[40, 200]}
      disableRowSelectionOnClick
      showToolbar
      slots={{ toolbar: TradeGridToolbar }}
    />
  );
}
