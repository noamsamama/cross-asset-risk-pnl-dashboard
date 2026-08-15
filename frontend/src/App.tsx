import { useEffect, useState } from "react";
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import PnlView from "./views/PnL";
import RiskView from "./views/Risk";

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
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "grey.50" }}>
      <Box
        component="aside"
        sx={{
          width: 220,
          flexShrink: 0,
          borderRight: 1,
          borderColor: "divider",
          bgcolor: "white",
        }}
      >
        <Typography variant="h6" sx={{ p: 2.5 }}>
          Asia Desk Dashboard
        </Typography>
        <List>
          <ListItemButton
            selected={view === "pnl"}
            onClick={() => navigate("pnl")}
          >
            <ListItemText primary="Positions & P&L" />
          </ListItemButton>
          <ListItemButton
            selected={view === "risk"}
            onClick={() => navigate("risk")}
          >
            <ListItemText primary="Risk" />
          </ListItemButton>
        </List>
      </Box>

      {view === "pnl" ? <PnlView /> : <RiskView />}
    </Box>
  );
}
