/**
 * Ảnh chụp kiểm chứng thủ công cho các tính năng mới: chu kỳ ngày/đêm, bốn mùa,
 * thời tiết, khảo thí, điểm danh, nhiệm vụ, tài khoản và các hạng du thuyền.
 *
 * Không phải test pass/fail — mục đích là dựng đủ trạng thái để soi bằng mắt.
 *   node tests/feature_shots.cjs --out .artifacts/features
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

/** Bản lưu dựng sẵn: cấp cao, có bài khảo thí đang chờ, du thuyền hạng tối đa. */
const SAVE = {
  city: "Đảo Kiểm Thử",
  focus: "crypto",
  onboarded: true,
  lang: "vi",
  currency: "VND",
  xp: { crypto: 40000, stocks: 20000, vault: 20000, academy: 20000 },
  certified: { crypto: 14, stocks: 12, vault: 12, academy: 12 },
  examAttempts: { crypto: 0, stocks: 0, vault: 0, academy: 0 },
  examsPassed: 11,
  goals: [],
  tasks: [],
  notes: [],
  customAch: [],
  snapshots: [{ t: Date.now() - 86400000, v: 620000000 }, { t: Date.now(), v: 715000000 }],
  log: [],
  streak: 6,
  lastVisit: "",
  lastClaim: "",
  claims: 12,
  checkinDay: 4,
  events: 5,
  totalTasksDone: 24,
  visits: ["crypto", "stocks", "vault"],
  watchlist: ["c0", "c1", "c4", "v0", "u2"],
  isleDecor: { crypto: ["palms", "neon", "dock"], stocks: ["flags", "dock"], vault: ["palms", "torch"], academy: ["palms", "flags"] },
  isleTheme: { crypto: "emerald", stocks: "sunset", vault: "lagoon", academy: "violet" },
  yachtTier: 5,
  world: { mode: "manual", season: "summer", weather: "clear", quality: "high", effects: true },
  account: null,
  privacyAccepted: false,
  tutorialSeen: true,
};

async function main() {
  const url = readArg("--url", "http://127.0.0.1:3000");
  const out = readArg("--out", ".artifacts/features");
  fs.mkdirSync(out, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(),
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    const text = message.text();
    // Bỏ qua lỗi mạng: sandbox chặn Yahoo Finance và Binance.
    if (message.type() !== "error") return;
    if (/ERR_|Failed to load resource|WebSocket/.test(text)) return;
    errors.push(text);
  });

  /**
   * Dịch chuyển đồng hồ của trang tới giờ mong muốn.
   *
   * Cố ý KHÔNG dùng `page.clock.install`: nó đóng băng luôn requestAnimationFrame
   * nên vòng lặp render của Three.js đứng im và ảnh chụp ra khung hình trắng.
   * Ở đây chỉ thay `Date` — thời gian vẫn trôi bình thường, chỉ lệch đi một
   * khoảng cố định, đúng thứ mà bầu trời và bộ chọn mùa cần.
   */
  async function boot(world, hour) {
    let addInit = null;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ([save, worldPrefs]) => {
        localStorage.setItem("vuong-state-v3", JSON.stringify({ ...save, world: { ...save.world, ...worldPrefs } }));
      },
      [SAVE, world]
    );
    addInit = await page.addInitScript(
      ({ y, mo, d, h }) => {
        const RealDate = Date;
        const target = new RealDate(y, mo, d, h, 30, 0).getTime();
        const bootedAt = RealDate.now();
        class ShiftedDate extends RealDate {
          constructor(...args) {
            if (args.length === 0) super(target + (RealDate.now() - bootedAt));
            else super(...args);
          }
          static now() {
            return target + (RealDate.now() - bootedAt);
          }
        }
        // eslint-disable-next-line no-global-assign
        window.Date = ShiftedDate;
      },
      { y: 2026, mo: 6, d: 15, h: hour }
    );
    void addInit;
    await page.reload({ waitUntil: "load" });
    await page.locator("canvas").waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForTimeout(5_000);
  }

  const shot = async (name) => {
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    process.stdout.write(`  ✓ ${name}.png\n`);
  };

  /* ---------------- chu kỳ thời gian trong ngày ---------------- */
  process.stdout.write("Thời gian trong ngày:\n");
  for (const [name, hour] of [["day-dawn", 6], ["day-noon", 12], ["day-dusk", 18], ["day-night", 23]]) {
    await boot({ season: "summer", weather: "clear" }, hour);
    await shot(name);
  }

  /* ---------------- bốn mùa ---------------- */
  process.stdout.write("Bốn mùa (giữa trưa, trời quang):\n");
  for (const season of ["spring", "summer", "autumn", "winter"]) {
    await boot({ season, weather: "clear" }, 11);
    await shot(`season-${season}`);
  }

  /* ---------------- thời tiết ---------------- */
  process.stdout.write("Thời tiết:\n");
  for (const [weather, hour] of [["rain", 11], ["storm", 11], ["snow", 11], ["petals", 11], ["leaves", 11], ["mist", 11], ["fireflies", 22]]) {
    await boot({ season: "summer", weather }, hour);
    await shot(`weather-${weather}`);
  }

  /* ---------------- các bảng giao diện ---------------- */
  process.stdout.write("Bảng giao diện:\n");
  await boot({ season: "summer", weather: "clear" }, 10);

  const openByLabel = async (label) => {
    const button = page.getByRole("button", { name: label, exact: true }).first();
    await button.click();
    await page.waitForTimeout(1_200);
  };

  await openByLabel("Điểm danh");
  await shot("panel-checkin-quests");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  await openByLabel("Khí hậu & thời gian");
  await shot("panel-world-yacht");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  await openByLabel("Tài khoản");
  await shot("panel-account-privacy");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  await openByLabel("Thị trường");
  const vnTab = page.getByRole("button", { name: "Cổ phiếu VN", exact: true });
  if (await vnTab.count()) {
    await vnTab.click();
    await page.waitForTimeout(900);
  }
  await shot("panel-market-vn");
  const usTab = page.getByRole("button", { name: "Cổ phiếu Mỹ", exact: true });
  if (await usTab.count()) {
    await usTab.click();
    await page.waitForTimeout(900);
    await shot("panel-market-us");
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  /* ---------------- khảo thí ---------------- */
  process.stdout.write("Khảo thí:\n");
  const examCta = page.getByRole("button", { name: /Chờ khảo thí/ }).first();
  if (await examCta.count()) {
    await examCta.click();
    await page.waitForTimeout(1_600);
    await shot("exam-intro");
    const start = page.getByRole("button", { name: "Bắt đầu khảo thí", exact: true });
    if (await start.count()) {
      await start.click();
      await page.waitForTimeout(800);
      await shot("exam-question");
      /* Trả lời hết 5 câu bằng phương án đầu tiên để xem màn hình tổng kết. */
      for (let i = 0; i < 5; i++) {
        const options = page.locator('div[role="dialog"] button').filter({ hasText: /^[A-D]/ });
        if (await options.count()) await options.first().click();
        await page.waitForTimeout(250);
        const next = page.getByRole("button", { name: /Câu tiếp|Nộp bài/ }).first();
        if (await next.count()) await next.click();
        await page.waitForTimeout(400);
      }
      await page.waitForTimeout(800);
      await shot("exam-result");
    }
  } else {
    process.stdout.write("  ! không thấy nút khảo thí\n");
  }

  /* ---------------- du thuyền hạng 5 ---------------- */
  process.stdout.write("Du thuyền:\n");
  await boot({ season: "summer", weather: "clear" }, 19);
  const yacht = page.getByRole("button", { name: "Du thuyền", exact: true }).first();
  if (await yacht.count()) {
    await yacht.click();
    await page.waitForTimeout(2_200);
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(2_600);
    await page.keyboard.up("KeyW");
    await page.waitForTimeout(700);
    await shot("yacht-tier5");
  }

  /* ---------------- điện thoại ---------------- */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(900);
  await shot("mobile-overview");

  await browser.close();
  process.stdout.write(errors.length ? `\nLỗi JS: ${JSON.stringify(errors, null, 2)}\n` : "\nKhông có lỗi JS.\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
