import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 20_000,
          maxSize: 400_000,
          includeDependenciesRecursively: false,
          groups: [
            { name: "data-grid", test: /node_modules\/@mui\/x-data-grid/ },
            { name: "mui", test: /node_modules\/(@mui|@emotion)\// },
            {
              name: "charts",
              test: /node_modules\/(recharts|d3-|victory-vendor)/,
            },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
});
