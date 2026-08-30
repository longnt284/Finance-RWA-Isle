/**
 * Kiểm chứng luồng THI ĐẬU của phòng khảo thí.
 *
 * Đáp án đúng được tính bằng chính bộ sinh đề `buildExam` trong `src/lib/quiz.ts`
 * (biên dịch tại chỗ bằng esbuild) với đúng seed mà ứng dụng sẽ dùng, nên bài
 * kiểm tra này bấm trúng đáp án một cách tất định thay vì đoán mò.
 *
 * Nó tồn tại vì một lỗi thật: trước đây `target` được đọc trực tiếp từ store,
 * nên ngay khi thi đậu, `certified` tăng lên làm `pendingExamLevel` trả null và
 * cả hộp thoại biến mất — người chơi không bao giờ thấy màn hình "Đạt".
 *
 *   node tests/exam_pass.cjs --out .artifacts/panels
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const esbuild = require("esbuild");
const { chromium } = require("playwright");

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const DISTRICT = "crypto";
const TARGET_LEVEL = 15;
const ATTEMPT = 0;

const SAVE = {
  city: "Đảo Kiểm Thử",
  focus: "crypto",
  onboarded: true,
  lang: "vi",
  currency: "VND",
  xp: { crypto: 40000, stocks: 20000, vault: 20000, academy: 20000 },
  certified: { crypto: 14, stocks: 12, vault: 12, academy: 12 },
  examAttempts: { crypto: ATTEMPT, stocks: 0, vault: 0, academy: 0 },
  examsPassed: 11,
  goals: [], tasks: [], notes: [], customAch: [], snapshots: [], log: [],
  streak: 6, lastVisit: "", lastClaim: "", claims: 12, checkinDay: 4,
  events: 5, totalTasksDone: 24, visits: ["crypto"],
  watchlist: ["c0", "c1"],
  isleDecor: { crypto: [], stocks: [], vault: [], academy: [] },
  isleTheme: { crypto: "emerald", stocks: "sunset", vault: "lagoon", academy: "violet" },
  yachtTier: 5,
  world: { mode: "manual", season: "summer", weather: "clear", quality: "high", effects: true },
  account: null,
  privacyAccepted: true,
  tutorialSeen: true,
};

/** Biên dịch quiz.ts sang CJS rồi nạp, để dùng đúng bộ sinh đề của ứng dụng. */
function loadQuiz() {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "quiz.ts"), "utf8");
  const { code } = esbuild.transformSync(source, { loader: "ts", format: "cjs", target: "node18" });
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "quiz-")), "quiz.cjs");
  fs.writeFileSync(file, code, "utf8");
  return require(file);
}

async function main() {
  const url = readArg("--url", "http://127.0.0.1:3000");
  const out = readArg("--out", ".artifacts/panels");
  fs.mkdirSync(out, { recursive: true });

  const quiz = loadQuiz();
  const exam = quiz.buildExam(DISTRICT, TARGET_LEVEL, ATTEMPT);
  /* `order` là thứ tự phương án đã xáo; vị trí của đáp án đúng chính là chỉ số
     nút cần bấm trên màn hình. */
  const correctPositions = exam.questions.map((item) => item.order.indexOf(item.question.answer));
  process.stdout.write(`Đề gồm ${exam.questions.length} câu; vị trí đáp án đúng: ${correctPositions.join(", ")}\n`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(),
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate((save) => localStorage.setItem("vuong-state-v3", JSON.stringify(save)), SAVE);
  await page.reload({ waitUntil: "load" });
  await page.locator("canvas").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(4_000);

  await page.getByRole("button", { name: /Chờ khảo thí/ }).last().click();
  await page.waitForTimeout(1_200);
  await page.getByRole("button", { name: "Bắt đầu khảo thí", exact: true }).click();
  await page.waitForTimeout(700);

  for (let i = 0; i < correctPositions.length; i++) {
    const shown = await page.locator("button[data-exam-option]").count();
    if (shown === 0) throw new Error(`Câu ${i + 1}: không thấy phương án nào`);
    await page.locator(`button[data-exam-option="${correctPositions[i]}"]`).click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: /^(Câu tiếp|Nộp bài)$/ }).first().click();
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1_200);
  await page.screenshot({ path: path.join(out, "exam-passed.png") });

  const dialogVisible = await page.locator('div[role="dialog"][aria-label="Phòng khảo thí"]').isVisible();
  const bodyText = await page.locator("body").innerText();
  const showsPass = /Đạt — thăng Cấp 15/.test(bodyText);
  /* Cấp mới phải xuất hiện ngay trên thanh điều hướng, không cần tải lại. */
  const navShowsNewLevel = /C15/.test(bodyText);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("vuong-state-v3") || "{}"));
  const certified = saved?.certified?.crypto;

  await browser.close();

  const results = [
    ["hộp thoại còn hiển thị sau khi đậu", dialogVisible],
    ["hiện dòng 'Đạt — thăng Cấp 15'", showsPass],
    ["thanh điều hướng cập nhật lên C15", navShowsNewLevel],
    ["certified.crypto đã lưu = 15", certified === 15],
    ["không có lỗi JS", errors.length === 0],
  ];
  for (const [label, ok] of results) process.stdout.write(`${ok ? "  ✓" : "  ✕"} ${label}\n`);
  if (errors.length) process.stdout.write(`${errors.join("\n")}\n`);
  if (results.some(([, ok]) => !ok)) throw new Error("Luồng thi đậu chưa đúng");
  process.stdout.write("Luồng thi đậu hoạt động đúng.\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
