import { lazy, Suspense, useEffect, useState } from "react";
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";

const PnlView = lazy(() => import("./views/PnL"));
const RiskView = lazy(() => import("./views/Risk"));

type View = "pnl" | "risk";

function currentView(): View {
  return window.location.pathname.toLowerCase() === "/risk" ? "risk" : "pnl";
}

export default function App() {
  const [view, setView] = useState<View>(currentView);

  useEffect(() => {
    if (window.location.pathname === "/")
      window.history.replaceState(null, "", "/P&L");
    const updateView = () => setView(currentView());
    window.addEventListener("popstate", updateView);
    return () => window.removeEventListener("popstate", updateView);
  }, []);

  const navigate = (nextView: View) => {
    window.history.pushState(null, "", nextView === "pnl" ? "/P&L" : "/risk");
    setView(nextView);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        minHeight: "100vh",
        bgcolor: "grey.50",
      }}
    >
      <Box
        component="aside"
        sx={{
          width: { xs: "100%", md: 220 },
          flexShrink: 0,
          borderRight: { xs: 0, md: 1 },
          borderBottom: { xs: 1, md: 0 },
          borderColor: "divider",
          bgcolor: "white",
        }}
      >
        <Typography variant="h6" sx={{ p: 2.5 }}>
          Asia Desk Dashboard
        </Typography>
        <List sx={{ display: { xs: "flex", md: "block" } }}>
          <ListItemButton
            selected={view === "pnl"}
            onClick={() => navigate("pnl")}
          >
            <ListItemText primary="Positions & Explained P&L" />
          </ListItemButton>
          <ListItemButton
            selected={view === "risk"}
            onClick={() => navigate("risk")}
          >
            <ListItemText primary="Risk" />
          </ListItemButton>
        </List>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Suspense
          fallback={<Typography sx={{ p: 3 }}>Loading view…</Typography>}
        >
          {view === "pnl" ? <PnlView /> : <RiskView />}
        </Suspense>
      </Box>
    </Box>
  );
}
