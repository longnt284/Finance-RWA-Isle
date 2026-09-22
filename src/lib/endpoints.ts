/* ------------------------------------------------------------------ */
/*  Địa chỉ ba endpoint dữ liệu                                        */
/*                                                                     */
/*  Mặc định là đường dẫn cùng origin — đúng cái mà bản deploy trên     */
/*  Vercel dựng sẵn từ thư mục `api/`. Đặt biến môi trường tương ứng    */
/*  khi frontend và proxy nằm ở hai domain khác nhau.                  */
/*                                                                     */
/*  Gom về một chỗ vì trước đây mỗi module tự đọc biến môi trường theo  */
/*  kiểu riêng: giá cổ phiếu và bảng tin có biến để đổi, còn giá crypto */
/*  thì không — cùng một nhu cầu mà ba cách làm khác nhau.             */
/* ------------------------------------------------------------------ */

/** Bỏ dấu `/` cuối để nối chuỗi truy vấn không sinh ra `//`. */
function endpoint(configured: string | undefined, fallback: string): string {
  const clean = configured?.trim().replace(/\/+$/, "");
  return clean || fallback;
}

export const EQUITY_FEED_URL = endpoint(import.meta.env.VITE_EQUITY_FEED_URL, "/api/quotes");
export const CRYPTO_FEED_URL = endpoint(import.meta.env.VITE_CRYPTO_FEED_URL, "/api/crypto");
export const NEWS_FEED_URL = endpoint(import.meta.env.VITE_NEWS_FEED_URL, "/api/news");

/**
 * Tỷ giá USD → VND. Nguồn duy nhất mà trình duyệt gọi thẳng ra ngoài, vì nó là
 * API công khai không cần khoá và không vướng CORS.
 *
 * Phải trả đúng dạng `{ rates: { VND: number } }` của exchangerate-api. Hỏng thì
 * ứng dụng giữ tỷ giá mặc định trong `format.ts` chứ không hiện số sai.
 */
export const FX_FEED_URL = endpoint(import.meta.env.VITE_FX_FEED_URL, "https://open.er-api.com/v6/latest/USD");
