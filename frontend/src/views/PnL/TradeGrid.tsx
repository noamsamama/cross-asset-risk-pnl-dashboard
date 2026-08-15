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
  gross_notional_usd: number | null;
  net_notional_usd: number | null;
  direction: string;
  maturity_date: string;
};

const leftAligned = { align: "left", headerAlign: "left" } as const;
const middleAligned = { align: "center", headerAlign: "center" } as const;

const columns: GridColDef<Trade>[] = [
  { ...leftAligned, field: "trade_id", headerName: "Trade", width: 105 },
  { ...leftAligned, field: "book_id", headerName: "Book", width: 145 },
  { ...leftAligned, field: "trader_id", headerName: "Trader", width: 100 },
  {
    ...leftAligned,
    field: "asset_class",
    headerName: "Asset class",
    width: 115,
  },
  {
    ...middleAligned,
    field: "gross_notional_usd",
    headerName: "Gross USD",
    type: "number",
    width: 130,
    valueFormatter: (value) =>
      value === null ? "Not available" : Number(value).toLocaleString("en-US"),
  },
  {
    ...middleAligned,
    field: "net_notional_usd",
    headerName: "Net USD",
    type: "number",
    width: 130,
    valueFormatter: (value) =>
      value === null ? "Not available" : Number(value).toLocaleString("en-US"),
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
    ...middleAligned,
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
      initialState={{
        columns: {
          columnVisibilityModel: {
            asset_class: false,
            gross_notional_usd: false,
            net_notional_usd: false,
          },
        },
        pagination: { paginationModel: { pageSize: 50 } },
      }}
      pageSizeOptions={[50, 200]}
      disableRowSelectionOnClick
      showToolbar
      slots={{ toolbar: TradeGridToolbar }}
    />
  );
}
