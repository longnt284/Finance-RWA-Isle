/**
 * Ảnh kiểm chứng cho phần giao diện: các bảng bên phải, luồng khảo thí đầy đủ,
 * và một góc nhìn ngẩng lên trời để soi mặt trăng cùng dải sao.
 *
 *   node tests/panel_shots.cjs --out .artifacts/panels
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

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
  const out = readArg("--out", ".artifacts/panels");
  /* --only exam | sky | panels — chạy lẻ từng phần cho nhanh khi soi lại. */
  const only = readArg("--only", "");
  const wants = (section) => !only || only === section;
  fs.mkdirSync(out, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(),
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/ERR_|Failed to load resource|WebSocket/.test(text)) return;
    errors.push(text);
  });

  async function boot(hour, world = {}) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ([save, prefs]) => localStorage.setItem("vuong-state-v3", JSON.stringify({ ...save, world: { ...save.world, ...prefs } })),
      [SAVE, world]
    );
    await page.addInitScript(
      ({ h }) => {
        const RealDate = Date;
        const target = new RealDate(2026, 6, 15, h, 30, 0).getTime();
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
        window.Date = ShiftedDate;
      },
      { h: hour }
    );
    await page.reload({ waitUntil: "load" });
    await page.locator("canvas").waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForTimeout(5_000);
  }

  const shot = async (name) => {
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    process.stdout.write(`  ✓ ${name}.png\n`);
  };

  const open = async (label) => {
    await page.getByRole("button", { name: label, exact: true }).first().click();
    await page.waitForTimeout(1_400);
  };
  const close = async () => {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  };

  /* ------------------------- bảng bên phải ------------------------- */
  if (wants("panels")) {
  process.stdout.write("Bảng bên phải:\n");
  await boot(10);

  await open("Điểm danh");
  await shot("checkin-quests");
  await close();

  await open("Khí hậu & thời gian");
  await shot("world-yacht");
  /* Cuộn xuống xưởng du thuyền để thấy đủ 5 hạng. */
  await page.locator('div[role="dialog"] .overflow-y-auto').first().evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.waitForTimeout(600);
  await shot("world-yacht-bottom");
  await close();

  await open("Tài khoản");
  await shot("account-privacy");
  await close();

  await open("Thị trường");
  await page.getByRole("button", { name: "Cổ phiếu VN", exact: true }).click();
  await page.waitForTimeout(1_200);
  await shot("market-vn");
  await page.getByRole("button", { name: "Cổ phiếu Mỹ", exact: true }).click();
  await page.waitForTimeout(1_200);
  await shot("market-us");
  await close();
  }

  /* --------------------------- khảo thí --------------------------- */
  if (wants("exam")) {
  process.stdout.write("Khảo thí:\n");
  if (only) await boot(10);
  /* Chip điều hướng cũng chứa nhãn "Chờ khảo thí" trong tên trợ năng của nó,
     nên phải lấy nút cuối cùng — đó mới là lời mời ở giữa màn hình. */
  await page.getByRole("button", { name: /Chờ khảo thí/ }).last().click();
  await page.waitForTimeout(1_600);
  await shot("exam-intro");
  await page.getByRole("button", { name: "Bắt đầu khảo thí", exact: true }).click();
  await page.waitForTimeout(900);
  await shot("exam-question");

  for (let i = 0; i < 5; i++) {
    const options = page.locator("button[data-exam-option]");
    const count = await options.count();
    if (count === 0) {
      process.stdout.write(`  ! câu ${i + 1}: không thấy phương án\n`);
      break;
    }
    /* Chọn phương án đầu tiên đang hiển thị — cố tình không nhắm đúng đáp án,
       mục đích là xem cả màn hình tổng kết lẫn phần giải thích khi sai. */
    await options.first().click();
    await page.waitForTimeout(300);
    const next = page.getByRole("button", { name: /^(Câu tiếp|Nộp bài)$/ }).first();
    if (!(await next.count())) break;
    await next.click();
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1_000);
  await shot("exam-result");
  await page.locator('div[role="dialog"] .overflow-y-auto').first().evaluate((el) => el.scrollTo(0, 420));
  await page.waitForTimeout(500);
  await shot("exam-review");
  await close();
  }

  /* ------------------- bầu trời đêm: trăng và sao ------------------- */
  if (wants("sky")) {
  process.stdout.write("Bầu trời đêm:\n");
  await boot(1);
  /* Kéo chuột lên để ngẩng camera nhìn trời. */
  await page.mouse.move(700, 500);
  await page.mouse.down();
  await page.mouse.move(700, 850, { steps: 24 });
  await page.mouse.up();
  await page.waitForTimeout(2_500);
  await shot("night-sky");
  }

  await browser.close();
  process.stdout.write(errors.length ? `\nLỗi JS:\n${errors.join("\n")}\n` : "\nKhông có lỗi JS.\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
