import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import quoteHandler from "./api/quotes.js";
import cryptoHandler from "./api/crypto.js";
import newsHandler from "./api/news.js";

/* Dựng lại các hàm serverless của production ngay trong `vite dev`, để chạy
   local cũng đi qua đúng đường dẫn mà bản deploy dùng. */
const LOCAL_ROUTES = [
  ["/api/quotes", quoteHandler],
  ["/api/crypto", cryptoHandler],
  ["/api/news", newsHandler],
];

function localMarketApi() {
  return {
    name: "local-market-api",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const route = LOCAL_ROUTES.find(([prefix]) => request.url?.startsWith(prefix));
        if (!route) return next();
        void route[1](request, response).catch((error) => {
          response.statusCode = 500;
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : "proxy_error" }));
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localMarketApi()],
  build: {
    // Three.js là chunk lớn nhất và gần như không đổi giữa các lần deploy —
    // tách riêng để trình duyệt giữ cache thay vì tải lại mỗi lần sửa game.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "three";
          if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) return "react";
          return undefined;
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
});
