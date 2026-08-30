import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import quoteHandler from "./api/quotes.js";

function localMarketApi() {
  return {
    name: "local-market-api",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith("/api/quotes")) return next();
        void quoteHandler(request, response).catch((error) => {
          response.statusCode = 500;
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : "proxy_error" }));
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localMarketApi()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
});
