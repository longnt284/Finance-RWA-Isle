/* ------------------------------------------------------------------ */
/*  /api/news — bảng tin thị trường                                    */
/*                                                                     */
/*  Gom nhiều nguồn RSS công khai lại thành một dòng tin đã sắp xếp.    */
/*  Chạy phía máy chủ vì hai lý do quen thuộc: RSS không có CORS, và    */
/*  vài nguồn chặn theo vùng. Một nguồn hỏng thì các nguồn còn lại vẫn  */
/*  lên bảng — trường `tried` nói rõ nguồn nào hỏng vì lý do gì.        */
/* ------------------------------------------------------------------ */

const UA = "Finance-RWA-Isle/1.0 (+news-aggregator)";
const CACHE_TTL_MS = 180_000;
const PER_FEED = 12;
const MAX_ITEMS = 90;

let cache = { at: 0, value: null };

/** Mỗi nguồn được gắn sẵn chủ đề và ngôn ngữ để client lọc mà không cần đoán. */
const FEEDS = [
  { id: "coindesk", name: "CoinDesk", topic: "crypto", lang: "en", url: "https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml" },
  { id: "cointelegraph", name: "Cointelegraph", topic: "crypto", lang: "en", url: "https://cointelegraph.com/rss" },
  { id: "decrypt", name: "Decrypt", topic: "crypto", lang: "en", url: "https://decrypt.co/feed" },
  { id: "yahoo", name: "Yahoo Finance", topic: "world", lang: "en", url: "https://finance.yahoo.com/news/rssindex" },
  { id: "cnbc-markets", name: "CNBC Markets", topic: "world", lang: "en", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258" },
  { id: "vnexpress", name: "VnExpress Kinh doanh", topic: "vn", lang: "vi", url: "https://vnexpress.net/rss/kinh-doanh.rss" },
  { id: "cafef", name: "CafeF Chứng khoán", topic: "stocks", lang: "vi", url: "https://cafef.vn/thi-truong-chung-khoan.rss" },
  { id: "vietstock", name: "Vietstock", topic: "stocks", lang: "vi", url: "https://vietstock.vn/144/chung-khoan/co-phieu.rss" },
];

const FEED_BY_ID = new Map(FEEDS.map((feed) => [feed.id, feed]));

/* ------------------------------ parse ------------------------------ */

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#34": '"', hellip: "…", ndash: "–", mdash: "—",
};

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, code) => {
    if (code[0] === "#") {
      const value = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) && value > 0 && value < 0x110000 ? String.fromCodePoint(value) : whole;
    }
    const mapped = ENTITIES[code.toLowerCase()];
    return mapped === undefined ? whole : mapped;
  });
}

function clean(raw, limit = 400) {
  if (!raw) return "";
  const withoutCdata = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  const withoutTags = withoutCdata.replace(/<[^>]*>/g, " ");
  const text = decodeEntities(withoutTags).replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function tagValue(block, tag) {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(block);
  return match ? match[1] : "";
}

/** Ảnh minh hoạ nếu nguồn có gắn — enclosure, media:content hoặc <img> trong mô tả. */
function imageOf(block) {
  const enclosure = /<(?:enclosure|media:content|media:thumbnail)[^>]*url="([^"]+)"/i.exec(block);
  if (enclosure) return enclosure[1];
  const inline = /<img[^>]*src=(?:"|&quot;|')([^"'&]+)/i.exec(block);
  return inline ? inline[1] : "";
}

function parseFeed(xml, feed) {
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((match) => match[0]);
  const items = [];
  for (const block of blocks.slice(0, PER_FEED)) {
    const title = clean(tagValue(block, "title"), 200);
    if (!title) continue;
    let link = clean(tagValue(block, "link"), 600);
    if (!link) {
      const href = /<link[^>]*href="([^"]+)"/i.exec(block);
      link = href ? href[1] : "";
    }
    if (!/^https?:\/\//i.test(link)) continue;
    const dateRaw = tagValue(block, "pubDate") || tagValue(block, "published") || tagValue(block, "updated") || tagValue(block, "dc:date");
    const parsed = Date.parse(clean(dateRaw, 60));
    items.push({
      id: `${feed.id}:${link}`,
      title,
      link,
      summary: clean(tagValue(block, "description") || tagValue(block, "summary") || tagValue(block, "content:encoded"), 260),
      image: imageOf(block),
      source: feed.name,
      sourceId: feed.id,
      topic: feed.topic,
      lang: feed.lang,
      ts: Number.isFinite(parsed) ? parsed : Date.now(),
    });
  }
  return items;
}

async function loadFeed(feed) {
  const response = await fetch(feed.url, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
    signal: AbortSignal.timeout(7_000),
  });
  if (!response.ok) throw new Error(`upstream_${response.status}`);
  const xml = await response.text();
  const items = parseFeed(xml, feed);
  if (!items.length) throw new Error("empty_feed");
  return items;
}

/** Gọi song song mọi nguồn; một nguồn hỏng không được kéo cả bảng tin xuống. */
export async function collectNews(ids = FEEDS.map((feed) => feed.id)) {
  const wanted = ids.map((id) => FEED_BY_ID.get(id)).filter(Boolean);
  const tried = [];
  const settled = await Promise.allSettled(wanted.map((feed) => loadFeed(feed)));
  const seen = new Set();
  const items = [];
  settled.forEach((result, index) => {
    const feed = wanted[index];
    if (result.status === "fulfilled") {
      tried.push({ feed: feed.id, ok: result.value.length });
      for (const item of result.value) {
        const key = item.link.replace(/[?#].*$/, "");
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(item);
      }
    } else {
      tried.push({ feed: feed.id, error: String(result.reason?.message || result.reason) });
    }
  });
  items.sort((a, b) => b.ts - a.ts);
  return { items: items.slice(0, MAX_ITEMS), tried };
}

/* ------------------------------ handler ------------------------------ */

export default async function handler(request, response) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=600");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }
  if (request.method && request.method !== "GET") {
    response.statusCode = 405;
    response.setHeader("Allow", "GET, OPTIONS");
    response.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }

  if (cache.value && Date.now() - cache.at < CACHE_TTL_MS) {
    response.statusCode = 200;
    response.end(JSON.stringify(cache.value));
    return;
  }

  const { items, tried } = await collectNews();
  const body = { items, tried, asOf: Date.now() };
  if (items.length) cache = { at: Date.now(), value: body };
  response.statusCode = items.length ? 200 : 502;
  response.end(JSON.stringify(body));
}

export { FEEDS, parseFeed, clean };
