/**
 * Tự chơi minigame câu cá cho tới khi bắt được một con, rồi kiểm tra bản lưu:
 * bộ sưu tập có loài mới, giỏ cá có thêm một con, `fishCaught` nhích lên.
 *
 * Bài kiểm tra này bấm thật chứ không giả lập: nó đọc vị trí khung và vị trí cá
 * từ DOM (`data-rod-bar`, `data-rod-fish`) rồi giữ hoặc thả chuột đúng như một
 * người chơi. Nhờ vậy nó phủ trọn đường đi từ vòng lặp requestAnimationFrame,
 * qua reducer, tới localStorage — phần mà kiểm thử thuần hàm không chạm tới.
 *
 * Cần `npm run dev` chạy ở terminal khác.
 *   node tests/fishing_play.cjs
 */
const assert = require("node:assert");
const { chromium } = require("playwright");

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const SAVE = {
  city: "Đảo Câu Cá",
  focus: "crypto",
  onboarded: true,
  lang: "vi",
  currency: "VND",
  xp: { crypto: 2300, stocks: 0, vault: 0, academy: 0 },
  certified: { crypto: 6, stocks: 0, vault: 0, academy: 0 },
  examAttempts: { crypto: 0, stocks: 0, vault: 0, academy: 0 },
  examsPassed: 0,
  goals: [], tasks: [], notes: [], customAch: [], snapshots: [], log: [],
  streak: 1, lastVisit: "", lastClaim: "", claims: 0, checkinDay: 0, events: 0, totalTasksDone: 0,
  visits: [], watchlist: [],
  isleDecor: { crypto: [], stocks: [], vault: [], academy: [] },
  isleTheme: { crypto: "emerald", stocks: "sunset", vault: "lagoon", academy: "violet" },
  coins: 0, fish: {}, basket: [], fishCaught: 0, fishEarned: 0,
  shop: { owned: [], placed: { main: [], crypto: [], stocks: [], vault: [], academy: [] } },
  yachtTier: 1,
  /* "cân bằng" tắt bloom: bài kiểm tra cần khung hình nhanh, không cần đẹp. */
  world: { mode: "manual", season: "summer", weather: "clear", quality: "balanced", effects: false },
  account: null, privacyAccepted: false, tutorialSeen: true,
};

/** Đọc vị trí khung và cá theo phần trăm chiều cao cần câu. */
async function readRod(page) {
  return page.evaluate(() => {
    const bar = document.querySelector("[data-rod-bar]");
    const fish = document.querySelector("[data-rod-fish]");
    if (!bar || !fish) return null;
    const track = bar.parentElement;
    const trackBox = track.getBoundingClientRect();
    const barBox = bar.getBoundingClientRect();
    const fishBox = fish.getBoundingClientRect();
    const toUnit = (clientY) => (trackBox.bottom - clientY) / trackBox.height;
    return {
      barLow: toUnit(barBox.bottom),
      barHigh: toUnit(barBox.top),
      fish: toUnit(fishBox.top + fishBox.height / 2),
      hooked: !document.querySelector("[data-rod-bar]").parentElement.querySelector(".grid.place-items-center"),
    };
  });
}

async function main() {
  const url = readArg("--url", "http://127.0.0.1:3000");
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(),
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.addInitScript((save) => localStorage.setItem("vuong-state-v3", JSON.stringify(save)), SAVE);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

  await page.getByRole("button", { name: "Câu cá", exact: false }).first().click();
  await page.locator("[data-rod-bar]").waitFor({ timeout: 15000 });

  const track = page.locator("[data-rod-bar]").locator("..");
  const box = await track.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  /* Tự lái: cá ở trên khung thì giữ để nâng, ở dưới thì thả cho khung rơi. */
  let holding = false;
  const deadline = Date.now() + 150_000;
  let caught = false;
  while (Date.now() < deadline) {
    const rod = await readRod(page);
    if (rod) {
      const centre = (rod.barLow + rod.barHigh) / 2;
      const wantHold = rod.fish > centre;
      if (wantHold !== holding) {
        if (wantHold) await page.mouse.down();
        else await page.mouse.up();
        holding = wantHold;
      }
    }
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem("vuong-state-v3") || "{}"));
    if ((save.fishCaught ?? 0) > 0) {
      caught = true;
      break;
    }
    await page.waitForTimeout(60);
  }
  if (holding) await page.mouse.up();

  const save = await page.evaluate(() => JSON.parse(localStorage.getItem("vuong-state-v3") || "{}"));
  await browser.close();

  assert.deepEqual(pageErrors, [], `trang ném lỗi: ${pageErrors.join(" · ")}`);
  assert.ok(caught, "chơi 150 giây mà không bắt được con nào — minigame có thể đã hỏng");
  assert.equal(save.fishCaught, 1, `fishCaught phải là 1, đang là ${save.fishCaught}`);
  assert.equal(save.basket.length, 1, "con cá vừa bắt phải nằm trong giỏ");
  assert.equal(Object.keys(save.fish).length, 1, "bộ sưu tập phải ghi nhận đúng một loài");
  const [id, record] = Object.entries(save.fish)[0];
  assert.equal(record.n, 1, "số lần bắt của loài đó phải là 1");
  assert.ok(record.best > 0, "kỷ lục cân nặng phải dương");
  assert.equal(save.basket[0].id, id, "con trong giỏ phải cùng loài với dòng vừa thêm vào bộ sưu tập");
  assert.ok(save.basket[0].v > 0, "con cá trong giỏ phải có giá bán dương");
  assert.ok(save.xp.crypto > SAVE.xp.crypto, "bắt cá phải cộng XP cho lĩnh vực trọng tâm");

  console.log(`✓ Bắt được ${id} · ${record.best} kg · ${save.basket[0].v} xu; bộ sưu tập và giỏ cá khớp nhau`);
}

void main();
