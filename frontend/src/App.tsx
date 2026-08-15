import { lazy, Suspense, useEffect, useState } from "react";
import {
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Tooltip,
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
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
          width: { xs: "100%", md: sidebarOpen ? 220 : 64 },
          flexShrink: 0,
          borderRight: { xs: 0, md: 1 },
          borderBottom: { xs: 1, md: 0 },
          borderColor: "divider",
          bgcolor: "white",
          overflow: "hidden",
          transition: "width 160ms ease",
        }}
      >
        <Box
          sx={{
            minHeight: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: {
              xs: "space-between",
              md: sidebarOpen ? "space-between" : "center",
            },
            px: { xs: 2.5, md: sidebarOpen ? 2.5 : 1 },
          }}
        >
          <Typography
            variant="h6"
            noWrap
            sx={{
              display: { xs: "block", md: sidebarOpen ? "block" : "none" },
            }}
          >
            Asia Desk Dashboard
          </Typography>
          <Tooltip title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}>
            <IconButton
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              onClick={() => setSidebarOpen((open) => !open)}
              sx={{ display: { xs: "none", md: "inline-flex" } }}
            >
              <Box
                component="span"
                aria-hidden
                sx={{ fontSize: 28, lineHeight: 1 }}
              >
                {sidebarOpen ? "‹" : "›"}
              </Box>
            </IconButton>
          </Tooltip>
        </Box>
        <List sx={{ display: { xs: "flex", md: "block" } }}>
          <Tooltip title={sidebarOpen ? "" : "Positions & Explained P&L"}>
            <ListItemButton
              selected={view === "pnl"}
              onClick={() => navigate("pnl")}
              sx={{ px: { xs: 2, md: sidebarOpen ? 2 : 1 } }}
            >
              <ListItemText
                primary={
                  <>
                    <Box
                      component="span"
                      sx={{
                        display: {
                          xs: "inline",
                          md: sidebarOpen ? "inline" : "none",
                        },
                      }}
                    >
                      Positions &amp; Explained P&amp;L
                    </Box>
                    <Box
                      component="span"
                      sx={{
                        display: {
                          xs: "none",
                          md: sidebarOpen ? "none" : "inline",
                        },
                      }}
                    >
                      P&amp;L
                    </Box>
                  </>
                }
                sx={{
                  whiteSpace: "nowrap",
                  textAlign: {
                    xs: "left",
                    md: sidebarOpen ? "left" : "center",
                  },
                }}
              />
            </ListItemButton>
          </Tooltip>
          <Tooltip title={sidebarOpen ? "" : "Risk"}>
            <ListItemButton
              selected={view === "risk"}
              onClick={() => navigate("risk")}
              sx={{ px: { xs: 2, md: sidebarOpen ? 2 : 1 } }}
            >
              <ListItemText
                primary="Risk"
                sx={{
                  whiteSpace: "nowrap",
                  textAlign: {
                    xs: "left",
                    md: sidebarOpen ? "left" : "center",
                  },
                }}
              />
            </ListItemButton>
          </Tooltip>
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
