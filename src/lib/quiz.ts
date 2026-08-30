import type { Lang } from "./i18n";

/* ------------------------------------------------------------------ */
/*  Ngân hàng câu hỏi khảo thí — mỗi lần thăng cấp phải trả lời 5 câu   */
/* ------------------------------------------------------------------ */

/** Giữ union riêng để module này không phụ thuộc ngược vào store. */
export type ExamDistrict = "crypto" | "stocks" | "vault" | "academy";

/** 1 = nền tảng (cấp 1–5) · 2 = vận dụng (cấp 6–10) · 3 = nâng cao (cấp 11–15) */
export type QuizTier = 1 | 2 | 3;

interface Bilingual {
  vi: string;
  en: string;
}

export interface QuizQuestion {
  id: string;
  district: ExamDistrict;
  tier: QuizTier;
  q: Bilingual;
  options: Bilingual[];
  /** chỉ số phương án đúng trong `options` */
  answer: number;
  why: Bilingual;
}

export const EXAM_SIZE = 5;
/** Số câu tối thiểu phải đúng để qua bài. */
export const EXAM_PASS = 4;

const BANK: QuizQuestion[] = [
  /* ============================== CRYPTO ============================== */
  {
    id: "c-t1-1", district: "crypto", tier: 1,
    q: { vi: "Nguồn cung tối đa của Bitcoin theo thiết kế giao thức là bao nhiêu?", en: "What is Bitcoin's maximum supply by protocol design?" },
    options: [
      { vi: "21 triệu BTC", en: "21 million BTC" },
      { vi: "100 triệu BTC", en: "100 million BTC" },
      { vi: "Không giới hạn", en: "Unlimited" },
      { vi: "1 tỷ BTC", en: "1 billion BTC" },
    ],
    answer: 0,
    why: { vi: "Giới hạn 21 triệu được ghi cứng trong mã nguồn và là nền tảng cho luận điểm khan hiếm của BTC.", en: "The 21 million cap is hard-coded in the protocol and underpins Bitcoin's scarcity thesis." },
  },
  {
    id: "c-t1-2", district: "crypto", tier: 1,
    q: { vi: "Stablecoin như USDT, USDC được thiết kế để làm gì?", en: "What are stablecoins like USDT and USDC designed to do?" },
    options: [
      { vi: "Neo giá trị vào một tài sản tham chiếu, thường là USD", en: "Peg their value to a reference asset, usually the USD" },
      { vi: "Tăng giá nhanh hơn Bitcoin", en: "Appreciate faster than Bitcoin" },
      { vi: "Trả lãi cố định 20%/năm", en: "Pay a fixed 20% annual yield" },
      { vi: "Thay thế hoàn toàn ngân hàng trung ương", en: "Fully replace central banks" },
    ],
    answer: 0,
    why: { vi: "Stablecoin giữ tỷ giá 1:1 với tài sản neo; nó là công cụ thanh toán và trú ẩn tạm, không phải kênh sinh lời.", en: "Stablecoins hold a 1:1 peg to the reference asset — a settlement and parking tool, not a yield product." },
  },
  {
    id: "c-t1-3", district: "crypto", tier: 1,
    q: { vi: "\"Private key\" (khoá riêng) của ví crypto nên được xử lý thế nào?", en: "How should a crypto wallet's private key be handled?" },
    options: [
      { vi: "Chỉ mình bạn giữ, không chia sẻ và không lưu trên dịch vụ đám mây công khai", en: "Kept only by you — never shared, never stored in public cloud services" },
      { vi: "Gửi cho sàn giao dịch để họ sao lưu hộ", en: "Sent to the exchange so they can back it up" },
      { vi: "Đăng lên nhóm cộng đồng để nhờ kiểm tra", en: "Posted in a community group for verification" },
      { vi: "Chụp màn hình và lưu trong thư viện ảnh điện thoại", en: "Screenshotted into your phone's photo library" },
    ],
    answer: 0,
    why: { vi: "Ai giữ khoá riêng thì người đó sở hữu tài sản. Lộ khoá riêng đồng nghĩa mất trắng, không có cơ chế hoàn tiền.", en: "Whoever holds the private key owns the funds. A leaked key means irreversible loss — there is no chargeback." },
  },
  {
    id: "c-t1-4", district: "crypto", tier: 1,
    q: { vi: "DCA (Dollar-Cost Averaging) nghĩa là gì?", en: "What does DCA (Dollar-Cost Averaging) mean?" },
    options: [
      { vi: "Chia nhỏ vốn và mua đều đặn theo lịch, bất kể giá", en: "Splitting capital and buying on a fixed schedule regardless of price" },
      { vi: "Dồn toàn bộ vốn mua một lần tại đáy", en: "Deploying all capital at once at the bottom" },
      { vi: "Vay ký quỹ để khuếch đại lợi nhuận", en: "Borrowing on margin to amplify returns" },
      { vi: "Bán khống khi thị trường giảm", en: "Short selling when the market falls" },
    ],
    answer: 0,
    why: { vi: "DCA làm phẳng giá vốn trung bình và loại bỏ áp lực bắt đáy — phù hợp cho tích luỹ dài hạn.", en: "DCA smooths your average cost and removes the pressure of timing the bottom — suited to long-horizon accumulation." },
  },
  {
    id: "c-t1-5", district: "crypto", tier: 1,
    q: { vi: "Blockchain công khai như Bitcoin ghi nhận giao dịch theo cách nào?", en: "How does a public blockchain such as Bitcoin record transactions?" },
    options: [
      { vi: "Sổ cái phân tán, ai cũng kiểm tra được và rất khó sửa lại lịch sử", en: "A distributed ledger anyone can verify and that is extremely hard to rewrite" },
      { vi: "Cơ sở dữ liệu riêng do một công ty vận hành", en: "A private database run by one company" },
      { vi: "Bảng tính lưu trên máy chủ của sàn", en: "A spreadsheet kept on the exchange's servers" },
      { vi: "Sổ giấy do thợ đào ghi tay", en: "A paper ledger written by miners" },
    ],
    answer: 0,
    why: { vi: "Tính minh bạch và bất biến của sổ cái phân tán là điểm khác biệt cốt lõi so với hệ thống tập trung.", en: "Transparency and immutability of the distributed ledger is the core difference from centralized systems." },
  },
  {
    id: "c-t1-6", district: "crypto", tier: 1,
    q: { vi: "Vốn hoá thị trường (market cap) của một đồng coin được tính thế nào?", en: "How is a coin's market capitalisation calculated?" },
    options: [
      { vi: "Giá × nguồn cung đang lưu hành", en: "Price × circulating supply" },
      { vi: "Giá × khối lượng giao dịch 24 giờ", en: "Price × 24-hour trading volume" },
      { vi: "Tổng số ví đang nắm giữ", en: "Total number of holding wallets" },
      { vi: "Giá cao nhất mọi thời đại × 2", en: "All-time high price × 2" },
    ],
    answer: 0,
    why: { vi: "Giá đơn lẻ không nói lên quy mô. Một đồng giá 0,001 $ có thể lớn hơn đồng giá 100 $ nếu nguồn cung khổng lồ.", en: "Price alone says nothing about size. A $0.001 coin can be larger than a $100 coin if its supply is huge." },
  },
  {
    id: "c-t2-1", district: "crypto", tier: 2,
    q: { vi: "Sự kiện \"halving\" của Bitcoin tác động trực tiếp tới điều gì?", en: "What does a Bitcoin \"halving\" directly affect?" },
    options: [
      { vi: "Phần thưởng khối giảm một nửa, làm chậm tốc độ phát hành BTC mới", en: "The block reward halves, slowing the issuance of new BTC" },
      { vi: "Giá BTC tự động tăng gấp đôi", en: "The BTC price automatically doubles" },
      { vi: "Phí giao dịch giảm một nửa", en: "Transaction fees are halved" },
      { vi: "Số lượng ví hoạt động giảm một nửa", en: "The number of active wallets halves" },
    ],
    answer: 0,
    why: { vi: "Halving chỉ tác động tới cung mới phát hành, khoảng 4 năm một lần. Giá là hệ quả của cung–cầu, không phải hệ quả cơ học.", en: "A halving only affects new issuance, roughly every four years. Price is a supply-and-demand outcome, not a mechanical one." },
  },
  {
    id: "c-t2-2", district: "crypto", tier: 2,
    q: { vi: "Rủi ro \"impermanent loss\" xuất hiện khi bạn làm gì?", en: "When does impermanent loss arise?" },
    options: [
      { vi: "Cung cấp thanh khoản cho một cặp tài sản trên AMM và giá hai tài sản phân kỳ", en: "Providing liquidity for an AMM pair whose two assets diverge in price" },
      { vi: "Giữ coin trong ví lạnh quá lâu", en: "Holding coins in cold storage too long" },
      { vi: "Chuyển coin giữa hai sàn", en: "Moving coins between two exchanges" },
      { vi: "Nhận airdrop từ dự án mới", en: "Receiving an airdrop from a new project" },
    ],
    answer: 0,
    why: { vi: "Khi tỷ giá hai tài sản lệch đi, giá trị phần vốn trong pool thấp hơn so với việc chỉ nắm giữ — phí giao dịch phải bù được khoản chênh này.", en: "As the pair's ratio drifts, the pooled position is worth less than simply holding — fees must outweigh that gap." },
  },
  {
    id: "c-t2-3", district: "crypto", tier: 2,
    q: { vi: "Cơ chế đồng thuận Proof of Stake khác Proof of Work ở điểm cốt lõi nào?", en: "What is the core difference between Proof of Stake and Proof of Work?" },
    options: [
      { vi: "Quyền xác thực dựa trên lượng token đặt cọc thay vì công suất tính toán", en: "Validation rights come from staked tokens rather than computational power" },
      { vi: "Không cần người xác thực", en: "No validators are needed at all" },
      { vi: "Giao dịch luôn miễn phí", en: "Transactions are always free" },
      { vi: "Không thể bị tấn công", en: "It cannot be attacked" },
    ],
    answer: 0,
    why: { vi: "PoS thay điện năng bằng vốn đặt cọc; validator gian lận sẽ bị cắt phần cọc (slashing).", en: "PoS substitutes staked capital for electricity; misbehaving validators get slashed." },
  },
  {
    id: "c-t2-4", district: "crypto", tier: 2,
    q: { vi: "Khi sàn tập trung phá sản, tài sản bạn để trên sàn thường được xử lý ra sao?", en: "When a centralized exchange fails, how are your on-exchange assets usually treated?" },
    options: [
      { vi: "Bạn trở thành chủ nợ không bảo đảm, thu hồi bao nhiêu tuỳ thủ tục phá sản", en: "You become an unsecured creditor; recovery depends on the insolvency process" },
      { vi: "Được bảo hiểm tiền gửi hoàn trả đủ 100%", en: "Deposit insurance repays you in full" },
      { vi: "Blockchain tự động trả lại coin về ví bạn", en: "The blockchain automatically returns coins to your wallet" },
      { vi: "Sàn khác bắt buộc phải tiếp nhận và hoàn tiền", en: "Another exchange is required to take over and refund you" },
    ],
    answer: 0,
    why: { vi: "\"Not your keys, not your coins\". Tài sản trên sàn là khoản phải thu, không phải quyền sở hữu trực tiếp on-chain.", en: "\"Not your keys, not your coins.\" On-exchange balances are a claim, not direct on-chain ownership." },
  },
  {
    id: "c-t2-5", district: "crypto", tier: 2,
    q: { vi: "Trong giao dịch phái sinh, \"funding rate\" dương kéo dài thường phản ánh điều gì?", en: "In perpetual futures, what does a persistently positive funding rate usually signal?" },
    options: [
      { vi: "Phe mua (long) đang trả phí cho phe bán — đòn bẩy nghiêng về hướng tăng", en: "Longs are paying shorts — leverage is crowded on the upside" },
      { vi: "Sàn đang thưởng cho người mua", en: "The exchange is rewarding buyers" },
      { vi: "Giá chắc chắn sẽ tăng tiếp", en: "The price will certainly keep rising" },
      { vi: "Thanh khoản đang cạn kiệt", en: "Liquidity is drying up" },
    ],
    answer: 0,
    why: { vi: "Funding dương kéo dài cho thấy vị thế long đông đúc — điều kiện điển hình trước các cú long squeeze.", en: "Sustained positive funding means crowded longs — a classic setup before a long squeeze." },
  },
  {
    id: "c-t2-6", district: "crypto", tier: 2,
    q: { vi: "Ví lạnh (cold wallet) an toàn hơn ví nóng chủ yếu vì lý do nào?", en: "Why is a cold wallet fundamentally safer than a hot wallet?" },
    options: [
      { vi: "Khoá riêng không bao giờ tiếp xúc với thiết bị nối mạng", en: "The private key never touches an internet-connected device" },
      { vi: "Nó được ngân hàng bảo lãnh", en: "It is guaranteed by a bank" },
      { vi: "Phí giao dịch rẻ hơn", en: "Its transaction fees are lower" },
      { vi: "Nó tự động sao lưu lên đám mây", en: "It automatically backs up to the cloud" },
    ],
    answer: 0,
    why: { vi: "Cắt đứt kết nối mạng loại bỏ gần như toàn bộ nhóm tấn công từ xa — đổi lại là bất tiện khi giao dịch.", en: "Cutting the network link removes nearly the entire remote attack surface — at the cost of convenience." },
  },
  {
    id: "c-t3-1", district: "crypto", tier: 3,
    q: { vi: "Chỉ báo on-chain MVRV so sánh hai đại lượng nào?", en: "The on-chain MVRV ratio compares which two quantities?" },
    options: [
      { vi: "Vốn hoá thị trường so với vốn hoá thực (giá vốn trung bình của toàn mạng)", en: "Market cap versus realized cap (the network's average cost basis)" },
      { vi: "Khối lượng giao dịch so với số ví hoạt động", en: "Trading volume versus active wallets" },
      { vi: "Phí gas so với phần thưởng khối", en: "Gas fees versus block rewards" },
      { vi: "Nguồn cung lưu hành so với nguồn cung tối đa", en: "Circulating supply versus max supply" },
    ],
    answer: 0,
    why: { vi: "MVRV cao nghĩa là thị trường đang lãi đậm so với giá vốn — vùng rủi ro chốt lời; MVRV thấp thường trùng vùng đầu hàng.", en: "A high MVRV means holders sit on large unrealized gains — a profit-taking risk zone; low MVRV often marks capitulation." },
  },
  {
    id: "c-t3-2", district: "crypto", tier: 3,
    q: { vi: "Rủi ro lớn nhất khi dùng cầu nối (bridge) chuyển tài sản giữa các chuỗi là gì?", en: "What is the biggest risk when using a cross-chain bridge?" },
    options: [
      { vi: "Hợp đồng khoá tài sản của cầu nối là mục tiêu tấn công tập trung giá trị lớn", en: "The bridge's locking contract is a high-value, concentrated attack target" },
      { vi: "Phí gas cao hơn giao dịch thường", en: "Gas fees are higher than a normal transfer" },
      { vi: "Thời gian xác nhận chậm hơn vài giây", en: "Confirmation takes a few seconds longer" },
      { vi: "Không hiển thị được trên ví di động", en: "Balances do not show in mobile wallets" },
    ],
    answer: 0,
    why: { vi: "Nhiều vụ mất mát lớn nhất lịch sử DeFi đến từ lỗ hổng cầu nối, nơi hàng trăm triệu đô bị khoá trong một hợp đồng duy nhất.", en: "Several of DeFi's largest losses came from bridge exploits, where hundreds of millions sit in a single contract." },
  },
  {
    id: "c-t3-3", district: "crypto", tier: 3,
    q: { vi: "Trong quản trị rủi ro danh mục crypto, vì sao \"tương quan tăng vọt khi thị trường sụp\" lại quan trọng?", en: "In crypto portfolio risk, why does \"correlation spikes in a crash\" matter?" },
    options: [
      { vi: "Đa dạng hoá bằng nhiều altcoin gần như mất tác dụng đúng lúc bạn cần nó nhất", en: "Diversifying across altcoins loses effect exactly when you need it most" },
      { vi: "Phí giao dịch tăng theo số lượng coin nắm giữ", en: "Fees rise with the number of coins held" },
      { vi: "Sàn sẽ tự động bán bớt danh mục", en: "The exchange auto-liquidates your portfolio" },
      { vi: "Stablecoin sẽ mất neo giá", en: "Stablecoins always lose their peg" },
    ],
    answer: 0,
    why: { vi: "Altcoin phần lớn là beta của BTC. Đa dạng hoá thật sự đòi hỏi lớp tài sản khác nhau, không phải nhiều token cùng nhóm.", en: "Altcoins are largely BTC beta. Real diversification needs different asset classes, not more tokens from the same family." },
  },
  {
    id: "c-t3-4", district: "crypto", tier: 3,
    q: { vi: "Vì sao lợi suất staking danh nghĩa cao chưa chắc là lợi nhuận thực?", en: "Why is a high nominal staking yield not necessarily a real return?" },
    options: [
      { vi: "Phần thưởng trả bằng chính token đang lạm phát; giá token giảm có thể xoá sạch lợi suất", en: "Rewards are paid in the same inflating token; a price decline can wipe out the yield" },
      { vi: "Lợi suất staking luôn bị đánh thuế 100%", en: "Staking yield is always taxed at 100%" },
      { vi: "Không thể rút token đã stake", en: "Staked tokens can never be withdrawn" },
      { vi: "Lợi suất chỉ tính trên phần token đã bán", en: "Yield only accrues on tokens you have sold" },
    ],
    answer: 0,
    why: { vi: "Phải quy đổi về đơn vị tiền tệ gốc và trừ phần pha loãng nguồn cung mới thấy lợi nhuận thực.", en: "Convert to your base currency and subtract supply dilution to see the real return." },
  },
  {
    id: "c-t3-5", district: "crypto", tier: 3,
    q: { vi: "Một dự án có tokenomics với 60% nguồn cung thuộc đội ngũ và quỹ đầu tư, mở khoá dần trong 12 tháng. Rủi ro chính là gì?", en: "A project allocates 60% of supply to team and investors, vesting over 12 months. What is the main risk?" },
    options: [
      { vi: "Áp lực bán từ các đợt mở khoá có thể át cầu thị trường trong suốt kỳ vesting", en: "Unlock-driven sell pressure can overwhelm market demand throughout the vesting period" },
      { vi: "Dự án không thể niêm yết trên sàn nào", en: "The project cannot list on any exchange" },
      { vi: "Blockchain sẽ từ chối giao dịch của họ", en: "The blockchain will reject their transactions" },
      { vi: "Token sẽ tự động bị đốt hết", en: "The token will be automatically burned" },
    ],
    answer: 0,
    why: { vi: "Lịch mở khoá là dữ liệu công khai — đọc nó trước khi mua quan trọng ngang đọc whitepaper.", en: "Unlock schedules are public data — reading them matters as much as reading the whitepaper." },
  },

  /* ============================== STOCKS ============================== */
  {
    id: "s-t1-1", district: "stocks", tier: 1,
    q: { vi: "Chỉ số VN-Index đo lường điều gì?", en: "What does the VN-Index measure?" },
    options: [
      { vi: "Biến động vốn hoá của toàn bộ cổ phiếu niêm yết trên sàn HOSE", en: "The capitalisation-weighted move of all stocks listed on HOSE" },
      { vi: "Giá vàng trong nước", en: "The domestic gold price" },
      { vi: "Tỷ giá USD/VND", en: "The USD/VND exchange rate" },
      { vi: "Lãi suất tiết kiệm bình quân", en: "The average savings deposit rate" },
    ],
    answer: 0,
    why: { vi: "VN-Index là chỉ số vốn hoá của sàn TP.HCM; VN30 là rổ 30 mã vốn hoá và thanh khoản cao nhất.", en: "VN-Index is the Ho Chi Minh exchange's cap-weighted index; VN30 is the basket of its 30 largest, most liquid names." },
  },
  {
    id: "s-t1-2", district: "stocks", tier: 1,
    q: { vi: "Chỉ số P/E của một cổ phiếu cho biết điều gì?", en: "What does a stock's P/E ratio tell you?" },
    options: [
      { vi: "Nhà đầu tư trả bao nhiêu đồng cho mỗi đồng lợi nhuận mỗi cổ phiếu", en: "How much investors pay for each unit of earnings per share" },
      { vi: "Cổ tức chi trả hằng năm", en: "The annual dividend paid" },
      { vi: "Số cổ phiếu đang lưu hành", en: "The number of shares outstanding" },
      { vi: "Tổng nợ trên vốn chủ sở hữu", en: "Total debt to equity" },
    ],
    answer: 0,
    why: { vi: "P/E = Giá / EPS. Cần so sánh trong cùng ngành và cùng chu kỳ mới có ý nghĩa.", en: "P/E = price / EPS. It is only meaningful compared within the same industry and cycle." },
  },
  {
    id: "s-t1-3", district: "stocks", tier: 1,
    q: { vi: "Chu kỳ thanh toán cổ phiếu cơ sở trên thị trường Việt Nam hiện là:", en: "What is the current settlement cycle for Vietnamese cash equities?" },
    options: [
      { vi: "T+2 — cổ phiếu về tài khoản sau 2 ngày làm việc", en: "T+2 — shares settle two business days after the trade" },
      { vi: "T+0 — về ngay lập tức", en: "T+0 — instant settlement" },
      { vi: "T+7", en: "T+7" },
      { vi: "T+30", en: "T+30" },
    ],
    answer: 0,
    why: { vi: "Hiểu chu kỳ thanh toán giúp bạn không tính nhầm sức mua khả dụng khi đảo danh mục.", en: "Knowing the settlement cycle keeps you from miscounting available buying power when rotating positions." },
  },
  {
    id: "s-t1-4", district: "stocks", tier: 1,
    q: { vi: "Cổ tức tiền mặt được chi trả từ nguồn nào?", en: "Where does a cash dividend come from?" },
    options: [
      { vi: "Lợi nhuận sau thuế chưa phân phối của doanh nghiệp", en: "The company's retained after-tax profit" },
      { vi: "Vốn góp của cổ đông mới", en: "Capital contributed by new shareholders" },
      { vi: "Ngân sách nhà nước", en: "The state budget" },
      { vi: "Khoản vay ngân hàng bắt buộc", en: "A mandatory bank loan" },
    ],
    answer: 0,
    why: { vi: "Doanh nghiệp trả cổ tức vượt lợi nhuận tạo ra là dấu hiệu cần soi kỹ dòng tiền hoạt động.", en: "A company paying dividends beyond the profit it generates is a signal to inspect operating cash flow closely." },
  },
  {
    id: "s-t1-5", district: "stocks", tier: 1,
    q: { vi: "Biên độ dao động giá trong một phiên trên sàn HOSE là bao nhiêu?", en: "What is the daily price band on the HOSE exchange?" },
    options: [
      { vi: "±7% so với giá tham chiếu", en: "±7% from the reference price" },
      { vi: "±30%", en: "±30%" },
      { vi: "Không giới hạn", en: "No limit" },
      { vi: "±1%", en: "±1%" },
    ],
    answer: 0,
    why: { vi: "HOSE ±7%, HNX ±10%, UPCoM ±15%. Biên độ khác nhau đổi hoàn toàn cách quản trị rủi ro mỗi sàn.", en: "HOSE ±7%, HNX ±10%, UPCoM ±15%. Different bands change how you size risk on each board." },
  },
  {
    id: "s-t1-6", district: "stocks", tier: 1,
    q: { vi: "Quỹ ETF chỉ số khác gì so với mua từng cổ phiếu riêng lẻ?", en: "How does an index ETF differ from buying individual stocks?" },
    options: [
      { vi: "Một lệnh mua cho bạn tỷ trọng trong cả rổ, phân tán rủi ro doanh nghiệp đơn lẻ", en: "One order gives you a slice of the whole basket, spreading single-company risk" },
      { vi: "ETF luôn có lợi nhuận cao hơn cổ phiếu", en: "ETFs always return more than stocks" },
      { vi: "ETF không bao giờ giảm giá", en: "ETFs never fall in price" },
      { vi: "ETF không phải trả phí quản lý", en: "ETFs charge no management fee" },
    ],
    answer: 0,
    why: { vi: "ETF loại bỏ rủi ro riêng lẻ nhưng vẫn chịu trọn rủi ro thị trường và phí quản lý hằng năm.", en: "ETFs remove idiosyncratic risk but still carry full market risk and an annual expense ratio." },
  },
  {
    id: "s-t2-1", district: "stocks", tier: 2,
    q: { vi: "ROE của doanh nghiệp đo lường điều gì?", en: "What does a company's ROE measure?" },
    options: [
      { vi: "Khả năng sinh lời trên mỗi đồng vốn chủ sở hữu", en: "Profit generated per unit of shareholder equity" },
      { vi: "Tốc độ tăng doanh thu", en: "Revenue growth rate" },
      { vi: "Tỷ lệ cổ tức trên thị giá", en: "Dividend yield on market price" },
      { vi: "Số vòng quay hàng tồn kho", en: "Inventory turnover" },
    ],
    answer: 0,
    why: { vi: "ROE cao nhờ đòn bẩy nợ lớn khác hẳn ROE cao nhờ biên lợi nhuận — hãy tách nó bằng phân tích Dupont.", en: "A high ROE driven by leverage differs sharply from one driven by margin — separate them with DuPont analysis." },
  },
  {
    id: "s-t2-2", district: "stocks", tier: 2,
    q: { vi: "Giao dịch ký quỹ (margin) làm tăng rủi ro chủ yếu vì:", en: "Margin trading raises risk mainly because:" },
    options: [
      { vi: "Khoản lỗ được khuếch đại và có thể bị bán giải chấp tại đúng vùng giá xấu nhất", en: "Losses are amplified and forced liquidation can hit at the worst possible price" },
      { vi: "Phí giao dịch cao hơn 10 lần", en: "Trading fees are ten times higher" },
      { vi: "Không được nhận cổ tức", en: "You forfeit dividends" },
      { vi: "Lệnh khớp chậm hơn", en: "Orders fill more slowly" },
    ],
    answer: 0,
    why: { vi: "Call margin buộc bán ra khi tỷ lệ ký quỹ chạm ngưỡng, biến khoản lỗ tạm thời thành lỗ vĩnh viễn.", en: "A margin call forces selling when the ratio breaches its threshold, turning a temporary loss into a permanent one." },
  },
  {
    id: "s-t2-3", district: "stocks", tier: 2,
    q: { vi: "Dòng tiền tự do (Free Cash Flow) quan trọng vì:", en: "Free cash flow matters because:" },
    options: [
      { vi: "Nó là tiền thật còn lại sau chi phí vận hành và đầu tư — nguồn để trả cổ tức, giảm nợ, mua lại cổ phiếu", en: "It is real cash left after operations and capex — the source for dividends, debt repayment and buybacks" },
      { vi: "Nó luôn bằng lợi nhuận sau thuế", en: "It always equals net profit" },
      { vi: "Nó do cơ quan thuế công bố", en: "It is published by the tax authority" },
      { vi: "Nó chỉ áp dụng cho ngân hàng", en: "It only applies to banks" },
    ],
    answer: 0,
    why: { vi: "Lợi nhuận kế toán có thể được điều chỉnh; dòng tiền thật khó nguỵ tạo hơn nhiều.", en: "Accounting profit can be shaped; actual cash flow is far harder to manufacture." },
  },
  {
    id: "s-t2-4", district: "stocks", tier: 2,
    q: { vi: "Khi ngân hàng trung ương tăng lãi suất, tác động thường thấy lên định giá cổ phiếu tăng trưởng là:", en: "When a central bank raises rates, the usual effect on growth-stock valuations is:" },
    options: [
      { vi: "Giảm, vì dòng tiền tương lai bị chiết khấu với lãi suất cao hơn", en: "Downward, because future cash flows are discounted at a higher rate" },
      { vi: "Tăng, vì doanh nghiệp vay được nhiều hơn", en: "Upward, because companies can borrow more" },
      { vi: "Không đổi", en: "No effect" },
      { vi: "Chỉ ảnh hưởng tới trái phiếu", en: "Only bonds are affected" },
    ],
    answer: 0,
    why: { vi: "Cổ phiếu tăng trưởng có dòng tiền dồn về xa trong tương lai nên nhạy với lãi suất chiết khấu hơn cổ phiếu giá trị.", en: "Growth stocks push cash flows further out, so they are more sensitive to the discount rate than value stocks." },
  },
  {
    id: "s-t2-5", district: "stocks", tier: 2,
    q: { vi: "Khối lượng giao dịch tăng đột biến kèm giá phá vỡ vùng kháng cự thường được đọc là:", en: "A volume surge alongside a break above resistance is usually read as:" },
    options: [
      { vi: "Tín hiệu xác nhận cho lực cầu thật, nhưng vẫn cần quản trị rủi ro nếu tín hiệu sai", en: "Confirmation of genuine demand — while still needing a risk plan if it fails" },
      { vi: "Bảo đảm chắc chắn giá sẽ tiếp tục tăng", en: "A guarantee the price will keep rising" },
      { vi: "Dấu hiệu bắt buộc phải bán ra", en: "A mandatory sell signal" },
      { vi: "Lỗi dữ liệu của sàn", en: "An exchange data error" },
    ],
    answer: 0,
    why: { vi: "Không có tín hiệu kỹ thuật nào chắc chắn. Điểm dừng lỗ và khối lượng vị thế mới là thứ quyết định kết quả dài hạn.", en: "No technical signal is certain. Stop placement and position size decide long-run outcomes." },
  },
  {
    id: "s-t2-6", district: "stocks", tier: 2,
    q: { vi: "Cổ phiếu \"pha loãng\" khi doanh nghiệp phát hành thêm cổ phần nghĩa là:", en: "Share dilution from a new issuance means:" },
    options: [
      { vi: "Tỷ lệ sở hữu và EPS của cổ đông hiện hữu giảm nếu không mua thêm", en: "Existing holders' ownership share and EPS fall unless they buy more" },
      { vi: "Giá cổ phiếu luôn tăng", en: "The share price always rises" },
      { vi: "Doanh nghiệp bắt buộc phải trả cổ tức", en: "The company must pay a dividend" },
      { vi: "Cổ phiếu bị huỷ niêm yết", en: "The stock is delisted" },
    ],
    answer: 0,
    why: { vi: "Pha loãng không xấu nếu vốn huy động tạo ra ROIC cao hơn chi phí vốn; xấu khi chỉ để bù lỗ.", en: "Dilution is fine when the raised capital earns above the cost of capital; harmful when it merely plugs losses." },
  },
  {
    id: "s-t3-1", district: "stocks", tier: 3,
    q: { vi: "Trong phân tích Dupont, ROE được tách thành ba cấu phần nào?", en: "In DuPont analysis, ROE decomposes into which three components?" },
    options: [
      { vi: "Biên lợi nhuận ròng × Vòng quay tài sản × Đòn bẩy tài chính", en: "Net margin × asset turnover × financial leverage" },
      { vi: "Doanh thu × Chi phí × Thuế", en: "Revenue × cost × tax" },
      { vi: "P/E × P/B × Cổ tức", en: "P/E × P/B × dividend" },
      { vi: "Tiền mặt × Nợ × Vốn góp", en: "Cash × debt × paid-in capital" },
    ],
    answer: 0,
    why: { vi: "Tách ba cấu phần cho biết ROE đến từ hiệu quả vận hành hay từ vay nợ — hai câu chuyện rủi ro rất khác nhau.", en: "The split shows whether ROE comes from operating efficiency or from borrowing — two very different risk stories." },
  },
  {
    id: "s-t3-2", district: "stocks", tier: 3,
    q: { vi: "Chỉ số Sharpe của một danh mục đo lường điều gì?", en: "What does a portfolio's Sharpe ratio measure?" },
    options: [
      { vi: "Lợi nhuận vượt trội trên mỗi đơn vị độ biến động", en: "Excess return per unit of volatility" },
      { vi: "Tổng lợi nhuận tuyệt đối", en: "Total absolute return" },
      { vi: "Tỷ lệ lệnh thắng", en: "Win rate on trades" },
      { vi: "Số lượng mã trong danh mục", en: "Number of holdings" },
    ],
    answer: 0,
    why: { vi: "Hai danh mục cùng lãi 30% nhưng khác biến động là hai chất lượng đầu tư hoàn toàn khác nhau.", en: "Two portfolios both up 30% with different volatility are not the same quality of investing." },
  },
  {
    id: "s-t3-3", district: "stocks", tier: 3,
    q: { vi: "Hiệu ứng \"survivorship bias\" khi backtest chiến lược là gì?", en: "What is survivorship bias when backtesting a strategy?" },
    options: [
      { vi: "Dữ liệu chỉ chứa doanh nghiệp còn tồn tại, khiến kết quả quá khứ đẹp hơn thực tế", en: "The dataset only holds surviving companies, flattering historical results" },
      { vi: "Chiến lược chỉ hoạt động vào thứ Hai", en: "The strategy only works on Mondays" },
      { vi: "Phí giao dịch bị tính hai lần", en: "Fees are counted twice" },
      { vi: "Dữ liệu bị trễ 15 phút", en: "Data is delayed 15 minutes" },
    ],
    answer: 0,
    why: { vi: "Backtest bỏ qua các mã đã huỷ niêm yết sẽ che giấu đúng phần rủi ro bạn cần đo.", en: "A backtest that omits delisted names hides exactly the risk you set out to measure." },
  },
  {
    id: "s-t3-4", district: "stocks", tier: 3,
    q: { vi: "Vì sao \"rebalancing\" (tái cân bằng) định kỳ lại có giá trị với danh mục dài hạn?", en: "Why is periodic rebalancing valuable for a long-term portfolio?" },
    options: [
      { vi: "Nó ép bán bớt phần đã tăng mạnh và mua thêm phần bị bỏ lại, giữ hồ sơ rủi ro đúng thiết kế", en: "It forces trimming what ran up and adding what lagged, keeping the risk profile on design" },
      { vi: "Nó bảo đảm không bao giờ lỗ", en: "It guarantees you never lose money" },
      { vi: "Nó giảm thuế xuống 0", en: "It reduces tax to zero" },
      { vi: "Nó tăng gấp đôi lợi nhuận", en: "It doubles returns" },
    ],
    answer: 0,
    why: { vi: "Không tái cân bằng, một mã thắng lớn sẽ âm thầm chiếm tỷ trọng vượt xa mức rủi ro bạn chấp nhận ban đầu.", en: "Without rebalancing, one big winner quietly grows past the risk weight you originally accepted." },
  },
  {
    id: "s-t3-5", district: "stocks", tier: 3,
    q: { vi: "Khi đánh giá một doanh nghiệp chu kỳ (thép, hoá chất, bất động sản), P/E thấp bất thường thường báo hiệu:", en: "For a cyclical business (steel, chemicals, property), an unusually low P/E often signals:" },
    options: [
      { vi: "Lợi nhuận đang ở đỉnh chu kỳ và có thể sụt mạnh ở kỳ sau", en: "Earnings are at a cyclical peak and may fall sharply next period" },
      { vi: "Cổ phiếu chắc chắn đang rẻ", en: "The stock is definitely cheap" },
      { vi: "Doanh nghiệp sắp trả cổ tức lớn", en: "A large dividend is imminent" },
      { vi: "Thị trường đã định giá sai hoàn toàn", en: "The market is simply wrong" },
    ],
    answer: 0,
    why: { vi: "Với cổ phiếu chu kỳ, P/E thấp ở đỉnh lợi nhuận và P/E cao ở đáy — đọc ngược sẽ mua đúng đỉnh.", en: "For cyclicals, P/E is low at peak earnings and high at the trough — reading it naively buys the top." },
  },

  /* ============================== VAULT ============================== */
  {
    id: "v-t1-1", district: "vault", tier: 1,
    q: { vi: "Quỹ khẩn cấp nên đủ chi tiêu trong khoảng thời gian nào?", en: "How long should an emergency fund cover your expenses?" },
    options: [
      { vi: "3–6 tháng chi phí sinh hoạt thiết yếu", en: "3–6 months of essential living costs" },
      { vi: "1 tuần", en: "One week" },
      { vi: "10 năm", en: "Ten years" },
      { vi: "Không cần quỹ khẩn cấp nếu đã đầu tư", en: "None needed once you are invested" },
    ],
    answer: 0,
    why: { vi: "Quỹ khẩn cấp giữ bạn khỏi phải bán tài sản đầu tư đúng lúc thị trường giảm để trang trải sự cố.", en: "An emergency fund stops you from selling investments into a drawdown just to cover a shock." },
  },
  {
    id: "v-t1-2", district: "vault", tier: 1,
    q: { vi: "Lạm phát 4%/năm ảnh hưởng thế nào tới tiền mặt để không?", en: "How does 4% annual inflation affect idle cash?" },
    options: [
      { vi: "Sức mua giảm dần dù số dư danh nghĩa không đổi", en: "Purchasing power erodes even though the nominal balance is unchanged" },
      { vi: "Số dư tự động tăng theo lạm phát", en: "The balance grows automatically with inflation" },
      { vi: "Không ảnh hưởng gì", en: "No effect at all" },
      { vi: "Ngân hàng phải bù phần chênh lệch", en: "The bank must compensate the difference" },
    ],
    answer: 0,
    why: { vi: "Lợi suất thực = lợi suất danh nghĩa − lạm phát. Gửi 4% khi lạm phát 4% là hoà vốn về sức mua.", en: "Real return = nominal return − inflation. Earning 4% with 4% inflation is break-even in purchasing power." },
  },
  {
    id: "v-t1-3", district: "vault", tier: 1,
    q: { vi: "Quy tắc 50/30/20 trong quản lý thu nhập phân bổ như thế nào?", en: "How does the 50/30/20 budgeting rule allocate income?" },
    options: [
      { vi: "50% thiết yếu · 30% mong muốn · 20% tiết kiệm và đầu tư", en: "50% needs · 30% wants · 20% savings and investing" },
      { vi: "50% đầu tư · 30% vay · 20% chi tiêu", en: "50% investing · 30% borrowing · 20% spending" },
      { vi: "50% tiết kiệm · 30% thuế · 20% bảo hiểm", en: "50% saving · 30% tax · 20% insurance" },
      { vi: "50% cổ phiếu · 30% trái phiếu · 20% vàng", en: "50% stocks · 30% bonds · 20% gold" },
    ],
    answer: 0,
    why: { vi: "Đây là khung tham chiếu, không phải luật. Tỷ lệ tiết kiệm 20% là sàn, không phải trần.", en: "It is a reference frame, not a law. The 20% savings rate is a floor, not a ceiling." },
  },
  {
    id: "v-t1-4", district: "vault", tier: 1,
    q: { vi: "Lãi kép phát huy sức mạnh mạnh nhất nhờ yếu tố nào?", en: "What makes compound interest most powerful?" },
    options: [
      { vi: "Thời gian — càng bắt đầu sớm, phần lãi sinh lãi càng lớn", en: "Time — the earlier you start, the more interest earns interest" },
      { vi: "Số vốn ban đầu thật lớn", en: "A very large starting balance" },
      { vi: "Giao dịch càng nhiều càng tốt", en: "Trading as often as possible" },
      { vi: "Rút lãi ra mỗi tháng", en: "Withdrawing the interest monthly" },
    ],
    answer: 0,
    why: { vi: "Rút lãi ra mỗi kỳ biến lãi kép thành lãi đơn — đúng thứ triệt tiêu lợi thế lớn nhất của bạn.", en: "Withdrawing gains each period turns compounding into simple interest — killing your single biggest edge." },
  },
  {
    id: "v-t1-5", district: "vault", tier: 1,
    q: { vi: "Bảo hiểm nhân thọ hoặc bảo hiểm sức khoẻ đóng vai trò gì trong kế hoạch tài chính?", en: "What role does life or health insurance play in a financial plan?" },
    options: [
      { vi: "Chuyển giao rủi ro thảm hoạ để một sự cố không phá vỡ toàn bộ kế hoạch tích luỹ", en: "Transferring catastrophic risk so one event cannot destroy the whole accumulation plan" },
      { vi: "Là kênh đầu tư sinh lời cao nhất", en: "It is the highest-returning investment channel" },
      { vi: "Thay thế hoàn toàn quỹ khẩn cấp", en: "It fully replaces an emergency fund" },
      { vi: "Bảo đảm lợi nhuận đầu tư", en: "It guarantees investment returns" },
    ],
    answer: 0,
    why: { vi: "Bảo hiểm là công cụ phòng vệ, không phải công cụ sinh lời. Trộn lẫn hai mục tiêu thường khiến bạn trả phí cao cho cả hai.", en: "Insurance is protection, not a return engine. Blending the two goals usually means overpaying for both." },
  },
  {
    id: "v-t1-6", district: "vault", tier: 1,
    q: { vi: "Nên ưu tiên trả hết nợ thẻ tín dụng lãi 25%/năm hay đầu tư kỳ vọng 12%/năm trước?", en: "Pay off 25%-a-year credit card debt, or invest at an expected 12% a year first?" },
    options: [
      { vi: "Trả nợ trước — trả hết khoản lãi 25% là khoản \"lợi nhuận\" chắc chắn 25%", en: "Repay first — clearing 25% interest is a guaranteed 25% return" },
      { vi: "Đầu tư trước vì thị trường có thể tăng mạnh", en: "Invest first because markets might surge" },
      { vi: "Chia đôi để an toàn", en: "Split evenly to be safe" },
      { vi: "Vay thêm để đầu tư nhiều hơn", en: "Borrow more to invest more" },
    ],
    answer: 0,
    why: { vi: "Lợi suất đầu tư là kỳ vọng và có rủi ro; lãi vay là chi phí chắc chắn. Xoá một khoản chi phí chắc chắn 25% khó có kênh đầu tư nào bì được.", en: "Investment return is uncertain; loan interest is a certainty. Removing a guaranteed 25% cost beats almost any expected return." },
  },
  {
    id: "v-t1-7", district: "vault", tier: 1,
    q: { vi: "Quỹ khẩn cấp nên để ở đâu?", en: "Where should an emergency fund be held?" },
    options: [
      { vi: "Nơi rút được trong 1–2 ngày và gần như không biến động giá", en: "Somewhere accessible within a day or two and effectively free of price swings" },
      { vi: "Trong cổ phiếu tăng trưởng để tiền không nằm chết", en: "In growth stocks so the money is not idle" },
      { vi: "Trong bất động sản", en: "In real estate" },
      { vi: "Trong altcoin vốn hoá nhỏ", en: "In small-cap altcoins" },
    ],
    answer: 0,
    why: { vi: "Quỹ khẩn cấp đánh đổi lợi suất lấy tính thanh khoản và ổn định. Đặt vào tài sản biến động là tự phá đúng chức năng của nó.", en: "An emergency fund trades yield for liquidity and stability. Putting it in volatile assets defeats its only purpose." },
  },
  {
    id: "v-t2-1", district: "vault", tier: 2,
    q: { vi: "Với khoản vay lãi suất thả nổi, rủi ro lớn nhất với ngân sách hộ gia đình là:", en: "For a floating-rate loan, the biggest household budget risk is:" },
    options: [
      { vi: "Kỳ điều chỉnh lãi làm nghĩa vụ trả nợ hằng tháng tăng đột ngột", en: "A rate reset raising the monthly payment abruptly" },
      { vi: "Không được trả nợ trước hạn", en: "You cannot repay early" },
      { vi: "Ngân hàng có thể thu hồi nhà bất cứ lúc nào", en: "The bank can seize the home at any time" },
      { vi: "Lãi suất chỉ có thể giảm", en: "Rates can only go down" },
    ],
    answer: 0,
    why: { vi: "Hãy thử kịch bản lãi tăng thêm 3–4 điểm phần trăm trước khi ký — nếu ngân sách vỡ, khoản vay quá lớn.", en: "Stress-test a 3–4 percentage-point rate rise before signing — if the budget breaks, the loan is too large." },
  },
  {
    id: "v-t2-2", district: "vault", tier: 2,
    q: { vi: "Quy tắc 72 dùng để ước lượng nhanh điều gì?", en: "What does the Rule of 72 estimate?" },
    options: [
      { vi: "Số năm để vốn tăng gấp đôi: 72 chia cho lãi suất %/năm", en: "Years to double your money: 72 divided by the annual % return" },
      { vi: "Tỷ lệ tiết kiệm tối ưu", en: "The optimal savings rate" },
      { vi: "Số cổ phiếu nên nắm giữ", en: "How many stocks to hold" },
      { vi: "Mức lạm phát trung bình", en: "The average inflation rate" },
    ],
    answer: 0,
    why: { vi: "Ở lãi suất 12%/năm, vốn gấp đôi sau khoảng 6 năm. Công thức này giúp bạn tỉnh táo trước các lời hứa \"x10 trong 1 năm\".", en: "At 12% a year money doubles in about six years. The rule keeps you grounded against \"10x in a year\" promises." },
  },
  {
    id: "v-t2-3", district: "vault", tier: 2,
    q: { vi: "Khi có nhiều khoản nợ, chiến lược \"debt avalanche\" ưu tiên trả khoản nào trước?", en: "With multiple debts, which does the debt avalanche method repay first?" },
    options: [
      { vi: "Khoản có lãi suất cao nhất", en: "The one with the highest interest rate" },
      { vi: "Khoản có số dư nhỏ nhất", en: "The smallest balance" },
      { vi: "Khoản vay lâu nhất", en: "The oldest loan" },
      { vi: "Khoản vay từ người thân", en: "The loan from family" },
    ],
    answer: 0,
    why: { vi: "Avalanche tối ưu về tiền lãi tiết kiệm; snowball (trả khoản nhỏ nhất trước) tối ưu về động lực tâm lý.", en: "Avalanche minimises interest paid; snowball (smallest balance first) optimises psychological momentum." },
  },
  {
    id: "v-t2-4", district: "vault", tier: 2,
    q: { vi: "Vì sao nên tách riêng tài khoản quỹ khẩn cấp khỏi tài khoản chi tiêu hằng ngày?", en: "Why keep the emergency fund in a separate account from daily spending?" },
    options: [
      { vi: "Giảm ma sát tâm lý khiến bạn tiêu lẹm vào quỹ mà không nhận ra", en: "It removes the friction gap that lets you drain the fund without noticing" },
      { vi: "Ngân hàng trả lãi cao gấp đôi", en: "The bank pays double the interest" },
      { vi: "Pháp luật bắt buộc", en: "It is legally required" },
      { vi: "Để tránh thuế thu nhập", en: "To avoid income tax" },
    ],
    answer: 0,
    why: { vi: "Thiết kế môi trường luôn hiệu quả hơn dựa vào ý chí. Tách tài khoản là hàng rào rẻ nhất bạn có thể dựng.", en: "Designing your environment beats relying on willpower. A separate account is the cheapest guardrail available." },
  },
  {
    id: "v-t2-5", district: "vault", tier: 2,
    q: { vi: "Lợi suất thực (real return) của khoản tiết kiệm 6%/năm khi lạm phát 5%/năm xấp xỉ:", en: "The real return on a 6% savings rate with 5% inflation is approximately:" },
    options: [
      { vi: "Khoảng 1%/năm", en: "About 1% a year" },
      { vi: "11%/năm", en: "11% a year" },
      { vi: "6%/năm", en: "6% a year" },
      { vi: "30%/năm", en: "30% a year" },
    ],
    answer: 0,
    why: { vi: "Nhìn lợi suất danh nghĩa mà bỏ qua lạm phát là cách phổ biến nhất để tự đánh lừa về tiến độ tích luỹ.", en: "Reading nominal yield while ignoring inflation is the most common way to fool yourself about progress." },
  },
  {
    id: "v-t3-1", district: "vault", tier: 3,
    q: { vi: "\"Sequence of returns risk\" gây hại nhất trong giai đoạn nào?", en: "When is sequence-of-returns risk most damaging?" },
    options: [
      { vi: "Những năm đầu sau khi bắt đầu rút vốn khỏi danh mục", en: "The first years after you begin withdrawing from the portfolio" },
      { vi: "Những năm đầu khi mới bắt đầu tích luỹ", en: "The first years of accumulation" },
      { vi: "Chỉ khi thị trường tăng", en: "Only in bull markets" },
      { vi: "Chỉ với danh mục toàn trái phiếu", en: "Only for all-bond portfolios" },
    ],
    answer: 0,
    why: { vi: "Một đợt giảm sâu ngay đầu giai đoạn rút vốn buộc bạn bán nhiều đơn vị hơn ở giá thấp, làm cạn danh mục sớm hơn nhiều.", en: "A deep drawdown right as withdrawals begin forces selling more units at low prices, exhausting the portfolio far sooner." },
  },
  {
    id: "v-t3-2", district: "vault", tier: 3,
    q: { vi: "Với mục tiêu tài chính có thời hạn dưới 2 năm (ví dụ đặt cọc mua nhà), lớp tài sản phù hợp nhất là:", en: "For a financial goal under two years away (e.g. a home deposit), the most appropriate asset class is:" },
    options: [
      { vi: "Tiền gửi kỳ hạn hoặc công cụ thu nhập cố định ngắn hạn", en: "Term deposits or short-duration fixed income" },
      { vi: "Cổ phiếu tăng trưởng", en: "Growth equities" },
      { vi: "Altcoin vốn hoá nhỏ", en: "Small-cap altcoins" },
      { vi: "Bất động sản nghỉ dưỡng", en: "Resort real estate" },
    ],
    answer: 0,
    why: { vi: "Thời hạn càng ngắn, khả năng chịu đựng biến động càng thấp. Ghép sai thời hạn với lớp tài sản là lỗi tốn kém nhất.", en: "The shorter the horizon, the lower the volatility tolerance. Mismatching horizon and asset class is the costliest error." },
  },
  {
    id: "v-t3-3", district: "vault", tier: 3,
    q: { vi: "Vì sao \"tỷ lệ tiết kiệm\" thường quyết định kết quả nhiều hơn \"lợi suất đầu tư\" trong 10 năm đầu?", en: "Why does savings rate usually matter more than investment return in the first decade?" },
    options: [
      { vi: "Khi vốn còn nhỏ, dòng tiền nộp vào lớn hơn nhiều so với phần lãi sinh ra", en: "While the balance is small, contributions dwarf the returns it generates" },
      { vi: "Vì lợi suất đầu tư luôn bằng 0 trong 10 năm đầu", en: "Because returns are always zero for ten years" },
      { vi: "Vì thuế chỉ đánh vào lợi nhuận", en: "Because tax only applies to gains" },
      { vi: "Vì lãi kép chỉ bắt đầu sau 10 năm", en: "Because compounding only starts after ten years" },
    ],
    answer: 0,
    why: { vi: "Với 100 triệu vốn, chênh 3% lợi suất là 3 triệu/năm — thua xa việc nâng tỷ lệ tiết kiệm thêm vài triệu mỗi tháng.", en: "On a ₫100M balance, 3% extra return is ₫3M a year — far less than lifting monthly contributions by a few million." },
  },
  {
    id: "v-t3-4", district: "vault", tier: 3,
    q: { vi: "Trong lập kế hoạch tài sản, \"asset allocation\" khác \"security selection\" ở chỗ:", en: "In planning, asset allocation differs from security selection in that:" },
    options: [
      { vi: "Allocation quyết định tỷ trọng giữa các lớp tài sản và giải thích phần lớn biến động danh mục", en: "Allocation sets weights across asset classes and explains most portfolio variance" },
      { vi: "Allocation là việc chọn từng mã cụ thể", en: "Allocation is picking individual tickers" },
      { vi: "Hai khái niệm hoàn toàn giống nhau", en: "They are exactly the same thing" },
      { vi: "Selection quyết định mức rủi ro tổng thể", en: "Selection determines overall risk level" },
    ],
    answer: 0,
    why: { vi: "Chọn đúng tỷ trọng cổ phiếu/trái phiếu/tiền mặt tác động tới kết quả mạnh hơn việc chọn được vài mã hay.", en: "Getting the stock/bond/cash mix right moves outcomes more than picking a few good names." },
  },

  /* ============================== ACADEMY ============================== */
  {
    id: "a-t1-1", district: "academy", tier: 1,
    q: { vi: "Nhật ký giao dịch có giá trị lớn nhất ở điểm nào?", en: "What is the greatest value of a trading journal?" },
    options: [
      { vi: "Ghi lại lý do vào lệnh trước khi biết kết quả, để đánh giá quyết định thay vì đánh giá may rủi", en: "Recording your reasoning before the outcome is known, so you judge decisions rather than luck" },
      { vi: "Khoe thành tích với cộng đồng", en: "Showing results to a community" },
      { vi: "Bắt buộc theo quy định pháp luật", en: "It is legally required" },
      { vi: "Giúp giảm phí giao dịch", en: "It lowers trading fees" },
    ],
    answer: 0,
    why: { vi: "Không có ghi chép trước, trí nhớ sẽ tự viết lại lịch sử theo hướng có lợi cho bạn — thiên kiến nhận thức muộn.", en: "Without a prior record, memory rewrites history in your favour — that is hindsight bias." },
  },
  {
    id: "a-t1-2", district: "academy", tier: 1,
    q: { vi: "FOMO trong đầu tư là gì?", en: "What is FOMO in investing?" },
    options: [
      { vi: "Nỗi sợ bỏ lỡ, khiến người ta mua đuổi khi giá đã tăng mạnh", en: "Fear of missing out, driving purchases after a price has already run" },
      { vi: "Một chỉ báo kỹ thuật", en: "A technical indicator" },
      { vi: "Loại lệnh giới hạn", en: "A type of limit order" },
      { vi: "Phí giao dịch của sàn", en: "An exchange fee" },
    ],
    answer: 0,
    why: { vi: "FOMO đảo ngược quy trình: quyết định trước, lý do tìm sau. Kế hoạch viết sẵn là liều thuốc rẻ nhất.", en: "FOMO inverts the process: decide first, rationalise later. A pre-written plan is the cheapest antidote." },
  },
  {
    id: "a-t1-3", district: "academy", tier: 1,
    q: { vi: "Đa dạng hoá danh mục nhằm mục đích chính nào?", en: "What is the main purpose of diversification?" },
    options: [
      { vi: "Giảm rủi ro riêng lẻ của từng tài sản mà không cần hy sinh toàn bộ lợi nhuận kỳ vọng", en: "Reducing idiosyncratic risk without giving up all expected return" },
      { vi: "Bảo đảm luôn có lãi mỗi năm", en: "Guaranteeing a profit every year" },
      { vi: "Tối đa hoá lợi nhuận ngắn hạn", en: "Maximising short-term return" },
      { vi: "Giảm thuế phải nộp", en: "Cutting taxes owed" },
    ],
    answer: 0,
    why: { vi: "Đa dạng hoá xử lý rủi ro riêng lẻ, không xử lý được rủi ro thị trường chung.", en: "Diversification addresses idiosyncratic risk; it cannot remove broad market risk." },
  },
  {
    id: "a-t1-4", district: "academy", tier: 1,
    q: { vi: "Trước khi vào một vị thế, điều nên xác định trước tiên là:", en: "Before entering a position, what should be decided first?" },
    options: [
      { vi: "Mức thua lỗ tối đa chấp nhận được và khối lượng vị thế tương ứng", en: "The maximum acceptable loss and the position size that fits it" },
      { vi: "Mục tiêu lợi nhuận trong mơ", en: "The dream profit target" },
      { vi: "Số người cũng đang mua mã đó", en: "How many others are buying it" },
      { vi: "Thời điểm khoe kết quả", en: "When to share the result" },
    ],
    answer: 0,
    why: { vi: "Bạn kiểm soát được rủi ro, không kiểm soát được lợi nhuận. Quản trị thứ mình kiểm soát được trước.", en: "You control risk, not reward. Manage the controllable side first." },
  },
  {
    id: "a-t1-5", district: "academy", tier: 1,
    q: { vi: "Một lời khuyên đầu tư hứa \"lợi nhuận cao, cam kết không rủi ro\" nên được hiểu là:", en: "An investment pitch promising \"high return, zero risk\" should be read as:" },
    options: [
      { vi: "Dấu hiệu cảnh báo — lợi nhuận và rủi ro luôn đi cùng nhau", en: "A red flag — return and risk always travel together" },
      { vi: "Cơ hội hiếm cần vào tiền ngay", en: "A rare chance to act immediately" },
      { vi: "Sản phẩm được nhà nước bảo lãnh", en: "A state-guaranteed product" },
      { vi: "Chiến lược của nhà đầu tư chuyên nghiệp", en: "A professional investor's strategy" },
    ],
    answer: 0,
    why: { vi: "Không có bữa trưa miễn phí. Cam kết lợi nhuận cao mà không rủi ro là đặc trưng của mô hình lừa đảo.", en: "There is no free lunch. Guaranteed high returns with no risk is the signature of a scam." },
  },
  {
    id: "a-t1-6", district: "academy", tier: 1,
    q: { vi: "Vì sao nên viết kế hoạch đầu tư ra giấy thay vì giữ trong đầu?", en: "Why write an investment plan down instead of keeping it in your head?" },
    options: [
      { vi: "Bản viết ra không đổi theo cảm xúc, còn suy nghĩ trong đầu thì có", en: "A written plan does not shift with your mood; a remembered one does" },
      { vi: "Vì pháp luật yêu cầu như vậy", en: "Because the law requires it" },
      { vi: "Vì sàn giao dịch sẽ kiểm tra", en: "Because the exchange will audit it" },
      { vi: "Vì kế hoạch viết ra luôn đúng", en: "Because a written plan is always correct" },
    ],
    answer: 0,
    why: { vi: "Bạn viết kế hoạch lúc bình tĩnh nhưng thực thi lúc thị trường đang làm bạn sợ hoặc tham. Bản giấy là tiếng nói của con người tỉnh táo hơn.", en: "You write the plan calmly but execute it while the market makes you fearful or greedy. The written page is the calmer version of you speaking." },
  },
  {
    id: "a-t1-7", district: "academy", tier: 1,
    q: { vi: "Khung thời gian đầu tư ảnh hưởng thế nào tới mức biến động bạn nên chấp nhận?", en: "How does your time horizon affect the volatility you should accept?" },
    options: [
      { vi: "Thời gian càng dài càng chịu được biến động lớn, vì có đủ thời gian phục hồi", en: "The longer the horizon, the more volatility you can bear — there is time to recover" },
      { vi: "Không liên quan gì tới nhau", en: "They are unrelated" },
      { vi: "Thời gian ngắn thì nên chọn tài sản biến động mạnh để kịp lãi", en: "Short horizons call for volatile assets so gains arrive in time" },
      { vi: "Chỉ số vốn mới quyết định, không phải thời gian", en: "Only capital size matters, not time" },
    ],
    answer: 0,
    why: { vi: "Tiền cần dùng trong 6 tháng và tiền để 20 năm là hai bài toán khác nhau. Ghép sai thời hạn với biến động là lỗi khiến người ta bán đúng đáy.", en: "Money needed in six months and money left for twenty years are different problems. Mismatching horizon and volatility is what makes people sell at the bottom." },
  },
  {
    id: "a-t2-1", district: "academy", tier: 2,
    q: { vi: "Thiên kiến xác nhận (confirmation bias) biểu hiện thế nào trong đầu tư?", en: "How does confirmation bias show up in investing?" },
    options: [
      { vi: "Chỉ tìm đọc thông tin ủng hộ vị thế đang nắm, bỏ qua bằng chứng ngược lại", en: "Seeking only information that supports the position you hold, ignoring contrary evidence" },
      { vi: "Mua khi giá giảm", en: "Buying when prices fall" },
      { vi: "Đặt lệnh dừng lỗ quá gần", en: "Placing stops too tight" },
      { vi: "Giao dịch quá ít", en: "Trading too rarely" },
    ],
    answer: 0,
    why: { vi: "Cách chống hiệu quả: viết trước điều kiện nào sẽ khiến bạn thừa nhận luận điểm sai và thoát vị thế.", en: "A reliable counter: write down in advance what evidence would prove your thesis wrong and force an exit." },
  },
  {
    id: "a-t2-2", district: "academy", tier: 2,
    q: { vi: "\"Loss aversion\" (ác cảm thua lỗ) khiến nhà đầu tư thường mắc lỗi nào?", en: "Which mistake does loss aversion typically cause?" },
    options: [
      { vi: "Giữ mã lỗ quá lâu và chốt mã lãi quá sớm", en: "Holding losers too long and cutting winners too early" },
      { vi: "Mua quá nhiều cổ phiếu cổ tức", en: "Buying too many dividend stocks" },
      { vi: "Đọc báo cáo tài chính quá kỹ", en: "Reading financial statements too carefully" },
      { vi: "Tiết kiệm quá nhiều", en: "Saving too much" },
    ],
    answer: 0,
    why: { vi: "Nỗi đau khi lỗ mạnh gấp khoảng hai lần niềm vui khi lãi cùng mức — khiến hành vi lệch một cách hệ thống.", en: "The pain of a loss registers about twice as strongly as the pleasure of an equal gain, skewing behaviour systematically." },
  },
  {
    id: "a-t2-3", district: "academy", tier: 2,
    q: { vi: "Quản trị khối lượng vị thế theo % rủi ro nghĩa là:", en: "Position sizing by percentage risk means:" },
    options: [
      { vi: "Mỗi lệnh chỉ để mất tối đa một tỷ lệ nhỏ cố định trên tổng vốn, ví dụ 1–2%", en: "Each trade risks at most a small fixed share of total capital, e.g. 1–2%" },
      { vi: "Luôn dùng toàn bộ vốn cho mỗi lệnh", en: "Always deploying full capital per trade" },
      { vi: "Chỉ mua cổ phiếu dưới 20.000 đồng", en: "Only buying stocks under ₫20,000" },
      { vi: "Chia đều vốn cho đúng 10 mã", en: "Splitting capital evenly across exactly ten names" },
    ],
    answer: 0,
    why: { vi: "Với rủi ro 2%/lệnh, cần chuỗi thua rất dài mới cháy tài khoản — đó là điều giữ bạn ở lại cuộc chơi.", en: "At 2% risk per trade it takes a very long losing streak to blow up — that is what keeps you in the game." },
  },
  {
    id: "a-t2-4", district: "academy", tier: 2,
    q: { vi: "Vì sao \"kết quả tốt\" không đồng nghĩa với \"quyết định tốt\"?", en: "Why is a good outcome not the same as a good decision?" },
    options: [
      { vi: "Vì kết quả chịu tác động của may rủi; chỉ quy trình lặp lại được mới đo được chất lượng quyết định", en: "Outcomes carry luck; only a repeatable process reveals decision quality" },
      { vi: "Vì thị trường luôn hiệu quả", en: "Because markets are always efficient" },
      { vi: "Vì lợi nhuận không quan trọng", en: "Because profit does not matter" },
      { vi: "Vì mọi quyết định đều như nhau", en: "Because all decisions are equal" },
    ],
    answer: 0,
    why: { vi: "Đánh giá bản thân qua quy trình giúp bạn không củng cố thói quen xấu chỉ vì một lần may mắn.", en: "Judging yourself on process stops you from reinforcing bad habits after a lucky win." },
  },
  {
    id: "a-t2-5", district: "academy", tier: 2,
    q: { vi: "Khi thị trường giảm mạnh, hành động phù hợp nhất với một kế hoạch tích luỹ dài hạn là:", en: "In a sharp market decline, what best fits a long-term accumulation plan?" },
    options: [
      { vi: "Bám kế hoạch đã viết sẵn, rà lại luận điểm, điều chỉnh nếu dữ kiện thay đổi chứ không vì cảm xúc", en: "Sticking to the written plan, re-checking the thesis, adjusting on new facts rather than emotion" },
      { vi: "Bán toàn bộ ngay lập tức", en: "Selling everything immediately" },
      { vi: "Vay thêm để mua trung bình giá xuống", en: "Borrowing to average down" },
      { vi: "Ngừng theo dõi danh mục vĩnh viễn", en: "Never looking at the portfolio again" },
    ],
    answer: 0,
    why: { vi: "Kế hoạch viết lúc bình tĩnh luôn tốt hơn quyết định lúc hoảng loạn — đó chính là lý do phải viết trước.", en: "A plan written calmly beats a decision made in panic — which is exactly why you write it in advance." },
  },
  {
    id: "a-t3-1", district: "academy", tier: 3,
    q: { vi: "Kỳ vọng toán học (expectancy) của một chiến lược được tính từ đâu?", en: "How is a strategy's expectancy calculated?" },
    options: [
      { vi: "Tỷ lệ thắng × lãi trung bình − tỷ lệ thua × lỗ trung bình", en: "Win rate × average gain − loss rate × average loss" },
      { vi: "Chỉ từ tỷ lệ lệnh thắng", en: "From win rate alone" },
      { vi: "Chỉ từ tổng lợi nhuận năm ngoái", en: "From last year's total profit alone" },
      { vi: "Từ số lượng chỉ báo sử dụng", en: "From how many indicators you use" },
    ],
    answer: 0,
    why: { vi: "Chiến lược thắng 35% vẫn có thể lãi bền nếu lãi trung bình gấp ba lần lỗ trung bình.", en: "A 35% win rate can still be profitable if the average win is three times the average loss." },
  },
  {
    id: "a-t3-2", district: "academy", tier: 3,
    q: { vi: "\"Overfitting\" khi tối ưu một chiến lược trên dữ liệu quá khứ nghĩa là:", en: "Overfitting a strategy on historical data means:" },
    options: [
      { vi: "Tinh chỉnh tham số khớp nhiễu của quá khứ, dẫn tới hiệu quả sụp đổ trên dữ liệu mới", en: "Tuning parameters to past noise, so performance collapses on fresh data" },
      { vi: "Dùng quá ít dữ liệu lịch sử", en: "Using too little historical data" },
      { vi: "Giao dịch với khối lượng quá lớn", en: "Trading with too much size" },
      { vi: "Không đặt lệnh dừng lỗ", en: "Not using stop losses" },
    ],
    answer: 0,
    why: { vi: "Kiểm chứng bằng dữ liệu ngoài mẫu (out-of-sample) là hàng rào tối thiểu trước khi tin vào bất kỳ backtest nào.", en: "Out-of-sample validation is the minimum guardrail before trusting any backtest." },
  },
  {
    id: "a-t3-3", district: "academy", tier: 3,
    q: { vi: "\"Maximum drawdown\" của một danh mục cho biết điều gì?", en: "What does a portfolio's maximum drawdown tell you?" },
    options: [
      { vi: "Mức sụt giảm sâu nhất từ đỉnh xuống đáy — thước đo bạn phải chịu đựng được về mặt tâm lý lẫn tài chính", en: "The deepest peak-to-trough fall — what you must be able to withstand financially and psychologically" },
      { vi: "Tổng số lệnh thua liên tiếp", en: "The count of consecutive losing trades" },
      { vi: "Phí giao dịch tối đa", en: "The maximum trading fee" },
      { vi: "Lợi nhuận cao nhất từng đạt", en: "The highest profit ever reached" },
    ],
    answer: 0,
    why: { vi: "Một chiến lược lãi 40%/năm nhưng có drawdown 60% là vô dụng nếu bạn bỏ cuộc ở mức giảm 30%.", en: "A 40%-a-year strategy with a 60% drawdown is useless if you quit at −30%." },
  },
  {
    id: "a-t3-4", district: "academy", tier: 3,
    q: { vi: "Vì sao nên viết trước \"điều kiện thoát\" cho mỗi luận điểm đầu tư dài hạn?", en: "Why write an exit condition in advance for each long-term thesis?" },
    options: [
      { vi: "Để phân biệt được \"luận điểm đã sai\" với \"giá đang biến động\" — hai tình huống đòi hỏi phản ứng ngược nhau", en: "To separate \"the thesis broke\" from \"the price is moving\" — two situations demanding opposite responses" },
      { vi: "Để tối đa hoá số lần giao dịch", en: "To maximise trade count" },
      { vi: "Để đáp ứng yêu cầu của sàn", en: "To meet exchange requirements" },
      { vi: "Để giảm thuế", en: "To reduce tax" },
    ],
    answer: 0,
    why: { vi: "Không có ranh giới viết sẵn, mọi cú giảm đều dễ bị diễn giải thành \"cơ hội mua thêm\".", en: "Without a written boundary, every decline gets reinterpreted as \"a chance to add\"." },
  },
];

/* ------------------------------------------------------------------ */
/*  Bộ sinh đề                                                         */
/* ------------------------------------------------------------------ */

/** PRNG tất định (mulberry32) — cùng seed cho cùng đề, đổi seed cho lần thi lại. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffled<T>(items: readonly T[], next: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Bậc khó theo cấp đang thi: 1–5 nền tảng, 6–10 vận dụng, 11–15 nâng cao. */
export function tiersForLevel(level: number): QuizTier[] {
  if (level <= 5) return [1];
  if (level <= 10) return [1, 2];
  return [2, 3];
}

export interface ExamQuestion {
  question: QuizQuestion;
  /** thứ tự phương án đã xáo; phần tử là chỉ số gốc trong `question.options` */
  order: number[];
}

export interface Exam {
  district: ExamDistrict;
  level: number;
  attempt: number;
  questions: ExamQuestion[];
}

/**
 * Dựng đề 5 câu cho một lần thăng cấp. `attempt` khác nhau cho ra đề khác nhau
 * nên thi lại không phải là chép lại đáp án cũ.
 */
export function buildExam(district: ExamDistrict, level: number, attempt: number): Exam {
  const next = rng(hashSeed(`${district}|${level}|${attempt}`));
  const tiers = tiersForLevel(level);
  const inTier = BANK.filter((q) => q.district === district && tiers.includes(q.tier));
  const fallback = BANK.filter((q) => q.district === district);
  const pool = inTier.length >= EXAM_SIZE ? inTier : fallback;
  const picked = shuffled(pool, next).slice(0, Math.min(EXAM_SIZE, pool.length));
  return {
    district,
    level,
    attempt,
    questions: picked.map((question) => ({
      question,
      order: shuffled(question.options.map((_, index) => index), next),
    })),
  };
}

export function questionText(question: QuizQuestion, lang: Lang): string {
  return question.q[lang];
}

export function optionText(question: QuizQuestion, index: number, lang: Lang): string {
  return question.options[index]?.[lang] ?? "";
}

export function explanationText(question: QuizQuestion, lang: Lang): string {
  return question.why[lang];
}

/** Dùng cho kiểm thử và bảng thống kê nội dung. */
export const QUESTION_COUNT = BANK.length;
