/**
 * Bảng "Hoạt động" phải đổi ngôn ngữ theo giao diện — kể cả những dòng đã ghi
 * từ trước.
 *
 * Nó tồn tại vì một lỗi thật: `LogEntry` từng lưu `text` là câu đã dịch sẵn tại
 * thời điểm sự kiện xảy ra. Đổi sang tiếng Anh thì tiêu đề panel thành
 * "Activity" nhưng mọi dòng bên dưới vẫn nguyên tiếng Việt, và hậu tố thời gian
 * vẫn là "3g"/"4ng". Giờ nhật ký lưu khoá i18n và được dịch lại lúc vẽ.
 *
 *   node tests/feed_language.cjs --url http://127.0.0.1:3000
 */
const { chromium } = require("playwright");

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const HOUR = 3_600_000;

/* Bản lưu có sẵn nhật ký ở CẢ HAI dạng: dạng mới (khoá i18n) và dạng cũ
   (`text` đã nướng sẵn) — bản lưu cũ trên máy người chơi vẫn phải hiện ra
   được chứ không biến thành dòng trống. */
const SAVE = {
  city: "Đảo Kiểm Thử",
  focus: "crypto",
  onboarded: true,
  lang: "vi",
  currency: "VND",
  xp: { crypto: 4000, stocks: 2000, vault: 2000, academy: 2000 },
  certified: { crypto: 5, stocks: 4, vault: 4, academy: 4 },
  examAttempts: { crypto: 0, stocks: 0, vault: 0, academy: 0 },
  examsPassed: 3,
  goals: [],
  tasks: [],
  notes: [],
  customAch: [],
  snapshots: [{ t: Date.now(), v: 715000000 }],
  log: [
    { id: "l1", ts: Date.now() - 3 * HOUR, k: "log.daily", p: { x: 30 }, pk: { d: "d.crypto.name" }, kind: "xp", xp: 30 },
    { id: "l2", ts: Date.now() - 4 * HOUR, k: "log.lvl", pk: { b: "d.crypto.building" }, p: { n: 1 }, kind: "level" },
    { id: "l3", ts: Date.now() - 4 * HOUR, k: "log.founded", p: { c: "Đảo Rồng" }, pk: { d: "d.crypto.name" }, kind: "system" },
    { id: "l4", ts: Date.now() - 5 * HOUR, k: "log.evUp", p: { s: "BTC", c: "8.2" }, kind: "event" },
    { id: "l5", ts: Date.now() - 6 * HOUR, text: "Dòng nhật ký từ bản lưu cũ", kind: "system" },
  ],
  streak: 6,
  lastVisit: "",
  lastClaim: "",
  claims: 12,
  checkinDay: 4,
  events: 5,
  totalTasksDone: 24,
  visits: ["crypto", "stocks", "vault"],
  watchlist: ["c0", "c1"],
  isleDecor: { crypto: ["palms"], stocks: [], vault: [], academy: [] },
  isleTheme: { crypto: "emerald", stocks: "sunset", vault: "lagoon", academy: "violet" },
  yachtTier: 2,
  world: { mode: "manual", season: "summer", weather: "clear", quality: "high", effects: true },
  account: null,
  privacyAccepted: true,
  tutorialSeen: true,
};

/* Dấu phụ tiếng Việt: thứ tuyệt đối không được còn lại khi đang chạy tiếng Anh. */
const VIETNAMESE = /[ăâđêôơưĂÂĐÊÔƠƯáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/;

const failures = [];
function check(label, ok, detail) {
  if (ok) process.stdout.write(`  ✓ ${label}\n`);
  else {
    process.stdout.write(`  ✗ ${label} — ${detail}\n`);
    failures.push(`${label}: ${detail}`);
  }
}

async function main() {
  const url = readArg("--url", "http://127.0.0.1:3000");
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(),
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate((save) => localStorage.setItem("vuong-state-v3", JSON.stringify(save)), SAVE);
  await page.reload({ waitUntil: "load" });
  await page.locator("canvas").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(2_500);

  /* Panel Hoạt động là khối có nút tiêu đề; đọc cả cụm cho chắc. */
  const feed = page.locator("div.panel").filter({ has: page.locator("button") }).last();

  async function feedText() {
    return (await feed.innerText()).trim();
  }

  /* ---------------------------- tiếng Việt ---------------------------- */
  const vi = await feedText();
  check("VI: tiêu đề panel là 'Hoạt động'", vi.includes("Hoạt động"), `đọc được: ${vi.slice(0, 60)}`);
  check("VI: dòng điểm danh đã dịch", vi.includes("Quận Crypto"), "không thấy 'Quận Crypto'");
  check("VI: không lộ khoá i18n thô", !/\blog\.[a-zA-Z]+/.test(vi), `còn khoá thô: ${vi.match(/\blog\.\w+/g)}`);
  check("VI: dòng bản lưu cũ vẫn hiện", vi.includes("bản lưu cũ"), "dòng chỉ có `text` bị mất");
  check("VI: hậu tố giờ là 'g'", /\d+g\b/.test(vi), "không thấy dạng '3g'");

  /* ----------------------------- tiếng Anh ---------------------------- */
  await page.getByRole("button", { name: "en", exact: true }).click();
  await page.waitForTimeout(800);
  const en = await feedText();

  check("EN: tiêu đề panel là 'Activity'", en.includes("Activity"), `đọc được: ${en.slice(0, 60)}`);
  check("EN: dòng điểm danh đã dịch sang Anh", en.includes("Crypto District"), "không thấy 'Crypto District'");
  check("EN: dòng thăng cấp đã dịch", /upgraded|Level/i.test(en), "không thấy chuỗi cấp bằng tiếng Anh");
  check("EN: sự kiện thị trường đã dịch", en.includes("Market swing"), "không thấy 'Market swing'");
  check("EN: hậu tố giờ là 'h'", /\d+h\b/.test(en) && !/\d+g\b/.test(en), `hậu tố còn sai: ${en.match(/\d+[a-z]+\b/g)}`);
  check("EN: không lộ khoá i18n thô", !/\blog\.[a-zA-Z]+/.test(en), `còn khoá thô: ${en.match(/\blog\.\w+/g)}`);

  /* Dòng duy nhất được phép còn dấu tiếng Việt là dòng bản lưu cũ (đã nướng
     sẵn câu chữ, không còn khoá để dịch lại) và tên đảo do người chơi đặt. */
  const stray = en
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => VIETNAMESE.test(line) && !line.includes("bản lưu cũ") && !line.includes("Đảo Rồng"));
  check("EN: không còn dòng tiếng Việt sót lại", stray.length === 0, `còn ${stray.length} dòng: ${stray.join(" | ")}`);

  await browser.close();

  if (failures.length) {
    process.stderr.write(`\n✗ ${failures.length} kiểm tra thất bại\n`);
    process.exit(1);
  }
  process.stdout.write("\n✓ Bảng Hoạt động đổi ngôn ngữ đúng ở cả hai chiều\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
