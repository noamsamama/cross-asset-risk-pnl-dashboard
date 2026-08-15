import { Box } from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import FilterableGridToolbar from "../../components/FilterableGridToolbar";

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

const leftAligned = { align: "left", headerAlign: "left" } as const;

const columns: GridColDef<Trade>[] = [
  { ...leftAligned, field: "trade_id", headerName: "Trade", width: 105 },
  { ...leftAligned, field: "book_id", headerName: "Book", width: 105 },
  { ...leftAligned, field: "trader_id", headerName: "Trader", width: 100 },
  {
    ...leftAligned,
    field: "asset_class",
    headerName: "Asset class",
    width: 115,
  },
  { ...leftAligned, field: "product_type", headerName: "Product", width: 120 },
  {
    ...leftAligned,
    field: "instrument_description",
    headerName: "Instrument",
    flex: 1,
    minWidth: 220,
  },
  { ...leftAligned, field: "currency", headerName: "CCY", width: 75 },
  {
    field: "notional",
    headerName: "Notional",
    type: "number",
    align: "right",
    headerAlign: "right",
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
  { ...leftAligned, field: "direction", headerName: "Direction", width: 105 },
  {
    ...leftAligned,
    field: "maturity_date",
    headerName: "Maturity",
    width: 115,
  },
];

function TradeGridToolbar() {
  return <FilterableGridToolbar searchPlaceholder="Search trades…" />;
}

export default function TradeGrid({ trades }: { trades: Trade[] }) {
  return (
    <DataGrid
      rows={trades}
      columns={columns}
      getRowId={(trade) => trade.trade_id}
      initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
      pageSizeOptions={[50, 200]}
      disableRowSelectionOnClick
      showToolbar
      slots={{ toolbar: TradeGridToolbar }}
    />
  );
}
