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
npm test                # typecheck + i18n + giá + bảng tin + câu cá + Chợ
npm run test:i18n       # mọi khoá i18n mà mã nguồn yêu cầu đều có đủ vi lẫn en
npm run test:prices     # thứ tự xoay vòng nguồn giá, có stub fetch
npm run test:news       # bóc tách RSS, khử trùng lặp, chịu được nguồn 403
npm run test:fishing    # điều kiện xuất hiện, giá theo cân nặng, bậc cần câu
npm run test:shop       # 100 hạng mục và mọi `kind` đều dựng được hình
```

`test:fishing` và `test:shop` biên dịch `src/lib/*.ts` tại chỗ nên kiểm đúng bộ
luật ứng dụng dùng. `test:shop` còn đối chiếu mọi `kind` trong danh mục với các
nhánh `case` trong `world/props.ts`: thêm hạng mục mà quên viết bộ dựng thì món
đó vẫn mua và "đặt lên đảo" được nhưng không hiện ra gì — lỗi im lặng khó thấy
nhất trong cả tính năng này.

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
npm run test:fish       # tự chơi minigame câu cá tới khi bắt được một con
```

`test:fish` đọc vị trí khung và vị trí cá từ DOM rồi giữ hoặc thả chuột đúng như
một người chơi, nên nó phủ trọn đường đi từ vòng lặp `requestAnimationFrame`, qua
reducer, tới `localStorage`. Chính bài này phát hiện lực nâng khung ban đầu quá
nhẹ khiến không ván nào thắng được — thứ mà đọc code không thấy ra.

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
- **GTAO** (che khuất môi trường theo phương pháp ground-truth) chạy trong cùng
  `EffectComposer`, ngay trước bloom. Chân tường, kẽ mái, gốc cây và mép bậc thềm
  tối lại đúng như ngoài đời — đó là thứ khiến hòn đảo hết trông như đồ chơi nhựa
  xếp trên mặt phẳng. Bán kính 0,75 đơn vị, cỡ của một bóng tiếp xúc thật ở tỉ lệ
  công trình cao 5–10 đơn vị. Vì nó phải vẽ lại toàn cảnh một lượt nữa để lấy pháp
  tuyến và chiều sâu, ngưỡng tự tắt chặt hơn bloom (20ms thay vì 26ms) và máy yếu
  bị loại thẳng. Cận cảnh camera nâng từ 0,1 lên 0,6 và viễn cảnh hạ từ 1400 xuống
  950: tỉ lệ xa/gần 14.000 lần của bản trước làm depth texture vỡ vụn, bóng tiếp
  xúc biến thành những vệt sọc.
- **Cây cỏ dựng bằng instancing**. Bản trước dựng mỗi cây thông thành một `Group`
  ba mesh và mỗi cây dừa thành tám mesh — 237 lệnh vẽ chỉ để có mấy bụi cây, và
  thảm cỏ thì đơn giản là không có. Nay mỗi bộ phận là một `InstancedMesh` duy
  nhất: 27 thông, 24 dừa và **4.200 ngọn cỏ** gói lại còn tám lệnh vẽ. Ngọn cỏ ngả
  theo gió trong vertex shader (uốn theo `y` mũ 1,7 nên gốc đứng yên còn ngọn ngả
  hẳn, pha lấy từ toạ độ thế giới của chính nó nên cả thảm gợn thành sóng); gió
  mạnh dần theo mưa và mây. Sắc lá và sắc cỏ đổi theo mùa qua `instanceColor` nên
  sang mùa chỉ là ghi lại một mảng nhỏ, không dựng lại hình. Máy yếu hạ xuống
  1.600 ngọn, `prefers-reduced-motion` tắt hẳn thảm cỏ.
- **Bloom** chạy qua `EffectComposer`: `RenderPass` vẽ vào bộ đệm tuyến tính,
  `OutputPass` mới tone-map và mã hoá sRGB một lần ở cuối — nên nước và bầu
  trời, vốn tự gọi `<tonemapping_fragment>`, không bị nướng hai lần. Bloom tự
  tắt ở mức chất lượng "cân bằng", trên máy yếu, và khi khung hình vượt 26ms.
- **Bản đồ môi trường** nướng bằng PMREM từ một dải gradient trời–chân trời–biển
  (32×16 pixel, không thêm request nào): vàng, mái kính và đá bóng có phản chiếu
  thật thay vì màu bệt.
- **Xóm làng** 21 công trình — nhà gỗ, quầy chợ, lều trại, vọng lâu, cối xay
  gió, tháp canh, nhà kính — cùng 24 cây dừa và 10 luống hoa ven bãi cát. Quảng
  trường hải đăng là sân tròn nhiều bậc có lan can, chậu lửa và nan hoa lát đá.
- **Lãnh hải hình tròn**: bãi cát mở rộng và thoải dần xuống thềm nông ngọc lam,
  ngoài xa là vành san hô phát sáng đánh dấu ranh giới. Mặt nước là một đĩa tròn
  nên đường chân trời không bao giờ lộ góc vuông. Lái du thuyền tới gần rìa, một
  vách sáng hiện dần để bạn biết đã tới giới hạn.

## Camera

- **Giới hạn góc theo ngữ cảnh.** `maxPolarAngle` được tính lại mỗi khung theo
  khoảng cách camera–mục tiêu: 1,30 rad ở tầm gần, nới dần tới 1,52 khi lùi ra xa.
  Ở tầm gần, trần mặc định của `OrbitControls` cho phép hạ camera xuống gần như
  ngang mặt đất — và vì mặt đảo là một khối trụ hữu hạn, người chơi nhìn thẳng vào
  mặt dưới của nó.
- **Va chạm camera.** Mỗi khung, một tia bắn từ điểm ngắm ra phía camera; vướng
  công trình hay địa hình thì camera bị kéo vào trước mặt vật cản 0,85 đơn vị. Bị
  ép vào thì tức thì, lùi ra thì từ tốn — chậm một nhịp lúc bị ép là đúng một nhịp
  nhìn xuyên qua tường. Tia bỏ qua 1,6 đơn vị đầu tiên quanh điểm ngắm, nên chính
  thứ đang được lấy làm mẫu không đẩy camera vào; mặt sau bị loại theo `side` của
  vật liệu nên tia xuất phát từ trong lòng một khối kín vẫn đi thẳng ra ngoài. Một
  sàn cứng chặn camera rơi xuống dưới mặt cỏ hay chìm dưới mặt biển.
- **Sáu góc máy đã ngắm sẵn**: cổng đảo từ biển, chân hải đăng, hàng chân trời,
  bến câu sát nước, vành san hô, flycam toàn đảo. Mỗi khung có tiêu cự riêng
  (30–52mm) và đặt một tiền cảnh cụ thể vào một phần ba khung, nên bấm một nút là
  có ảnh thay vì phải tự xoay tìm. Bốn trong sáu khung đặt máy thấp hơn điểm ngắm
  và ngước lên — đó là toàn bộ lý do chúng đẹp — nên chúng được quyền nới trần góc
  chúi; quyền đó mất ngay khi người chơi cầm lấy chuột.
- **Chuyến bay do GSAP dẫn nhịp.** Cái được không phải đường cong mượt hơn mà là
  việc một chuyến bay mới tự huỷ chuyến đang chạy, kể cả khi nó đang tween cả tiêu
  cự lẫn vị trí. `lagSmoothing` bị tắt hẳn: mặc định, khung hình dài quá 500ms chỉ
  nhích đồng hồ GSAP thêm 33ms, nên trên máy chạy 2 khung/giây một cú bay 1,9 giây
  kéo dài thành gần một phút. Bấm trong lúc đoạn mở đầu đang chạy thì đoạn mở đầu
  nhường chỗ, thay vì nuốt mất cú bấm.

## Chế độ ảnh và chế độ chỉ-thế-giới

- **`P` mở chế độ ảnh**: toàn bộ giao diện biến mất, giờ trong ngày trượt tự do
  0–24h, mùa và thời tiết mở khoá, sáu góc máy nằm sẵn trên thanh dưới.
- **Khung hình** 16:9 · 3:2 · 1:1 · 9:16 hoặc tự do, có mặt nạ letterbox cho biết
  đâu là ảnh và đâu là phần bị cắt.
- **Xuất PNG** ở độ phân giải gấp đôi lúc chơi, bật hết hiệu ứng kể cả khi lúc chơi
  chúng đang bị tự động hạ xuống cho mượt. Ảnh không bao giờ dính giao diện: nó
  đọc thẳng từ canvas WebGL. `preserveDrawingBuffer` vẫn tắt để khỏi giữ thêm một
  bộ đệm màu suốt phiên chơi, nên hàm chụp vẽ và đọc trong cùng một nhịp đồng bộ.
  Tệp đi qua blob chứ không qua data URL — một khung 3200×1800 ra chuỗi base64 vài
  chục megabyte và Chrome im lặng từ chối điều hướng tới nó.
- **Dấu đóng** tuỳ chọn ở góc trái: tên hòn đảo và ngày, để một tấm ảnh chia sẻ ra
  ngoài vẫn nói được nó đến từ đâu.
- **`H` bật chế độ chỉ-thế-giới**: giấu giao diện nhưng vẫn chơi bình thường. HUD
  hiện chiếm khoảng 40% chiều ngang; đây là cách lấy lại toàn bộ khung hình bằng
  một phím. Cả hai chế độ đều bỏ qua phím tắt khi con trỏ đang nằm trong ô nhập
  liệu.

## Khoảnh khắc vàng

Thời gian vẫn trôi đều, nhưng có hai lát cắt mỗi ngày mà khung hình đẹp hẳn lên.
Hệ thống biết chính xác lúc nào chúng tới — mặt trời trong khoảng ±0,105 độ cao
quy ước, tức chừng hai mươi phút quanh lúc chạm mặt biển — nên nó lên tiếng mời
người chơi ở lại, kèm sẵn nút mở chế độ ảnh. Lời mời chỉ cất tiếng khi đó là
khoảnh khắc thật (không phải giờ do chế độ ảnh ấn định), khi trời đủ quang, và
một lần cho mỗi buổi mỗi ngày. Không được đáp lại thì nó tự rút sau ba mươi giây.

## Câu cá

- **Bến câu** nằm ở bờ nam đảo chính — bấm vào cầu gỗ để thả cần. **Xoáy nước**
  phát sáng rải ngoài khơi (giữa vành 46 và 102): lái du thuyền vào là mở phiên
  câu cá hiếm, xoáy tắt rồi mọc lại chỗ khác sau 26 giây.
- Cơ chế giống Stardew Valley: giữ chuột hoặc **phím cách** để nâng khung, thả
  ra thì khung rơi. Khung trùm lên cá thì thanh tiến trình nạp, ra ngoài thì tụt.
  Đầy là bắt được, cạn là cá thoát.
- **35 loài** chia năm bậc hiếm. Cá hiếm giật mạnh hơn (`difficulty` cao → khung
  hẹp, tiến trình tụt nhanh) và chỉ xuất hiện đúng vùng nước, đúng mùa, đúng
  ngày hoặc đêm của nó. Xoáy nước có `luck` 0,8 so với 0,12 ở bến câu, nên cá
  huyền thoại gần như chỉ gặp ngoài khơi.
- **Hình vẽ riêng cho từng loài.** Ba mươi lăm loài trước đây là ba mươi lăm ô
  chữ dùng chung một biểu tượng cá. Nay mỗi loài có một dáng thân (18 kiểu: thân
  thoi, thân dẹp cao, đuôi liềm, mũi kiếm, đầu búa, thân dải, thân cầu có gai, xúc
  tu, mai và càng…) cùng bảng ba màu riêng. Vẽ bằng SVG dựng tại chỗ nên không
  thêm một byte tài nguyên nào phải tải, mà vẫn sắc nét từ ô 40px trong giỏ cá tới
  tấm chân dung lúc vừa kéo được cá lên. Loài chưa gặp giữ nguyên dáng thân nhưng
  tô đen — bạn thấy được mình còn thiếu con cá hình gì.
- **Bộ sưu tập** giữ mọi loài từng bắt kèm kỷ lục cân nặng, kể cả khi cá đã bán.
  **Giỏ cá** là phần chưa bán; bán lấy **xu**, giá theo cân nặng thật của con cá.
- **Cần câu lên cấp** theo tổng số cá đã bắt (15 · 45 · 110 · 240 con): khung
  rộng ra và tiến trình nạp nhanh hơn.

## Chợ Trang Trí

> Tiếng Anh gọi mục này là **Decor Shop**, không phải "Decor Market": "Market" đã
> là bảng giá thị trường thật, để hai chỗ trùng tên thì người dùng bấm nhầm.

- **100 hạng mục** chia bảy nhóm: sắc nền, cây cối, ánh sáng, công trình, tượng
  đài, ven biển và hiệu ứng. Mua bằng xu bán cá.
- Đặt được lên **đảo chính lẫn bốn đảo riêng**, tối đa 14 món mỗi đảo. Vị trí
  rải theo góc vàng nên bố cục ổn định — cất một món đi thì những món còn lại
  không nhảy chỗ.
- **Sắc nền** là loại một-chọn-một: đặt nền mới thì nền cũ tự nhường chỗ. Trên
  đảo chính, sắc nền pha vào bảng màu mùa chứ không thay hẳn, nên mùa đông vẫn
  ra mùa đông.

## Bảng tin

- `/api/news` gom **tám nguồn RSS** công khai (CoinDesk, Cointelegraph, Decrypt,
  Yahoo Finance, CNBC, VnExpress Kinh doanh, CafeF, Vietstock) thành một dòng
  tin đã khử trùng lặp theo liên kết và sắp xếp mới nhất lên đầu.
- Mỗi nguồn được gắn sẵn chủ đề (crypto · chứng khoán · Việt Nam · thế giới) để
  lọc mà không cần đoán. Một nguồn hỏng không kéo cả bảng tin xuống; trường
  `tried` nói rõ nguồn nào hỏng vì lý do gì.
- Máy chủ cache 3 phút, client cache 5 phút. Khi mọi nguồn đều bị chặn, giao
  diện nói thẳng là mạng đang chặn RSS chứ không hiện bảng trắng.

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
- **Ba nhiệm vụ mới mỗi ngày** rút từ 15 mẫu: hoàn thành nhiệm vụ, ghi nhanh hoạt
  động, nhích mục tiêu, ghi nhận tài sản ròng, thêm mã vào bảng chạy, viết ghi
  chú, ghé thăm các quận, ra khơi, vượt khảo thí, chỉnh trang đảo, câu cá, đọc
  bảng tin, sắm đồ ở Chợ. Cùng một ngày luôn ra cùng bộ nhiệm vụ; XP nhận được
  nhân theo chuỗi ngày.

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
- Máy tính lãi kép & DCA nhập được bằng **triệu ₫ hoặc nghìn $**; đổi đơn vị thì
  giá trị thật giữ nguyên, và kết quả luôn hiện kèm con số đối chiếu bằng đơn vị
  còn lại. Ô ghi nhận tài sản ròng cũng theo đúng đơn vị đang hiển thị.

**Mỗi endpoint xoay vòng nhiều nguồn**, không phụ thuộc một nhà cung cấp duy nhất:

| Endpoint | Thứ tự nguồn | Ghi chú |
| --- | --- | --- |
| `/api/quotes` | Yahoo `query1` → Yahoo `query2` → Stooq | Stooq chỉ phủ sàn Mỹ; mã `.VN` vẫn trông vào Yahoo |
| `/api/crypto` | Binance REST → CoinGecko → CoinMarketCap | CoinMarketCap chỉ bật khi có `CMC_API_KEY` phía máy chủ |
| `/api/news` | 8 nguồn RSS gọi song song | Nguồn nào hỏng thì bỏ qua nguồn đó, phần còn lại vẫn lên bảng |

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

Người chơi đã có bản lưu — kể cả bản lưu vừa kéo từ đám mây xuống trên một máy lạ
— vẫn được thấy trang bìa khi quay lại, mỗi phiên một lần. Nội dung khác bản dành
cho người mới: thay vì mời khai mở một hòn đảo, nó chào tên hòn đảo họ đã dựng
cùng cấp quần đảo, tổng cấp và tài sản ròng — ba con số nói rằng nó vẫn còn
nguyên ở đó.

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

- Toàn bộ cây cối và thảm cỏ nằm trong tám `InstancedMesh` (xem *Thế giới 3D*),
  nên 4.200 ngọn cỏ rẻ hơn 39 cái cây của bản trước.
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
- `src/world/props.ts` — 40 kiểu vật phẩm của Chợ, xóm làng, bến câu, xoáy nước.
- `src/world/camera.ts` — giá máy: giới hạn góc theo ngữ cảnh, va chạm, sáu góc máy đẹp.
- `src/world/foliage.ts` — rừng thông, rừng dừa và thảm cỏ dựng bằng instancing.
- `src/components/Photo.tsx` — chế độ ảnh: giờ, mùa, thời tiết, khung hình, xuất PNG.
- `src/components/FishArt.tsx` — bộ dựng hình SVG cho 35 loài cá.
- `src/lib/fishArt.ts` — dáng thân và bảng màu của từng loài.
- `src/lib/fishing.ts` — danh mục cá, xổ số cắn câu và hằng số minigame.
- `src/lib/shop.ts` — 100 hạng mục trang trí, tên song ngữ nằm trong dữ liệu.
- `src/lib/news.ts` — client bảng tin, bộ nhớ dùng chung và dấu "đã đọc".
- `api/news.js` — gom RSS nhiều nguồn, parse không cần dependency.
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
- `tests/news_feed.cjs` — bóc tách RSS và khử trùng lặp, chạy offline.
- `tests/fishing.cjs` — luật câu cá, chạy offline trên chính `lib/fishing.ts`.
- `tests/shop_catalog.cjs` — danh mục Chợ và đối chiếu `kind` với `props.ts`.
- `tests/feed_language.cjs` — bảng Hoạt động đổi ngôn ngữ ở cả hai chiều.
- `tests/photo_camera.cjs` — góc máy, chế độ ảnh và xuất PNG; fail khi nút Chụp
  không ra được tệp.
