import { Box } from "@mui/material";
import {
  ColumnsPanelTrigger,
  FilterPanelTrigger,
  GridToolbarExport,
  QuickFilter,
  QuickFilterControl,
  Toolbar,
  ToolbarButton,
  useGridRootProps,
} from "@mui/x-data-grid";

export default function FilterableGridToolbar({
  searchPlaceholder,
}: {
  searchPlaceholder: string;
}) {
  const rootProps = useGridRootProps();
  const ColumnsIcon = rootProps.slots.columnSelectorIcon;
  const FilterIcon = rootProps.slots.openFilterButtonIcon;

  return (
    <Toolbar style={{ paddingLeft: 0, justifyContent: "flex-start" }}>
      <QuickFilter defaultExpanded>
        <QuickFilterControl placeholder={searchPlaceholder} />
      </QuickFilter>
      <ColumnsPanelTrigger
        render={<ToolbarButton aria-label="Choose columns" />}
      >
        <ColumnsIcon fontSize="small" />
      </ColumnsPanelTrigger>
      <FilterPanelTrigger render={<ToolbarButton aria-label="Filter rows" />}>
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
