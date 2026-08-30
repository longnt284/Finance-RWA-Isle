/**
 * Đối chiếu MỌI khoá i18n mà mã nguồn yêu cầu với hai từ điển trong
 * `src/lib/i18n.ts`.
 *
 * Nó tồn tại vì một lỗi thật: sáu thành tựu a15–a20 được thêm vào `ACH_DEFS`
 * nhưng không ai thêm chuỗi dịch, nên bảng Thành tựu hiện thẳng khoá thô
 * ("ach.a15.n", "ach.a15.d") ra màn hình. Cảnh báo DEV cũ chỉ so vi với en nên
 * hoàn toàn im lặng: khoá thiếu ở CẢ HAI từ điển thì hai bên vẫn "khớp nhau".
 *
 * Bài kiểm tra phủ cả khoá tĩnh `t("...")` lẫn khoá dựng động `t(`ach.${id}.n`)`
 * — với khoá động thì miền giá trị được liệt kê tường minh bên dưới.
 *
 *   node tests/i18n_keys.cjs
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

/* ------------------------- đọc hai từ điển ------------------------- */

const i18n = read("src/lib/i18n.ts");
const viStart = i18n.indexOf("const vi: Dict = {");
const enStart = i18n.indexOf("const en: Dict = {");
if (viStart < 0 || enStart < 0) {
  console.error("Không tìm thấy `const vi: Dict` hoặc `const en: Dict` trong src/lib/i18n.ts");
  process.exit(1);
}

function keysOf(body) {
  const keys = new Set();
  const re = /"([a-zA-Z0-9_.\-]+)":\s*"/g;
  let match;
  while ((match = re.exec(body))) keys.add(match[1]);
  return keys;
}

const VI = keysOf(i18n.slice(viStart, enStart));
const EN = keysOf(i18n.slice(enStart));

/* --------------- miền giá trị của các khoá dựng động --------------- */

/** Đọc một mảng hằng dạng `export const NAME = ["a", "b"]` từ mã nguồn. */
function stringArray(rel, name) {
  const body = read(rel);
  const match = new RegExp(`export const ${name}[^=]*=\\s*\\[([^\\]]*)\\]`).exec(body);
  if (!match) throw new Error(`Không đọc được ${name} trong ${rel}`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** Đọc `id` của mọi phần tử trong một mảng object hằng. */
function idsOf(rel, name) {
  const body = read(rel);
  const start = body.indexOf(`export const ${name}`);
  if (start < 0) throw new Error(`Không tìm thấy ${name} trong ${rel}`);
  const end = body.indexOf("\n];", start);
  return [...body.slice(start, end).matchAll(/\{\s*id:\s*"([^"]+)"/g)].map((m) => m[1]);
}

const DISTRICTS = stringArray("src/state/store.tsx", "DISTRICT_IDS");
const ACH_IDS = idsOf("src/state/store.tsx", "ACH_DEFS");
const QUEST_IDS = idsOf("src/state/store.tsx", "QUEST_DEFS");
const DECOR_IDS = stringArray("src/lib/decor.ts", "DECOR_IDS");
const SEASONS = stringArray("src/lib/season.ts", "SEASONS");
const WEATHERS = stringArray("src/lib/season.ts", "WEATHERS");
const PHASES = stringArray("src/lib/season.ts", "DAY_PHASES");
const MAX_YACHT_TIER = Number(/MAX_YACHT_TIER: YachtTier = (\d+)/.exec(read("src/state/store.tsx"))[1]);
const TUTORIAL_STEPS = Number(/const STEPS = (\d+)/.exec(read("src/components/Modals.tsx"))[1]);

const expected = new Set();
const add = (key) => expected.add(key);

for (const id of ACH_IDS) { add(`ach.${id}.n`); add(`ach.${id}.d`); }
for (const d of DISTRICTS) {
  add(`d.${d}.name`); add(`d.${d}.building`); add(`d.${d}.tagline`); add(`ct.isle.${d}`);
  for (let i = 0; i < 3; i++) add(`qa.${d}.${i}`);
}
for (const id of QUEST_IDS) { add(`quest.${id}.n`); add(`quest.${id}.d`); }
for (const id of DECOR_IDS) add(`decor.${id}`);
for (const s of SEASONS) add(`season.${s}`);
for (const w of WEATHERS) add(`weather.${w}`);
for (const p of PHASES) add(`phase.${p}`);
for (let n = 1; n <= MAX_YACHT_TIER; n++) { add(`yacht.tier${n}`); add(`yacht.tier${n}.d`); }
for (let i = 0; i < TUTORIAL_STEPS; i++) { add(`tu.${i}.t`); add(`tu.${i}.b`); }
for (const p of ["p1", "p2", "p3", "p4", "p5"]) { add(`pv.${p}.t`); add(`pv.${p}.b`); }
for (const s of ["all", "bank", "realty", "industrial", "energy", "consumer", "tech", "finance", "health"]) {
  add(`mk.sector.${s}`);
}
for (const tier of [1, 2, 3]) add(`exam.tier${tier}`);
for (const tier of ["easy", "mid", "hard"]) add(`tier.${tier}`);
for (const theme of ["emerald", "sunset", "lagoon", "violet"]) add(`theme.${theme}`);

/* ------------------- khoá tĩnh có trong mã nguồn ------------------- */

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

const literalUses = new Map();
for (const file of walk(SRC)) {
  const body = fs.readFileSync(file, "utf8");
  const re = /\bt\(\s*"([^"]+)"/g;
  let match;
  while ((match = re.exec(body))) {
    add(match[1]);
    if (!literalUses.has(match[1])) literalUses.set(match[1], path.relative(ROOT, file));
  }
}

/* ------------------- khoá nhật ký lưu trong state ------------------ */
/* `renderLog` dịch lại nhật ký lúc vẽ, nên mọi `k:` trong reducer cũng phải
   tồn tại trong từ điển — nếu không, dòng nhật ký sẽ hiện ra khoá thô. */
for (const match of read("src/state/store.tsx").matchAll(/\bk:\s*"([^"]+)"/g)) add(match[1]);
for (const match of read("src/lib/events.ts").matchAll(/k:\s*(?:quote\.ch >= 0 \? )?"([^"]+)"(?:\s*:\s*"([^"]+)")?/g)) {
  add(match[1]);
  if (match[2]) add(match[2]);
}

/* ------------------------------ so sánh ---------------------------- */

const problems = [];
for (const key of [...expected].sort()) {
  const missingVi = !VI.has(key);
  const missingEn = !EN.has(key);
  if (!missingVi && !missingEn) continue;
  const where = literalUses.get(key) ? ` (dùng ở ${literalUses.get(key)})` : "";
  const which = missingVi && missingEn ? "cả vi lẫn en" : missingVi ? "vi" : "en";
  problems.push(`  ${key} — thiếu trong ${which}${where}`);
}

/* Khoá thừa chỉ là cảnh báo: một số chuỗi được giữ lại cố ý cho tài liệu. */
const onlyVi = [...VI].filter((k) => !EN.has(k));
const onlyEn = [...EN].filter((k) => !VI.has(k));
for (const key of onlyVi) problems.push(`  ${key} — có trong vi nhưng thiếu trong en`);
for (const key of onlyEn) problems.push(`  ${key} — có trong en nhưng thiếu trong vi`);

if (problems.length) {
  console.error(`✗ i18n: ${problems.length} khoá có vấn đề\n${problems.join("\n")}`);
  process.exit(1);
}

console.log(
  `✓ i18n: ${expected.size} khoá được yêu cầu đều có đủ trong cả hai từ điển ` +
    `(vi ${VI.size} · en ${EN.size} · ${ACH_IDS.length} thành tựu · ${QUEST_IDS.length} nhiệm vụ)`
);
