const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function main() {
  const url = readArg("--url", "http://127.0.0.1:3000");
  const out = readArg("--out");
  if (!out) throw new Error("--out is required");
  fs.mkdirSync(out, { recursive: true });

  const consoleErrors = [];
  const pageErrors = [];
  const failedResponses = [];
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(),
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  const sampleFps = () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          const samples = [];
          let previous = performance.now();
          const frame = (now) => {
            samples.push(now - previous);
            previous = now;
            if (samples.length < 120) requestAnimationFrame(frame);
            else {
              samples.sort((a, b) => a - b);
              resolve({
                averageFps: Math.round(1000 / (samples.reduce((sum, value) => sum + value, 0) / samples.length)),
                p95FrameMs: Math.round(samples[Math.floor(samples.length * 0.95)] * 10) / 10,
              });
            }
          };
          requestAnimationFrame(frame);
        })
    );

  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.locator("canvas").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(2_000);
  await page.screenshot({ path: path.join(out, "hero.png"), fullPage: true });
  const heroFrameRate = await sampleFps();

  const navigation = await page.evaluate(() => {
    const entry = performance.getEntriesByType("navigation")[0];
    return entry
      ? {
          domInteractive: Math.round(entry.domInteractive),
          domContentLoaded: Math.round(entry.domContentLoadedEventEnd),
          loadEventEnd: Math.round(entry.loadEventEnd),
          transferSize: entry.transferSize,
        }
      : null;
  });

  const demo = page.getByRole("button", { name: "Xem bản demo có sẵn" });
  if (await demo.count()) {
    await demo.click();
    await page.waitForTimeout(2_500);
    await page.screenshot({ path: path.join(out, "demo.png"), fullPage: true });
  }

  const privateIsles = page.getByRole("button", { name: "Đảo riêng", exact: true });
  if (await privateIsles.count()) {
    await privateIsles.first().click();
    await page.waitForTimeout(1_700);
    await page.screenshot({ path: path.join(out, "islands.png"), fullPage: true });
    const stockIsle = page.getByRole("button", { name: /Đảo Chứng Khoán/ });
    if (await stockIsle.count()) {
      await stockIsle.last().click();
      await page.waitForTimeout(1_500);
    }
  }

  const yacht = page.getByRole("button", { name: "Du thuyền", exact: true });
  if (await yacht.count()) {
    await yacht.click();
    await page.waitForTimeout(1_500);
    await page.keyboard.down("KeyW");
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(1_300);
    await page.keyboard.up("KeyD");
    await page.keyboard.up("KeyW");
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(out, "yacht.png"), fullPage: true });
  }
  const yachtFrameRate = await sampleFps();

  const exitHelm = page.getByRole("button", { name: "RỜI BUỒNG LÁI", exact: true });
  if (await exitHelm.count()) await exitHelm.click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, "mobile.png"), fullPage: true });

  const result = {
    url: page.url(),
    title: await page.title(),
    canvasCount: await page.locator("canvas").count(),
    navigation,
    heroFrameRate,
    yachtFrameRate,
    renderQuality: await page.locator("canvas").getAttribute("data-quality"),
    consoleErrors,
    pageErrors,
    failedResponses,
    horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    visibleButtons: (await page.getByRole("button").allInnerTexts()).map((text) => text.trim()).filter(Boolean).slice(0, 60),
  };
  fs.writeFileSync(path.join(out, "audit.json"), JSON.stringify(result, null, 2), "utf8");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  await browser.close();

  const failures = [];
  if (result.canvasCount !== 1) failures.push(`expected one WebGL canvas, got ${result.canvasCount}`);
  if (result.consoleErrors.length) failures.push(`${result.consoleErrors.length} console error(s)`);
  if (result.pageErrors.length) failures.push(`${result.pageErrors.length} page error(s)`);
  if (result.failedResponses.length) failures.push(`${result.failedResponses.length} failed response(s)`);
  if (result.horizontalOverflow) failures.push("horizontal viewport overflow");
  if (failures.length) throw new Error(`UI audit failed: ${failures.join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
