/* Kiểm luật của bốn cơ chế mới, không cần trình duyệt.
 *
 * Biên dịch thẳng `src/lib/*.ts` tại chỗ nên nó kiểm đúng bộ luật ứng dụng
 * dùng, chứ không kiểm một bản chép lại.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.log(`  ✗ ${name}\n      ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function compile(files) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "isle-mech-"));
  execFileSync(
    path.join(ROOT, "node_modules", ".bin", "tsc"),
    [
      ...files.map((file) => path.join(ROOT, "src", "lib", `${file}.ts`)),
      "--outDir", out,
      "--target", "ES2020",
      "--module", "CommonJS",
      "--moduleResolution", "node",
    ],
    { stdio: "pipe" }
  );
  return Object.fromEntries(files.map((file) => [file, require(path.join(out, `${file}.js`))]));
}

const { expedition: E, barometer: B, fishing: F, chain: C } = compile(["expedition", "barometer", "fishing", "chain"]);

/* ------------------------------------------------------------------ */
console.log("\nBến cảng viễn dương\n");

check("mọi tuyến đều mở theo đúng hạng du thuyền, từ 1 tới 5", () => {
  const tiers = E.EXPEDITION_ROUTES.map((route) => route.tier);
  assert(tiers.join(",") === "1,2,3,4,5", `hạng mở tuyến: ${tiers.join(",")}`);
  for (const route of E.EXPEDITION_ROUTES) {
    assert(E.routeUnlocked(route, route.tier), `hạng ${route.tier} phải mở được tuyến ${route.id}`);
    assert(!E.routeUnlocked(route, route.tier - 1), `hạng ${route.tier - 1} không được mở tuyến ${route.id}`);
  }
});

check("tuyến dài trả nhiều hơn nhưng không tuyến nào bỏ xa tuyến khác", () => {
  const rates = E.EXPEDITION_ROUTES.map((route) => ((route.coinMin + route.coinMax) / 2 / route.minutes) * 60);
  for (let i = 1; i < rates.length; i++) {
    assert(rates[i] > rates[i - 1], `tuyến ${E.EXPEDITION_ROUTES[i].id} không trả cao hơn tuyến trước`);
    assert(
      rates[i] / rates[i - 1] < 1.9,
      `tuyến ${E.EXPEDITION_ROUTES[i].id} trả gấp ${(rates[i] / rates[i - 1]).toFixed(2)} lần tuyến trước — quá dốc`
    );
  }
  assert(E.EXPEDITION_ROUTES[0].minutes <= 30, "tuyến ngắn nhất phải vừa một buổi chơi");
});

check("kết quả tất định: tải lại trang không quay lại được phần thưởng", () => {
  const pool = ["p1", "p2", "p3", "p4", "p5"];
  for (const route of E.EXPEDITION_ROUTES) {
    const trip = { routeId: route.id, startedAt: 1_700_000_000_000 };
    const a = E.expeditionOutcome(trip, pool);
    const b = E.expeditionOutcome(trip, pool);
    assert(a.coins === b.coins && a.relic === b.relic, `tuyến ${route.id} ra hai kết quả khác nhau`);
  }
});

check("xu luôn nằm trong khoảng đã công bố của tuyến", () => {
  const pool = ["p1"];
  for (const route of E.EXPEDITION_ROUTES) {
    for (let i = 0; i < 400; i++) {
      const { coins } = E.expeditionOutcome({ routeId: route.id, startedAt: 1_700_000_000_000 + i * 60_000 }, pool);
      assert(
        coins >= route.coinMin && coins <= route.coinMax,
        `tuyến ${route.id} trả ${coins}, ngoài khoảng ${route.coinMin}–${route.coinMax}`
      );
    }
  }
});

check("tỷ lệ ra hàng lạ bám sát con số đã khai trong tuyến", () => {
  const pool = ["p1", "p2", "p3"];
  for (const route of E.EXPEDITION_ROUTES) {
    let hits = 0;
    const runs = 4000;
    for (let i = 0; i < runs; i++) {
      if (E.expeditionOutcome({ routeId: route.id, startedAt: 1_600_000_000_000 + i * 37_000 }, pool).relic) hits++;
    }
    const rate = hits / runs;
    assert(
      Math.abs(rate - route.relicChance) < 0.035,
      `tuyến ${route.id}: khai ${route.relicChance}, đo được ${rate.toFixed(3)}`
    );
  }
});

check("hết hàng trong Chợ thì chuyến vẫn về, chỉ là không có quà", () => {
  const { coins, relic } = E.expeditionOutcome({ routeId: "grand", startedAt: 1_700_000_000_000 }, []);
  assert(coins > 0, "không có quà thì cũng không được mất luôn xu");
  assert(relic === null, "danh sách rỗng mà vẫn trả ra một món");
});

check("đồng hồ đếm ngược khớp với thời lượng tuyến", () => {
  const start = 1_700_000_000_000;
  for (const route of E.EXPEDITION_ROUTES) {
    const trip = { routeId: route.id, startedAt: start };
    const total = route.minutes * 60_000;
    assert(E.expeditionEndsAt(trip) === start + total, `tuyến ${route.id} sai giờ cập bến`);
    assert(E.expeditionRemaining(trip, start) === total, `tuyến ${route.id} sai lúc vừa khởi hành`);
    assert(E.expeditionRemaining(trip, start + total) === 0, `tuyến ${route.id} chưa về đúng hạn`);
    assert(E.expeditionRemaining(trip, start + total * 2) === 0, "đóng tab lâu hơn không được ra số âm");
    assert(Math.abs(E.expeditionProgress(trip, start + total / 2) - 0.5) < 1e-9, `tuyến ${route.id} sai tiến độ`);
  }
});

/* ------------------------------------------------------------------ */
console.log("\nPhong vũ biểu thị trường\n");

check("rổ rỗng hoặc toàn số hỏng thì phong vũ biểu đứng giữa", () => {
  assert(B.readBarometer([]).band === "calm", "rổ rỗng phải ra 'calm'");
  const broken = B.readBarometer([NaN, Infinity, -Infinity]);
  assert(broken.sampled === 0, `lọt ${broken.sampled} số hỏng vào phép tính`);
  assert(broken.band === "calm", "số hỏng phải bị bỏ, không được kéo phong vũ biểu");
});

check("một mã nhảy vọt không điều khiển được cả bầu trời", () => {
  const flat = Array.from({ length: 9 }, () => 0.2);
  const calm = B.readBarometer(flat);
  const withMoonshot = B.readBarometer([...flat, 300]);
  assert(calm.band === "calm", `rổ phẳng ra ${calm.band}`);
  assert(
    withMoonshot.band === "calm",
    `một mã +300% đã đẩy phong vũ biểu sang ${withMoonshot.band} — trung vị đang không làm việc của nó`
  );
});

check("các dải chuyển đúng theo chiều tăng giảm của thị trường", () => {
  const bandOf = (pct) => B.readBarometer([pct]).band;
  assert(bandOf(-6) === "storm", `−6% ra ${bandOf(-6)}`);
  assert(bandOf(-1.2) === "gloom", `−1,2% ra ${bandOf(-1.2)}`);
  assert(bandOf(0.1) === "calm", `+0,1% ra ${bandOf(0.1)}`);
  assert(bandOf(1.2) === "fair", `+1,2% ra ${bandOf(1.2)}`);
  assert(bandOf(6) === "radiant", `+6% ra ${bandOf(6)}`);
});

check("điểm luôn nằm trong [−1, 1] dù thị trường điên tới đâu", () => {
  for (const pct of [-99, -50, -9, 0, 9, 50, 900]) {
    const { score } = B.readBarometer([pct]);
    assert(score >= -1 && score <= 1, `${pct}% ra điểm ${score}`);
  }
});

check("bảng cân thời tiết chỉ nhân, không thay — ngày đỏ mùa xuân không ra tuyết", () => {
  for (const band of ["storm", "gloom", "calm", "fair", "radiant"]) {
    const bias = B.weatherBias(band);
    for (const [id, factor] of Object.entries(bias)) {
      assert(factor > 0, `${band} đặt hệ số ${factor} cho ${id} — hệ số 0 là thay, không phải nhân`);
      assert(factor <= 4, `${band} nhân ${id} lên ${factor} lần, đủ để nuốt cả bảng cân theo mùa`);
    }
  }
  assert(Object.keys(B.weatherBias("calm")).length === 0, "thị trường đứng yên thì không được can thiệp gì");
  assert((B.weatherBias("storm").storm ?? 1) > 1, "thị trường đỏ phải làm giông dễ xảy ra hơn");
  assert((B.weatherBias("radiant").clear ?? 1) > 1, "thị trường xanh phải làm trời quang dễ xảy ra hơn");
});

check("may mắn câu cá nghịch chiều thị trường, còn xu viễn dương thuận chiều", () => {
  assert(B.luckBias("storm") > B.luckBias("calm"), "biển động phải dễ gặp cá hiếm hơn");
  assert(B.luckBias("radiant") < B.luckBias("calm"), "ngày xanh không được vừa lãi vừa dễ câu");
  assert(B.voyageBias("storm") < B.voyageBias("radiant"), "biển động phải làm hàng về ít hơn");
  for (const band of ["storm", "gloom", "calm", "fair", "radiant"]) {
    assert(B.luckBias(band) > 0.5 && B.luckBias(band) < 2, `luck ${band} = ${B.luckBias(band)} quá tay`);
    assert(B.voyageBias(band) > 0.5 && B.voyageBias(band) < 2, `xu ${band} = ${B.voyageBias(band)} quá tay`);
  }
});

/* ------------------------------------------------------------------ */
console.log("\nMồi câu và giải trong ngày\n");

check("mồi đắt hơn thì mỗi lượt thả cần cũng đắt hơn, và may mắn cũng cao hơn", () => {
  let previousRate = 0;
  let previousLuck = 0;
  for (const bait of F.BAITS) {
    const rate = bait.price / bait.casts;
    assert(rate > previousRate, `mồi ${bait.id} rẻ hơn mồi trước tính theo lượt`);
    assert(bait.luck > previousLuck, `mồi ${bait.id} không may hơn mồi trước`);
    assert(bait.luck < 0.8, `mồi ${bait.id} cho luck ${bait.luck} — gần bằng xoáy nước thì ra khơi làm gì`);
    previousRate = rate;
    previousLuck = bait.luck;
  }
});

check("hộp mồi hết lượt thì hết tác dụng, không âm thầm chạy tiếp", () => {
  assert(F.baitLuck(null) === 0, "câu chay phải là luck 0");
  assert(F.baitLuck({ id: "chum", left: 0 }) === 0, "hộp cạn vẫn còn tác dụng");
  assert(F.baitLuck({ id: "chum", left: 1 }) > 0, "hộp còn một lượt phải còn tác dụng");
});

check("mồi kéo cá hiếm lên thật, đo trên mười nghìn lần thả cần", () => {
  const rareShare = (luck) => {
    let rare = 0;
    const runs = 10000;
    for (let i = 0; i < runs; i++) {
      const fish = F.rollFish("shore", "summer", false, luck);
      if (F.RARITY_ORDER.indexOf(fish.rarity) >= 2) rare++;
    }
    return rare / runs;
  };
  const chay = rareShare(0.12);
  const moi = rareShare(0.12 + 0.55);
  assert(moi > chay * 1.4, `câu chay ${chay.toFixed(3)}, mồi tanh ${moi.toFixed(3)} — mồi gần như không đổi gì`);
});

check("bậc giải tăng dần và phần thưởng cũng vậy", () => {
  let previousKg = 0;
  let previousCoins = 0;
  for (const tier of F.TOURNAMENT_TIERS) {
    assert(tier.kg > previousKg, "ngưỡng cân nặng không tăng dần");
    assert(tier.coins > previousCoins, "phần thưởng không tăng dần");
    previousKg = tier.kg;
    previousCoins = tier.coins;
  }
  assert(F.tournamentTier(0) === 0, "chưa bắt được con nào mà đã có bậc");
  assert(F.tournamentReward(0) === 0, "chưa bắt được con nào mà đã có thưởng");
  assert(F.tournamentTier(1000) === F.TOURNAMENT_TIERS.length, "cá khổng lồ không đạt bậc cao nhất");
});

check("mọi bậc giải đều với tới được bằng cá có thật trong danh mục", () => {
  const heaviest = Math.max(...F.FISH.map((fish) => fish.weight[1]));
  const top = F.TOURNAMENT_TIERS[F.TOURNAMENT_TIERS.length - 1].kg;
  assert(heaviest >= top, `bậc cao nhất cần ${top}kg nhưng loài nặng nhất chỉ tới ${heaviest}kg`);
});

/* ------------------------------------------------------------------ */
console.log("\nChuỗi nhiệm vụ tuần\n");

check("khoá tuần theo ISO: đổi vào thứ Hai, không đổi giữa tuần", () => {
  /* 2026-01-05 là thứ Hai. Cả tuần phải ra cùng một khoá, và ngày kế tiếp phải
     ra khoá khác. */
  const monday = new Date(2026, 0, 5, 9).getTime();
  const sunday = new Date(2026, 0, 11, 23).getTime();
  const nextMonday = new Date(2026, 0, 12, 0, 1).getTime();
  assert(C.weekKey(monday) === C.weekKey(sunday), `thứ Hai ${C.weekKey(monday)} khác Chủ nhật ${C.weekKey(sunday)}`);
  assert(C.weekKey(nextMonday) !== C.weekKey(sunday), "sang thứ Hai mà khoá tuần không đổi");
  const before = new Date(2026, 0, 4, 23, 59).getTime();
  assert(C.weekKey(before) !== C.weekKey(monday), "Chủ nhật trước đó phải thuộc tuần khác");
});

check("khoá tuần không nhảy lung tung quanh giao thừa", () => {
  for (const year of [2024, 2025, 2026, 2027, 2028]) {
    for (const [month, day] of [[0, 1], [0, 4], [11, 28], [11, 31]]) {
      const key = C.weekKey(new Date(year, month, day, 12).getTime());
      assert(/^\d{4}-W\d{2}$/.test(key), `khoá lạ: ${key}`);
      const week = Number(key.slice(6));
      assert(week >= 1 && week <= 53, `${year}-${month + 1}-${day} ra tuần ${week}`);
    }
  }
});

check("mỗi tuần ra đúng một chuỗi, và cùng một tuần luôn ra cùng chuỗi", () => {
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const key = C.weekKey(new Date(2026, 0, 5).getTime() + i * 7 * 86400000);
    const a = C.chainForWeek(key);
    assert(a === C.chainForWeek(key), `tuần ${key} ra hai chuỗi khác nhau`);
    assert(C.CHAIN_BY_ID.has(a), `tuần ${key} trỏ tới chuỗi không tồn tại: ${a}`);
    seen.add(a);
  }
  assert(seen.size === C.CHAIN_DEFS.length, `60 tuần chỉ chạm ${seen.size}/${C.CHAIN_DEFS.length} chuỗi`);
});

check("mọi chuỗi đều đúng bốn chặng và không chặng nào đo trùng chỉ số", () => {
  for (const chain of C.CHAIN_DEFS) {
    assert(chain.steps.length === C.CHAIN_LENGTH, `chuỗi ${chain.id} có ${chain.steps.length} chặng`);
    const metrics = chain.steps.map((step) => step.metric);
    assert(new Set(metrics).size === metrics.length, `chuỗi ${chain.id} lặp chỉ số: ${metrics.join(",")}`);
    assert(chain.coins > 0 && chain.relicCap > 0, `chuỗi ${chain.id} không có phần thưởng`);
    for (const step of chain.steps) assert(step.target > 0, `chuỗi ${chain.id} có chặng mục tiêu ${step.target}`);
  }
});

check("chỉ chặng đang làm mới nhận tiến độ", () => {
  const chain = C.CHAIN_BY_ID.get("c_tide");
  let weekly = C.emptyWeekly("2026-W02");
  weekly = { ...weekly, chainId: "c_tide" };
  /* Chỉ số của chặng 2 không được đẩy chặng 1 đi. */
  const untouched = C.bumpChain(weekly, chain.steps[1].metric, 99);
  assert(untouched.step === 0 && untouched.progress === 0, "chỉ số của chặng sau đã kéo được chặng trước");
  /* Làm đủ chặng 1 thì sang chặng 2, và tiến độ về 0. */
  const advanced = C.bumpChain(weekly, chain.steps[0].metric, chain.steps[0].target);
  assert(advanced.step === 1 && advanced.progress === 0, `sau chặng 1: bước ${advanced.step}, tiến độ ${advanced.progress}`);
});

check("làm đủ bốn chặng thì chuỗi xong, và không tràn qua chặng thứ năm", () => {
  const chain = C.CHAIN_BY_ID.get("c_ledger");
  let weekly = { ...C.emptyWeekly("2026-W03"), chainId: "c_ledger" };
  for (const step of chain.steps) {
    assert(!C.chainComplete(weekly), "chuỗi xong quá sớm");
    weekly = C.bumpChain(weekly, step.metric, step.target);
  }
  assert(C.chainComplete(weekly), "làm đủ bốn chặng mà chuỗi chưa xong");
  assert(C.chainStep(weekly) === null, "chuỗi xong rồi vẫn còn chặng để làm");
  const after = C.bumpChain(weekly, chain.steps[0].metric, 50);
  assert(after.step === chain.steps.length, `chuỗi tràn sang bước ${after.step}`);
});

console.log("");
if (failures.length) {
  console.log(`✗ ${failures.length} kiểm tra cơ chế thất bại\n`);
  process.exit(1);
}
console.log(`✓ Bốn cơ chế mới nhất quán qua ${passed} kiểm tra\n`);
