/// <reference types="vite/client" />

/**
 * Mọi biến `VITE_*` mà ứng dụng đọc đều phải khai ở đây.
 *
 * Khai thiếu thì `import.meta.env.VITE_X` lọt qua typecheck dưới dạng `any` và
 * một lỗi gõ nhầm tên biến chỉ lộ ra lúc chạy, khi bảng giá đã trắng.
 *
 * Nhắc lại điều quan trọng nhất: MỌI biến `VITE_*` đều được nhúng thẳng vào
 * bundle trình duyệt. Không bao giờ đặt khoá bí mật ở đây — khoá server (như
 * `CMC_API_KEY`) phải KHÔNG có tiền tố `VITE_`.
 */
interface ImportMetaEnv {
  /** Nguồn giá cổ phiếu. Mặc định `/api/quotes`. */
  readonly VITE_EQUITY_FEED_URL?: string;
  /** Nguồn giá crypto dự phòng khi WebSocket Binance không mở được. Mặc định `/api/crypto`. */
  readonly VITE_CRYPTO_FEED_URL?: string;
  /** Nguồn bảng tin RSS đã gom sẵn. Mặc định `/api/news`. */
  readonly VITE_NEWS_FEED_URL?: string;
  /** Tỷ giá USD → VND, dạng `{ rates: { VND } }`. Mặc định open.er-api.com. */
  readonly VITE_FX_FEED_URL?: string;
  /** Dự án Supabase cho tính năng tài khoản. Bỏ trống thì app chạy chế độ lưu-trên-máy. */
  readonly VITE_SUPABASE_URL?: string;
  /** Publishable (anon) key của Supabase. TUYỆT ĐỐI không đặt service_role key. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
