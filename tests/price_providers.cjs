/**
 * Chuỗi nguồn giá: thứ tự thử, và các chốt chặn an toàn.
 *
 * Chạy hoàn toàn offline — `fetch` toàn cục được thay bằng bản giả — nên bài
 * kiểm tra này không phụ thuộc việc Yahoo hay Binance có chặn IP hay không.
 * Đó cũng chính là lý do nó tồn tại: sandbox và một số nhà mạng chặn thẳng các
 * nguồn giá, nên phần logic xoay vòng nguồn phải kiểm chứng được mà không cần
 * gọi ra Internet.
 *
 *   node tests/price_providers.cjs
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

/** Thay `fetch` bằng bản giả; trả về danh sách URL đã được gọi. */
function stubFetch(routes) {
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    for (const [pattern, reply] of routes) {
      if (!String(url).includes(pattern)) continue;
      if (reply instanceof Error) throw reply;
      if (typeof reply === "number") return { ok: false, status: reply };
      return {
        ok: true,
        status: 200,
        json: async () => reply,
        text: async () => (typeof reply === "string" ? reply : JSON.stringify(reply)),
      };
    }
    return { ok: false, status: 404 };
  };
  return calls;
}

/** Gọi một hàm serverless bằng cặp request/response giả. */
async function invoke(handler, url) {
  let status = 200;
  let body = "";
  const response = {
    setHeader() {},
    end(chunk) {
      body = chunk ?? "";
    },
    set statusCode(value) {
      status = value;
    },
    get statusCode() {
      return status;
    },
  };
  await handler({ url, method: "GET" }, response);
  return { status, json: JSON.parse(body || "{}") };
}

async function main() {
  const providers = await import("../api/_providers.js");

  await test("yahooQuote đổi sang query2 khi query1 trả 403", async () => {
    const calls = stubFetch([
      ["query1.finance.yahoo.com", 403],
      ["query2.finance.yahoo.com", { chart: { result: [{ meta: { regularMarketPrice: 191.2, chartPreviousClose: 188.0, currency: "USD" } }] } }],
    ]);
    const quote = await providers.yahooQuote("AAPL");
    assert.equal(quote.price, 191.2);
    assert.equal(quote.source, "yahoo:query2");
    assert.equal(calls.length, 2, `phải thử đúng hai host, đã gọi ${calls.length}`);
  });

  await test("yahooQuote ném lỗi khi cả hai host đều hỏng", async () => {
    stubFetch([["finance.yahoo.com", 403]]);
    await assert.rejects(() => providers.yahooQuote("AAPL"));
  });

  await test("stooqQuote đọc giá đóng cửa và phiên trước từ CSV", async () => {
    stubFetch([["stooq.com", "Date,Open,High,Low,Close,Volume\n2026-08-28,180,185,179,184.5,1000\n2026-08-29,184,190,183,188.25,1200\n"]]);
    const quote = await providers.stooqQuote("AAPL");
    assert.equal(quote.price, 188.25);
    assert.equal(quote.previousClose, 184.5);
    assert.equal(quote.source, "stooq");
  });

  await test("stooqQuote từ chối mã Việt Nam (Stooq không phủ HOSE/HNX)", async () => {
    stubFetch([]);
    await assert.rejects(() => providers.stooqQuote("VCB.VN"), /stooq_unsupported_symbol/);
  });

  await test("binanceQuotes ghép cặp USDT và bỏ qua chính USDT", async () => {
    const calls = stubFetch([
      ["api.binance.com", [
        { symbol: "BTCUSDT", lastPrice: "97250.10", priceChangePercent: "2.4" },
        { symbol: "ETHUSDT", lastPrice: "3420.55", priceChangePercent: "-1.2" },
      ]],
    ]);
    const rows = await providers.binanceQuotes(["BTC", "ETH", "USDT"]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].symbol, "BTC");
    assert.equal(rows[0].price, 97250.1);
    assert.equal(rows[1].changePct, -1.2);
    assert.ok(!calls[0].includes("USDTUSDT"), "không được hỏi cặp USDTUSDT");
  });

  await test("binanceQuotes đổi tên RNDR thành RENDER", async () => {
    const calls = stubFetch([["api.binance.com", [{ symbol: "RENDERUSDT", lastPrice: "7.40", priceChangePercent: "0.5" }]]]);
    const rows = await providers.binanceQuotes(["RNDR"]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].symbol, "RNDR", "phải trả về ký hiệu của ứng dụng, không phải của Binance");
    assert.ok(calls[0].includes("RENDERUSDT"));
  });

  await test("coingeckoQuotes LOẠI mục có ký hiệu không khớp", async () => {
    /* Chốt chặn quan trọng nhất: nếu COINGECKO_IDS có một mã sai, giá của đồng
       khác tuyệt đối không được hiện ra dưới tên mã đang hỏi. */
    stubFetch([["api.coingecko.com", [
      { id: "bitcoin", symbol: "btc", current_price: 97250, price_change_percentage_24h: 2.4 },
      { id: "ethereum", symbol: "xyz", current_price: 1, price_change_percentage_24h: 0 },
    ]]]);
    const rows = await providers.coingeckoQuotes(["BTC", "ETH"]);
    assert.equal(rows.length, 1, "chỉ BTC được nhận");
    assert.equal(rows[0].symbol, "BTC");
    assert.equal(rows[0].price, 97250);
  });

  await test("coingeckoQuotes bỏ qua ký hiệu không có trong bản đồ", async () => {
    stubFetch([["api.coingecko.com", []]]);
    const rows = await providers.coingeckoQuotes(["NOTACOIN"]);
    assert.equal(rows.length, 0);
  });

  await test("cmcQuotes im lặng khi chưa đặt CMC_API_KEY", async () => {
    delete process.env.CMC_API_KEY;
    stubFetch([]);
    assert.deepEqual(await providers.cmcQuotes(["BTC"]), []);
  });

  await test("bản đồ CoinGecko không có mã trùng nhau", async () => {
    const ids = Object.values(providers.COINGECKO_IDS);
    const seen = new Set();
    for (const id of ids) {
      assert.ok(id, "không được có mục rỗng");
      assert.ok(!seen.has(id), `mã CoinGecko bị trùng: ${id}`);
      seen.add(id);
    }
  });

  await test("/api/quotes rơi từ Yahoo xuống Stooq cho mã Mỹ", async () => {
    stubFetch([
      ["finance.yahoo.com", 403],
      ["stooq.com", "Date,Open,High,Low,Close,Volume\n2026-08-28,180,185,179,184.5,1000\n2026-08-29,184,190,183,188.25,1200\n"],
    ]);
    const { default: handler } = await import("../api/quotes.js");
    const body = await invoke(handler, "/api/quotes?symbols=AAPL");
    assert.equal(body.status, 200, "phải trả 200 nhờ nguồn dự phòng");
    assert.equal(body.json.quotes.length, 1);
    assert.equal(body.json.quotes[0].price, 188.25);
    assert.equal(body.json.quotes[0].source, "stooq");
  });

  await test("/api/crypto rơi từ Binance xuống CoinGecko", async () => {
    stubFetch([
      ["api.binance.com", 451],
      ["api.coingecko.com", [{ id: "bitcoin", symbol: "btc", current_price: 97250, price_change_percentage_24h: 2.4 }]],
    ]);
    const { default: handler } = await import("../api/crypto.js");
    const body = await invoke(handler, "/api/crypto?symbols=BTC");
    assert.equal(body.status, 200);
    assert.equal(body.json.quotes[0].source, "coingecko");
    assert.equal(body.json.quotes[0].price, 97250);
    /* `tried` là thứ giúp chẩn đoán khi giá không lên: nó nói rõ nguồn nào hỏng. */
    assert.ok(body.json.tried.some((row) => row.provider === "binanceQuotes" && row.error));
  });

  if (failures.length) {
    process.stderr.write(`\n✗ ${failures.length} kiểm tra thất bại\n`);
    process.exit(1);
  }
  process.stdout.write("\n✓ Chuỗi nguồn giá hoạt động đúng thứ tự và chặn được mã sai\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
