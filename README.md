# Finance RWA Isle — Quần Đảo Thịnh Vượng

Trải nghiệm quản trị tài chính được game hóa bằng một quần đảo 3D React + Three.js. Người dùng xây công trình bằng mục tiêu/nhiệm vụ, mở khóa đảo riêng, tự chọn theme và trang trí, rồi lái du thuyền khám phá thế giới.

## Chạy local

```bash
npm ci
npm run dev
```

Kiểm tra trước khi deploy:

```bash
npm run typecheck
npm run build
```

Smoke test WebGL/UI (sau khi chạy `npm run dev` ở terminal khác):

```bash
npm run test:ui
```

## Dữ liệu thị trường thời gian thực

- Crypto: Binance WebSocket, cập nhật theo tick và được batch render để tránh làm lag UI.
- Cổ phiếu Mỹ/Việt Nam: endpoint cùng-origin `/api/quotes` lấy dữ liệu Yahoo Finance theo batch, cache 20 giây. `api/quotes.js` chạy trực tiếp trên Vercel; Vite có middleware tương đương khi phát triển local.
- Tỷ giá USD/VND: open.er-api, refresh mỗi 30 phút.
- Khi nguồn thật không khả dụng, giao diện giữ giá tham chiếu và hiển thị chấm xám/trạng thái `reference`; không gắn nhãn giả là dữ liệu trực tiếp.

Nếu deploy trên nền tảng khác Vercel, trỏ client tới proxy tương thích bằng:

```bash
VITE_EQUITY_FEED_URL=https://your-domain.example/api/quotes
```

Proxy nhận `?symbols=AAPL,FPT.VN` và trả `{ quotes: [{ symbol, price, previousClose, updatedAt }] }`.

> Dữ liệu phục vụ theo dõi và trải nghiệm sản phẩm, không phải lời khuyên đầu tư. Feed cổ phiếu có thể trễ tùy quy định của sở giao dịch.

## Gameplay

- Đảo Academy mở ở cấp 5, Vault cấp 6, Stocks cấp 7 và Crypto cấp 8.
- Theme và bộ decor được lưu riêng cho từng đảo trong `localStorage`; dữ liệu cũ tự migrate sang đảo Crypto.
- Mở khóa ít nhất một đảo để hạ thủy du thuyền. Điều khiển bằng `WASD`/phím mũi tên hoặc cụm nút cảm ứng; kéo để đổi góc nhìn.
- Renderer tự hạ/tăng pixel ratio theo frame time, giảm shadow/DPR trên thiết bị yếu và tôn trọng `prefers-reduced-motion`.

## Cấu trúc chính

- `src/world/WorldScene.tsx`: vòng lặp render, camera, picking, adaptive quality và yacht controller.
- `src/world/build.ts`: procedural geometry, vật liệu, water/sky shader, đảo và decor.
- `src/lib/market.ts`: realtime store, WebSocket, polling, trạng thái nguồn và fallback.
- `src/state/store.tsx`: progression, persistence, migration và island customization.
- `api/quotes.js`: server-side market proxy có validate, batch và cache.
- `tests/ui_audit.cjs`: smoke test Playwright cho WebGL/UI và ảnh regression.
