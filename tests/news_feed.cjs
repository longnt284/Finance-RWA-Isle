/**
 * Bộ gom RSS của bảng tin: bóc tách item, dọn CDATA/HTML, khử trùng lặp và
 * chịu được nguồn hỏng.
 *
 * Chạy hoàn toàn offline — `fetch` toàn cục được thay bằng bản giả. Đó cũng là
 * lý do bài kiểm tra này tồn tại: sandbox CI và nhiều nhà mạng chặn thẳng
 * CoinDesk, VnExpress hay CafeF, nên phần logic phải kiểm chứng được mà không
 * cần gọi ra Internet. Một nguồn 403 không bao giờ được kéo cả bảng tin xuống.
 *
 *   node tests/news_feed.cjs
 */
const assert = require("node:assert");

const failures = [];
async function test(name, fn) {
  try {
    await fn();
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (error) {
    process.stdout.write(`  ✗ ${name} — ${error.message}\n`);
    failures.push(name);
  }
}

/** Thay `fetch` bằng bản giả trả về XML theo từng host. */
function stubFetch(routes) {
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    for (const [pattern, reply] of routes) {
      if (!String(url).includes(pattern)) continue;
      if (typeof reply === "number") return { ok: false, status: reply };
      return { ok: true, status: 200, text: async () => reply };
    }
    return { ok: false, status: 404 };
  };
  return calls;
}

const RSS = (items) => `<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`;

const ITEM = (title, link, extra = "") => `
  <item>
    <title>${title}</title>
    <link>${link}</link>
    <pubDate>Fri, 29 Aug 2026 09:30:00 +0700</pubDate>
    ${extra}
  </item>`;

async function main() {
  const news = await import("../api/news.js");

  await test("bóc tách được tiêu đề, liên kết và thời điểm đăng", async () => {
    const xml = RSS(ITEM("VN-Index vượt 1.400 điểm", "https://cafef.vn/a.html", "<description>Thanh khoản tăng mạnh.</description>"));
    const rows = news.parseFeed(xml, { id: "cafef", name: "CafeF", topic: "stocks", lang: "vi" });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, "VN-Index vượt 1.400 điểm");
    assert.equal(rows[0].link, "https://cafef.vn/a.html");
    assert.equal(rows[0].topic, "stocks");
    assert.equal(rows[0].summary, "Thanh khoản tăng mạnh.");
    assert.equal(rows[0].ts, Date.parse("Fri, 29 Aug 2026 09:30:00 +0700"));
  });

  await test("gỡ CDATA, thẻ HTML và giải mã thực thể", () => {
    assert.equal(news.clean("<![CDATA[Bitcoin &amp; vàng]]>"), "Bitcoin & vàng");
    assert.equal(news.clean("<p>Giá <b>tăng</b> 5%</p>"), "Giá tăng 5%");
    assert.equal(news.clean("Ph&#7889;i h&#7907;p"), "Phối hợp");
  });

  await test("cắt tóm tắt quá dài và thêm dấu lược", () => {
    const long = "x".repeat(500);
    const trimmed = news.clean(long, 40);
    assert.equal(trimmed.length, 40);
    assert.ok(trimmed.endsWith("…"), "phải kết thúc bằng dấu lược");
  });

  await test("loại mục không có liên kết http", () => {
    const xml = RSS(`${ITEM("Không có link", "")}${ITEM("Có link", "https://vnexpress.net/b.html")}`);
    const rows = news.parseFeed(xml, { id: "vnexpress", name: "VnExpress", topic: "vn", lang: "vi" });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, "Có link");
  });

  await test("đọc được ảnh từ enclosure và từ thẻ img trong mô tả", () => {
    const withEnclosure = RSS(ITEM("A", "https://x.test/a", '<enclosure url="https://img.test/a.jpg" type="image/jpeg" />'));
    const withInline = RSS(ITEM("B", "https://x.test/b", "<description><![CDATA[<img src=\"https://img.test/b.jpg\" />Nội dung]]></description>"));
    const feed = { id: "coindesk", name: "CoinDesk", topic: "crypto", lang: "en" };
    assert.equal(news.parseFeed(withEnclosure, feed)[0].image, "https://img.test/a.jpg");
    assert.equal(news.parseFeed(withInline, feed)[0].image, "https://img.test/b.jpg");
  });

  await test("một nguồn 403 không kéo cả bảng tin xuống", async () => {
    stubFetch([
      ["coindesk.com", 403],
      ["vnexpress.net", RSS(ITEM("Tin trong nước", "https://vnexpress.net/c.html"))],
    ]);
    const { items, tried } = await news.collectNews(["coindesk", "vnexpress"]);
    assert.equal(items.length, 1, "vẫn phải còn tin của nguồn chạy được");
    assert.equal(items[0].source, "VnExpress Kinh doanh");
    const failed = tried.find((row) => row.feed === "coindesk");
    assert.ok(failed && failed.error.includes("403"), "phải nói rõ nguồn nào hỏng vì sao");
  });

  await test("khử trùng lặp theo liên kết, bỏ qua query và neo", async () => {
    stubFetch([
      ["coindesk.com", RSS(ITEM("Cùng một bài", "https://news.test/x?utm_source=a"))],
      ["cointelegraph.com", RSS(ITEM("Cùng một bài", "https://news.test/x#top"))],
    ]);
    const { items } = await news.collectNews(["coindesk", "cointelegraph"]);
    assert.equal(items.length, 1, `một bài trùng phải chỉ còn một dòng, đang có ${items.length}`);
  });

  await test("sắp xếp tin mới nhất lên đầu", async () => {
    const older = `<item><title>Cũ</title><link>https://news.test/old</link><pubDate>Mon, 25 Aug 2026 08:00:00 +0000</pubDate></item>`;
    const newer = `<item><title>Mới</title><link>https://news.test/new</link><pubDate>Fri, 29 Aug 2026 08:00:00 +0000</pubDate></item>`;
    stubFetch([
      ["coindesk.com", RSS(older)],
      ["vnexpress.net", RSS(newer)],
    ]);
    const { items } = await news.collectNews(["coindesk", "vnexpress"]);
    assert.deepEqual(items.map((item) => item.title), ["Mới", "Cũ"]);
  });

  await test("mọi nguồn hỏng thì trả về danh sách rỗng chứ không ném lỗi", async () => {
    stubFetch([["", 500]]);
    const { items, tried } = await news.collectNews(["coindesk", "vnexpress"]);
    assert.equal(items.length, 0);
    assert.equal(tried.length, 2);
  });

  if (failures.length) {
    console.error(`\n✗ Bảng tin: ${failures.length} bài kiểm tra hỏng`);
    process.exit(1);
  }
  console.log("\n✓ Bộ gom RSS bóc tách đúng và chịu được nguồn hỏng");
}

void main();
