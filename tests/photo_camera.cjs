/**
 * Ảnh kiểm chứng cho giá máy, chế độ ảnh và bộ sưu tập cá.
 *
 * Không phải test pass/fail về mặt hình ảnh — nó dựng đủ trạng thái để soi bằng
 * mắt — nhưng nó CÓ fail khi trang ném lỗi hoặc khi nút "Chụp" không xuất ra
 * được tệp PNG. Hai thứ đó từng hỏng thật: bản đầu tiên tải ảnh qua data URL và
 * Chrome im lặng từ chối chuỗi vài chục megabyte.
 *
 *   npx vite preview --port 4173
 *   node tests/photo_camera.cjs --url http://127.0.0.1:4173 --out .artifacts/photo
 */
const fs = require("node:fs"), path = require("node:path");
const { chromium } = require("playwright");

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const url = readArg("--url", "http://127.0.0.1:4173");
const outArg = readArg("--out", ".artifacts/photo");
const R = path.join(__dirname, "..");
const SAVE = {
  city: "Đảo Kiểm Thử", focus: "crypto", onboarded: true, lang: "vi", currency: "VND",
  xp: { crypto: 40000, stocks: 20000, vault: 20000, academy: 20000 },
  certified: { crypto: 14, stocks: 12, vault: 12, academy: 12 },
  examAttempts: { crypto: 0, stocks: 0, vault: 0, academy: 0 }, examsPassed: 11,
  goals: [], tasks: [], notes: [], customAch: [], snapshots: [], log: [],
  streak: 6, lastVisit: "", lastClaim: "", claims: 12, checkinDay: 4, events: 5,
  totalTasksDone: 24, visits: [], watchlist: ["c0"],
  isleDecor: { crypto: [], stocks: [], vault: [], academy: [] },
  isleTheme: { crypto: "emerald", stocks: "sunset", vault: "lagoon", academy: "violet" },
  coins: 5000,
  fish: { sardine:{n:4,best:.3,first:Date.now()}, marlin:{n:1,best:88,first:Date.now()},
    crab:{n:2,best:.5,first:Date.now()}, manta:{n:1,best:120,first:Date.now()},
    squid:{n:3,best:1.2,first:Date.now()}, goldenkoi:{n:1,best:8,first:Date.now()},
    lobster:{n:2,best:2,first:Date.now()}, hammerhead:{n:1,best:210,first:Date.now()},
    pufferfish:{n:1,best:1.1,first:Date.now()}, oarfish:{n:1,best:40,first:Date.now()},
    treasure:{n:1,best:12,first:Date.now()}, seaweed:{n:6,best:.4,first:Date.now()} },
  basket: [{ id: "marlin", w: 60, v: 300, ts: Date.now() }],
  fishCaught: 42, fishEarned: 4200,
  shop: { owned: [], placed: { main: [], crypto: [], stocks: [], vault: [], academy: [] } },
  yachtTier: 5,
  world: { mode: "manual", season: "summer", weather: "clear", quality: "high", effects: true },
  account: null, privacyAccepted: false, tutorialSeen: true,
};
(async () => {
  const OUT = path.isAbsolute(outArg) ? outArg : path.join(R, outArg); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath() });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 880 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e));
  page.on("console", m => { const t = m.text(); if (m.type()==="error" && !/ERR_|net::|Failed to load|WebSocket/.test(t)) errs.push("console: " + t); });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate((s) => { localStorage.setItem("vuong-state-v3", JSON.stringify(s)); sessionStorage.removeItem("vuong-greeted"); }, SAVE);
  await page.addInitScript(({y,mo,d,h}) => { const R=Date, t=new R(y,mo,d,h,30,0).getTime(), b=R.now();
    class S extends R { constructor(...a){ a.length? super(...a) : super(t + (R.now()-b)); } static now(){ return t + (R.now()-b); } }
    window.Date = S; }, { y:2026, mo:6, d:15, h:11 });
  await page.reload({ waitUntil: "load" });
  const shot = async (n) => { await page.screenshot({ path: path.join(OUT, n + ".png") }); console.log("  ✓", n); };
  await page.waitForTimeout(3000); await shot("1-hero-returning");
  await page.getByText("Vào đảo").click();
  await page.locator("canvas").waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(15000); await shot("2-world");
  await page.getByRole("button", { name: "Góc máy" }).first().click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Flycam toàn đảo" }).click(); await page.waitForTimeout(6000); await shot("3-shot-drone");
  await page.keyboard.press("KeyP"); await page.waitForTimeout(4000); await shot("4-photo");
  const sl = page.locator('input[type="range"]').first();
  await sl.evaluate((el) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    s.call(el, "17.75"); el.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.waitForTimeout(5000); await shot("5-photo-goldenhour");
  const dl = page.waitForEvent("download", { timeout: 120000 }).catch(() => null);
  await page.getByRole("button", { name: "Chụp", exact: true }).click();
  const d = await dl;
  if (d) { const f = path.join(OUT, "6-export.png"); await d.saveAs(f); console.log("  ✓ export", d.suggestedFilename(), fs.statSync(f).size, "bytes"); }
  else { console.error("  ✗ không xuất được ảnh PNG"); errs.push("export failed"); }
  await page.keyboard.press("Escape"); await page.waitForTimeout(1500);
  await page.keyboard.press("KeyH"); await page.waitForTimeout(1500); await shot("7-clean");
  await page.keyboard.press("KeyH"); await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Câu cá" }).first().click(); await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Bộ sưu tập" }).first().click(); await page.waitForTimeout(1200); await shot("8-collection");
  console.log(errs.length ? "\nLỖI:\n" + errs.join("\n") : "\nKhông có lỗi console.");
  await b.close(); process.exit(errs.length ? 1 : 0);
})();
