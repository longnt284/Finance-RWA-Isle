# Finance RWA Isle — Quần Đảo Thịnh Vượng

Công cụ theo dõi tài sản được game hoá, dành cho người chơi chứng khoán và crypto.
Bạn ghi lại mục tiêu, nhiệm vụ và mốc tài sản của mình; quần đảo 3D lớn lên theo
đúng những gì bạn thật sự làm được.

> Số liệu tài sản do bạn tự khai để theo dõi kỷ luật tích luỹ. Đây không phải lời
> khuyên đầu tư, và ứng dụng không kết nối tới ngân hàng, sàn hay ví của bạn.

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

Kiểm thử không cần trình duyệt (chạy được ở mọi môi trường, kể cả khi mạng chặn
các nguồn giá):

```bash
npm test                # typecheck + i18n + chuỗi nguồn giá
npm run test:i18n       # mọi khoá i18n mà mã nguồn yêu cầu đều có đủ vi lẫn en
npm run test:prices     # thứ tự xoay vòng nguồn giá, có stub fetch
```

Smoke test WebGL/UI (chạy `npm run dev` ở terminal khác trước):

```bash
npm run test:ui
```

Bộ ảnh kiểm chứng tính năng và bài kiểm tra luồng thi đậu:

```bash
npm run test:features   # ngày/đêm, bốn mùa, chín kiểu thời tiết
npm run test:panels     # các bảng bên phải, luồng khảo thí, bầu trời đêm
npm run test:exam       # tự trả lời đúng cả 5 câu rồi kiểm tra màn hình "Đạt"
npm run test:feed       # bảng Hoạt động đổi ngôn ngữ đúng ở cả hai chiều
```

`test:exam` biên dịch `src/lib/quiz.ts` tại chỗ để lấy đúng đáp án theo cùng
seed mà ứng dụng dùng, nên nó bấm trúng chứ không đoán.

## Thế giới 3D

- **Chu kỳ ngày** bám đồng hồ thật: bình minh, buổi sáng, chính ngọ, xế chiều,
  hoàng hôn, đêm. Mặt trời phình và ngả đỏ khi sát chân trời; mặt trăng có miệng
  hố và pha khuyết tính theo chu kỳ giao hội 29,53 ngày; sao chỉ hiện khi trời đủ
  tối, có dải Ngân Hà và sao băng thưa thớt.
- **Bốn mùa** theo lịch dương (quy ước Bắc bán cầu): xuân, hạ, thu, đông. Mỗi mùa
  đổi sắc lá, sắc nước ven bờ, sương mù và độ ấm ánh sáng; mùa đông phủ tuyết mỏng
  lên thảm cỏ.
- **Chín kiểu thời tiết**: quang đãng, nhiều mây, mưa, giông bão (có chớp), tuyết
  rơi, mưa hoa, lá rơi, sương mù và đom đóm ban đêm. Thời tiết tự đổi vài lần mỗi
  ngày theo mùa, hoặc bạn tự chọn trong bảng *Khí hậu & thời gian*.
- **Lãnh hải hình tròn**: bãi cát mở rộng và thoải dần xuống thềm nông ngọc lam,
  ngoài xa là vành san hô phát sáng đánh dấu ranh giới. Mặt nước là một đĩa tròn
  nên đường chân trời không bao giờ lộ góc vuông. Lái du thuyền tới gần rìa, một
  vách sáng hiện dần để bạn biết đã tới giới hạn.

## Tiến trình và khảo thí

- Bốn lĩnh vực (Crypto, Chứng khoán, Kim Khố, Học Viện) lên tới **Cấp 15**. Yêu
  cầu XP giãn dần: 60 XP cho cấp 1 nhưng 8.400 XP cho cấp 15.
- **Cấp 1 được trao tự động. Từ cấp 2 trở đi, mỗi lần thăng cấp phải qua một bài
  khảo thí 5 câu, đúng 4 câu mới đạt.** Ngân hàng câu hỏi bám sát từng lĩnh vực và
  chia ba bậc: nền tảng (cấp 1–5), vận dụng (6–10), nâng cao (11–15). Thi trượt
  không mất XP; mỗi lần thi lại là một bộ đề khác, và màn hình tổng kết giải thích
  vì sao từng đáp án đúng.
- Kiến trúc trong thế giới tiếp tục thay đổi tới bậc 8: tháp mọc bia rune, cột
  sáng và vương miện; sàn giao dịch có bảng điện tử, hai cánh nhà phụ và tượng bò
  vàng; kim khố có tháp canh, lưới laser và khối vàng lơ lửng; học viện có kính
  viễn vọng, thư viện và vòng chòm sao.

## Điểm danh và nhiệm vụ ngày

- **Điểm danh chu kỳ 7 ngày**, phần thưởng tăng dần và lớn nhất ở ngày thứ bảy.
  Bỏ lỡ một ngày thì chu kỳ quay lại Ngày 1.
- **Ba nhiệm vụ mới mỗi ngày** rút từ 11 mẫu: hoàn thành nhiệm vụ, ghi nhanh hoạt
  động, nhích mục tiêu, ghi nhận tài sản ròng, thêm mã vào bảng chạy, viết ghi
  chú, ghé thăm các quận, ra khơi, vượt khảo thí, chỉnh trang đảo. Cùng một ngày
  luôn ra cùng bộ nhiệm vụ; XP nhận được nhân theo chuỗi ngày.

## Du thuyền

Tổng cấp của cả bốn lĩnh vực quyết định hạng du thuyền, từ xuồng gỗ tới kỳ hạm có
trực thăng đậu sẵn và đèn pha quét biển:

| Hạng | Tên | Cần tổng cấp |
|---|---|---|
| 1 | Xuồng Khởi Hành | 0 |
| 2 | Ca Nô Duyên Hải | 10 |
| 3 | Du Thuyền Thịnh Vượng | 20 |
| 4 | Siêu Du Thuyền Hoàng Kim | 34 |
| 5 | Kỳ Hạm Vạn Đảo | 48 |

Tàu càng lớn càng nhanh nhưng bẻ lái càng ì; camera cũng lùi ra xa hơn theo hạng.
Nâng cấp trong bảng *Khí hậu & thời gian → Xưởng du thuyền*.

## Dữ liệu thị trường thời gian thực

- **100 mã crypto** trực tiếp từ Binance WebSocket, cập nhật theo tick và batch
  render để không làm nghẽn UI. Mạng chặn Binance thì sau 8 giây client tự chuyển
  sang `/api/crypto` — cùng origin, chạy phía máy chủ nên không dính chặn theo
  vùng — và hỏi lại mỗi 20 giây.
- **50 mã Việt Nam** (HOSE/HNX) và **100 mã Mỹ** qua endpoint cùng-origin
  `/api/quotes`. Client chỉ lấy giá cho phần đang hiển thị cộng bảng chạy của bạn,
  gửi theo lô 25 mã song song; server cache 20 giây và giới hạn 8 request đồng
  thời tới upstream.
- Tỷ giá USD/VND từ open.er-api, refresh mỗi 30 phút.

**Mỗi endpoint xoay vòng nhiều nguồn**, không phụ thuộc một nhà cung cấp duy nhất:

| Endpoint | Thứ tự nguồn | Ghi chú |
| --- | --- | --- |
| `/api/quotes` | Yahoo `query1` → Yahoo `query2` → Stooq | Stooq chỉ phủ sàn Mỹ; mã `.VN` vẫn trông vào Yahoo |
| `/api/crypto` | Binance REST → CoinGecko → CoinMarketCap | CoinMarketCap chỉ bật khi có `CMC_API_KEY` phía máy chủ |

CoinGecko được hỏi theo `id`, mà bản đồ ký hiệu → `id` thì có thể sai. Nên máy chủ
**đối chiếu lại `symbol` mà CoinGecko trả về**: lệch là loại luôn mục đó. Thà thiếu
một dòng giá còn hơn hiện giá đồng này dưới tên đồng khác.

Cả hai endpoint trả kèm trường `tried` nói rõ nguồn nào hỏng vì lý do gì. Khi bảng
giá không lên, mở thẳng trên trình duyệt để biết đang tắc ở đâu:

```
/api/crypto?symbols=BTC,ETH
/api/quotes?symbols=AAPL,VCB.VN
```
- Khi nguồn thật không khả dụng, giao diện giữ giá tham chiếu và hiển thị chấm
  xám cùng trạng thái `reference`; không bao giờ gắn nhãn giả là dữ liệu trực tiếp.

`api/quotes.js` chạy trực tiếp trên Vercel; Vite có middleware tương đương khi
phát triển local. Nếu deploy trên nền tảng khác, trỏ client tới proxy tương thích:

```bash
VITE_EQUITY_FEED_URL=https://your-domain.example/api/quotes
```

Proxy nhận `?symbols=AAPL,FPT.VN` và trả
`{ quotes: [{ symbol, price, previousClose, updatedAt }], failed, asOf }`.

## Tài khoản và quyền riêng tư

Mặc định mọi tiến độ nằm trong `localStorage` của trình duyệt — không cần đăng ký,
không thu thập gì. Bật tài khoản để giữ tiến độ khi đổi máy:

1. Tạo dự án Supabase (hoặc dùng dự án sẵn có).
2. Chạy `supabase/migrations/0001_isle_saves.sql` để tạo bảng `isle_saves` cùng
   các policy Row Level Security.
3. Đặt `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` (xem `.env.example`).

Bản deploy trong repo này đã trỏ sẵn vào một dự án Supabase qua `.env.production`.
Hai giá trị đó là public theo thiết kế — mọi biến `VITE_*` đều nằm trong bundle
trình duyệt, và anon key vốn được Supabase phát hành để lộ ra client. Thứ giữ dữ
liệu an toàn là RLS ở tầng cơ sở dữ liệu, không phải việc giấu khoá. Muốn dùng dự
án riêng thì thay hai biến đó là xong.

Migration cũng `revoke` quyền `execute` trên hàm trigger `isle_saves_touch()`.
Không revoke thì PostgREST phơi nó ra ở `/rest/v1/rpc/isle_saves_touch` cho cả
`anon` lẫn `authenticated` — Supabase advisor báo đúng hai cảnh báo về việc này.

Không cấu hình hai biến đó thì ứng dụng chạy ở **chế độ lưu-trên-máy** và nói rõ
điều đó trong màn hình Tài khoản — mọi tính năng khác vẫn đầy đủ.

Cam kết riêng tư hiển thị ngay trong màn hình đăng ký, không giấu sau đường link:
chỉ lưu thứ người dùng tự gõ; không bao giờ hỏi seed phrase, private key, mật khẩu
sàn hay số thẻ; mật khẩu băm phía máy chủ; bản lưu khoá theo tài khoản bằng RLS ở
tầng cơ sở dữ liệu; không bán, không chia sẻ, không mã theo dõi bên thứ ba; xoá dữ
liệu máy chủ được bất cứ lúc nào bằng một nút.

Đồng bộ chạy nền: tự đẩy lên máy chủ sau mỗi thay đổi (gộp 4 giây). Việc **kéo bản
trên máy chủ về là hành động có xác nhận**, không bao giờ tự ghi đè bản đang chơi —
ghi đè ngầm là cách nhanh nhất để người dùng mất tiến độ.

> Chỉ dùng publishable key (anon). Mọi biến `VITE_*` đều được nhúng thẳng vào
> bundle phía trình duyệt, nên không bao giờ đặt `service_role` key vào đó.

## Hiệu năng

- Renderer tự hạ/tăng pixel ratio theo frame time, giảm shadow map và mật độ hạt
  trên thiết bị yếu, và tôn trọng `prefers-reduced-motion`.
- Ba mức chất lượng (tự động / cao / cân bằng) cùng công tắc tắt hẳn hiệu ứng hạt
  trong bảng *Khí hậu & thời gian*.
- Raycast picking giới hạn 60ms một lần; nhãn thế giới cập nhật 30 lần/giây.
- Bundle tách riêng `three` và `react` để trình duyệt giữ cache qua các lần deploy;
  bảng điều khiển không kéo theo Three.js.

## Cấu trúc chính

- `src/world/WorldScene.tsx` — vòng lặp render, camera, picking, chất lượng thích
  ứng, điều phối môi trường và bộ điều khiển du thuyền.
- `src/world/atmosphere.ts` — vòm trời, mặt trời, mặt trăng có pha, sao băng, mây.
- `src/world/ocean.ts` — đại dương tròn, thềm cát nông, vành san hô ranh giới.
- `src/world/weather.ts` — hệ hạt mưa, tuyết, cánh hoa, lá, sương, đom đóm.
- `src/world/yacht.ts` — du thuyền 5 hạng.
- `src/world/build.ts` — địa hình, công trình bốn lĩnh vực, đảo riêng, trang trí.
- `src/lib/season.ts` — mùa, pha ngày, bảng màu và bộ chọn thời tiết (thuần, không
  phụ thuộc Three.js nên state và UI dùng được).
- `src/lib/quiz.ts` — ngân hàng câu hỏi khảo thí song ngữ và bộ sinh đề.
- `src/lib/cloud.ts` — tài khoản và đồng bộ, viết bằng fetch thuần trên REST API.
- `src/lib/market.ts` — realtime store, WebSocket, polling theo lô, trạng thái nguồn.
- `src/state/store.tsx` — tiến trình, khảo thí, điểm danh, nhiệm vụ ngày, du thuyền,
  lưu trữ và migration.
- `src/state/sync.ts` — khôi phục phiên và tự đẩy bản lưu lên máy chủ.
- `api/quotes.js` — proxy giá cổ phiếu có validate, chia lô, cache và giới hạn tải.
- `api/crypto.js` — giá crypto qua máy chủ, đường lui khi WebSocket Binance bị chặn.
- `api/_providers.js` — các nguồn giá dùng chung cho hai endpoint trên.
- `src/lib/events.ts` — phát hiện biến động mạnh để ghi sự kiện thị trường.
- `supabase/migrations/` — schema và policy RLS.
- `tests/ui_audit.cjs` — smoke test Playwright cho WebGL/UI.
- `tests/feature_shots.cjs` — bộ ảnh kiểm chứng tính năng.
- `tests/i18n_keys.cjs` — đối chiếu mọi khoá i18n mã nguồn yêu cầu với hai từ điển.
- `tests/price_providers.cjs` — chuỗi xoay vòng nguồn giá, chạy offline.
- `tests/feed_language.cjs` — bảng Hoạt động đổi ngôn ngữ ở cả hai chiều.
