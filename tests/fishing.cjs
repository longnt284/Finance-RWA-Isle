/**
 * Luật chơi câu cá: điều kiện xuất hiện của từng loài, giá bán theo cân nặng,
 * độ khó của minigame và bậc cần câu.
 *
 * Chạy hoàn toàn offline bằng cách biên dịch `src/lib/fishing.ts` tại chỗ, nên
 * đây là bài kiểm tra chính xác cùng bộ luật mà ứng dụng dùng — không phải một
 * bản chép tay dễ lệch. Nó tồn tại vì minigame chạy ở 60fps trong trình duyệt:
 * bắt lỗi cân bằng ở tầng dữ liệu rẻ hơn nhiều so với ngồi câu thử.
 *
 *   node tests/fishing.cjs
 */
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const esbuild = require("esbuild");

const failures = [];
function test(name, fn) {
  try {
    fn();
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (error) {
    process.stdout.write(`  ✗ ${name} — ${error.message}\n`);
    failures.push(name);
  }
}

/** Biên dịch fishing.ts sang CJS rồi nạp, để dùng đúng bộ luật của ứng dụng. */
function loadFishing() {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "fishing.ts"), "utf8");
  const { code } = esbuild.transformSync(source, { loader: "ts", format: "cjs", target: "node18" });
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fishing-")), "fishing.cjs");
  fs.writeFileSync(file, code, "utf8");
  return require(file);
}

const fishing = loadFishing();
const { FISH, FISH_BY_ID, RARITY_META, RARITY_ORDER } = fishing;

/** Quay xổ số nhiều lần rồi trả về tập id đã gặp. */
function sample(zone, season, night, luck, rounds = 4000) {
  const seen = new Map();
  for (let i = 0; i < rounds; i++) {
    const fish = fishing.rollFish(zone, season, night, luck);
    seen.set(fish.id, (seen.get(fish.id) ?? 0) + 1);
  }
  return seen;
}

test("mỗi loài có id riêng và giá trị hợp lệ", () => {
  const ids = new Set();
  for (const fish of FISH) {
    assert.ok(!ids.has(fish.id), `id trùng: ${fish.id}`);
    ids.add(fish.id);
    assert.ok(fish.vi && fish.en, `${fish.id} thiếu tên song ngữ`);
    assert.ok(RARITY_ORDER.includes(fish.rarity), `${fish.id} có độ hiếm lạ`);
    assert.ok(fish.value > 0, `${fish.id} phải có giá dương`);
    assert.ok(fish.difficulty > 0 && fish.difficulty < 1, `${fish.id} độ khó phải nằm trong (0,1)`);
    assert.ok(fish.weight[0] < fish.weight[1], `${fish.id} khoảng cân nặng phải tăng dần`);
  }
});

test("bến câu không bao giờ ra loài chỉ sống ở xoáy nước", () => {
  const seen = sample("shore", "summer", false, 0.12);
  for (const id of seen.keys()) {
    assert.notEqual(FISH_BY_ID.get(id).zone, "vortex", `${id} chỉ sống ở xoáy nước mà lại cắn câu ở bến`);
  }
});

test("loài ban đêm không cắn câu giữa ban ngày", () => {
  const seen = sample("vortex", "summer", false, 0.8);
  for (const id of seen.keys()) {
    assert.notEqual(FISH_BY_ID.get(id).time, "night", `${id} là loài ban đêm mà xuất hiện lúc ban ngày`);
  }
  /* và ngược lại: loài ban ngày không ra vào ban đêm */
  const atNight = sample("vortex", "summer", true, 0.8);
  for (const id of atNight.keys()) {
    assert.notEqual(FISH_BY_ID.get(id).time, "day", `${id} là loài ban ngày mà xuất hiện lúc đêm`);
  }
});

test("loài theo mùa chỉ xuất hiện đúng mùa của nó", () => {
  const seasonal = FISH.filter((fish) => fish.seasons);
  assert.ok(seasonal.length > 0, "phải có ít nhất một loài theo mùa để bài kiểm tra có nghĩa");
  for (const fish of seasonal) {
    const wrong = fish.seasons.includes("summer") ? "winter" : "summer";
    const seen = sample(fish.zone === "vortex" ? "vortex" : "shore", wrong, false, 0.5);
    assert.ok(!seen.has(fish.id), `${fish.id} chỉ có ở ${fish.seasons.join("/")} mà lại ra vào mùa ${wrong}`);
  }
});

test("xoáy nước ra cá hiếm nhiều hơn hẳn bến câu", () => {
  const rare = (seen) => {
    let total = 0;
    let hits = 0;
    for (const [id, count] of seen) {
      total += count;
      if (RARITY_ORDER.indexOf(FISH_BY_ID.get(id).rarity) >= 2) hits += count;
    }
    return hits / total;
  };
  const shore = rare(sample("shore", "summer", true, 0.12, 8000));
  const vortex = rare(sample("vortex", "summer", true, 0.8, 8000));
  assert.ok(vortex > shore * 2, `xoáy nước phải hiếm hơn rõ rệt — bến ${shore.toFixed(3)} vs xoáy ${vortex.toFixed(3)}`);
});

test("cá huyền thoại hiếm thật, kể cả ở xoáy nước", () => {
  const seen = sample("vortex", "summer", true, 0.8, 8000);
  let legend = 0;
  let total = 0;
  for (const [id, count] of seen) {
    total += count;
    if (FISH_BY_ID.get(id).rarity === "legend") legend += count;
  }
  const ratio = legend / total;
  assert.ok(ratio > 0.001, `phải bắt được huyền thoại ở đâu đó — tỷ lệ ${ratio}`);
  assert.ok(ratio < 0.25, `huyền thoại mà chiếm ${(ratio * 100).toFixed(1)}% thì không còn là huyền thoại`);
});

test("cân nặng luôn nằm trong khoảng của loài", () => {
  for (const fish of FISH) {
    for (let i = 0; i < 200; i++) {
      const weight = fishing.rollWeight(fish);
      assert.ok(weight >= fish.weight[0] - 1e-9 && weight <= fish.weight[1] + 1e-9, `${fish.id} ra ${weight} kg ngoài khoảng`);
    }
  }
});

test("giá bán tăng theo cân nặng và luôn dương", () => {
  for (const fish of FISH) {
    const light = fishing.fishValue(fish, fish.weight[0]);
    const heavy = fishing.fishValue(fish, fish.weight[1]);
    assert.ok(light >= 1, `${fish.id} con nhỏ nhất vẫn phải bán được ít nhất 1 xu`);
    assert.ok(heavy > light, `${fish.id} con to phải đắt hơn con nhỏ`);
  }
});

test("loài càng hiếm càng khó giữ trong khung", () => {
  const byRarity = new Map();
  for (const fish of FISH) {
    const list = byRarity.get(fish.rarity) ?? [];
    list.push(fishing.fishingConfig(fish, 3));
    byRarity.set(fish.rarity, list);
  }
  const mean = (list, key) => list.reduce((sum, config) => sum + config[key], 0) / list.length;
  const common = byRarity.get("common");
  const legend = byRarity.get("legend");
  assert.ok(mean(legend, "barHeight") < mean(common, "barHeight"), "khung giữ cá huyền thoại phải hẹp hơn");
  assert.ok(mean(legend, "drainRate") > mean(common, "drainRate"), "cá huyền thoại phải làm tiến trình tụt nhanh hơn");
  assert.ok(mean(legend, "fishSpeed") > mean(common, "fishSpeed"), "cá huyền thoại phải bơi nhanh hơn");
});

test("khung giữ cá không bao giờ âm hay nuốt trọn cần câu", () => {
  for (const fish of FISH) {
    for (let rod = 1; rod <= 5; rod++) {
      const config = fishing.fishingConfig(fish, rod);
      assert.ok(config.barHeight > 0.03, `${fish.id} cấp ${rod}: khung ${config.barHeight} quá nhỏ, không chơi được`);
      assert.ok(config.barHeight < 0.6, `${fish.id} cấp ${rod}: khung ${config.barHeight} rộng tới mức không cần chơi`);
      assert.ok(config.fillRate > 0, `${fish.id} cấp ${rod}: tiến trình không bao giờ nạp được`);
    }
  }
});

test("cần câu lên cấp thì khung rộng ra và nạp nhanh hơn", () => {
  const fish = FISH_BY_ID.get("seabass");
  const low = fishing.fishingConfig(fish, 1);
  const high = fishing.fishingConfig(fish, 5);
  assert.ok(high.barHeight > low.barHeight, "cần cấp cao phải cho khung rộng hơn");
  assert.ok(high.fillRate > low.fillRate, "cần cấp cao phải nạp tiến trình nhanh hơn");
});

test("bậc cần câu bám đúng mốc số cá đã bắt", () => {
  assert.equal(fishing.rodLevel(0), 1);
  assert.equal(fishing.rodLevel(14), 1);
  assert.equal(fishing.rodLevel(15), 2);
  assert.equal(fishing.rodLevel(240), 5);
  assert.equal(fishing.rodLevel(10000), 5, "cấp 5 là trần");
  const mid = fishing.rodProgress(20);
  assert.equal(mid.level, 2);
  assert.equal(mid.have, 5);
  assert.equal(mid.need, 30);
});

test("mục tiêu tiếp theo của cá luôn nằm trong khung 0..1", () => {
  for (const motion of ["calm", "smooth", "dart", "sink", "mixed"]) {
    for (let i = 0; i < 500; i++) {
      const next = fishing.nextFishTarget(motion, Math.random());
      assert.ok(next >= 0 && next <= 1, `${motion} nhảy ra ngoài khung: ${next}`);
    }
  }
});

test("thời gian chờ cắn câu nằm trong khoảng chịu đựng được", () => {
  for (let i = 0; i < 500; i++) {
    const delay = fishing.biteDelay();
    assert.ok(delay >= 1 && delay <= 4.2, `chờ ${delay}s là quá dài hoặc quá ngắn`);
  }
});

test("mỗi bậc hiếm đều có ít nhất một loài và phần thưởng XP tăng dần", () => {
  for (const rarity of RARITY_ORDER) {
    assert.ok(FISH.some((fish) => fish.rarity === rarity), `không có loài nào ở bậc ${rarity}`);
  }
  for (let i = 1; i < RARITY_ORDER.length; i++) {
    const previous = RARITY_META[RARITY_ORDER[i - 1]];
    const current = RARITY_META[RARITY_ORDER[i]];
    assert.ok(current.xp > previous.xp, `XP của ${RARITY_ORDER[i]} phải cao hơn ${RARITY_ORDER[i - 1]}`);
    assert.ok(current.weight < previous.weight, `${RARITY_ORDER[i]} phải hiếm hơn ${RARITY_ORDER[i - 1]}`);
  }
});

if (failures.length) {
  console.error(`\n✗ Câu cá: ${failures.length} bài kiểm tra hỏng`);
  process.exit(1);
}
console.log(`\n✓ Luật câu cá nhất quán trên ${FISH.length} loài và 5 bậc cần câu`);
