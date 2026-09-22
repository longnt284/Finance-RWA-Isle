import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import quoteHandler from "./api/quotes.js";
import cryptoHandler from "./api/crypto.js";
import newsHandler from "./api/news.js";

/* Dựng lại các hàm serverless của production ngay trong `vite dev`, để chạy
   local cũng đi qua đúng đường dẫn mà bản deploy dùng. */
const LOCAL_ROUTES = new Map([
  ["/api/quotes", quoteHandler],
  ["/api/crypto", cryptoHandler],
  ["/api/news", newsHandler],
]);

function localMarketApi() {
  return {
    name: "local-market-api",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        /* So khớp đúng đường dẫn chứ không phải tiền tố của cả URL. Bản trước
           dùng `startsWith` nên `/api/quotes-cu` cũng rơi vào hàm giá, và
           chuỗi truy vấn thì nằm ngay trong chuỗi đem so. */
        const path = (request.url || "").split("?")[0].replace(/\/+$/, "") || "/";
        const handler = LOCAL_ROUTES.get(path);
        if (!handler) return next();
        void handler(request, response).catch((error) => {
          /* Hàm có thể đã ghi header rồi mới ném — lúc đó chỉ còn cách cắt kết
             nối, ghi thêm nữa là ném chồng lên lỗi gốc. */
          if (response.headersSent) return response.end();
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : "proxy_error" }));
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localMarketApi()],
  build: {
    /* Cùng mốc với `target` trong tsconfig.json: hai con số lệch nhau thì
       typecheck cho phép một cú pháp mà bản build lại hạ cấp hoặc bỏ qua. */
    target: "es2022",
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
  },
  preview: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
  },
});
