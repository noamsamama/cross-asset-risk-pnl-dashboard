import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import AppErrorBoundary from "./components/AppErrorBoundary.tsx";

const chunkReloadKey = "dashboard-chunk-reload";
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  if (sessionStorage.getItem(chunkReloadKey)) return;
  sessionStorage.setItem(chunkReloadKey, "true");
  window.location.reload();
});
window.addEventListener(
  "load",
  () => sessionStorage.removeItem(chunkReloadKey),
  { once: true },
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
