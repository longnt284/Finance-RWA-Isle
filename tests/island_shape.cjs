/* Kiểm hình học đảo chính, không cần trình duyệt.
 *
 * Bài này tồn tại vì hai lỗi đã lọt qua cả typecheck lẫn mắt người đọc code:
 *
 *  1. Mặt trên của đảo từng là nắp hình quạt của `CylinderGeometry` — chỉ có
 *     đỉnh ở bán kính 0 và ở vành, không có vòng nào ở giữa. Toàn bộ hàm nhiễu
 *     địa hình vì thế không có đỉnh nào để bám vào, còn cây và nhà thì lại đặt
 *     theo `terrainHeightAt`. Hai bên lệch nhau tới 1,16 đơn vị.
 *
 *  2. Lưới mới dựng đúng cao độ nhưng thứ tự đỉnh tam giác bị ngược, nên pháp
 *     tuyến chúc xuống và mặt trên bị cull sạch: cả hòn đảo biến mất, mặt biển
 *     phủ lên đúng chỗ nó vừa đứng.
 *
 * Cả hai đều là lỗi "mã chạy, không báo gì, chỉ có khung hình sai".
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

/* Biên dịch `shape.ts` tại chỗ để kiểm đúng bộ luật ứng dụng dùng, chứ không
   kiểm một bản chép lại. */
function loadShape() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "isle-shape-"));
  execFileSync(
    path.join(ROOT, "node_modules", ".bin", "tsc"),
    [
      path.join(ROOT, "src", "world", "shape.ts"),
      "--outDir", out,
      "--target", "ES2020",
      "--module", "CommonJS",
      "--moduleResolution", "node",
    ],
    { stdio: "pipe" }
  );
  return require(path.join(out, "shape.js"));
}

const S = loadShape();

console.log("\nHình học đảo chính\n");

check("đường bờ uốn thật, không phải đường tròn trá hình", () => {
  assert(S.COAST_MAX / S.COAST_MIN > 1.25, `bờ quá đều: min ${S.COAST_MIN.toFixed(1)}, max ${S.COAST_MAX.toFixed(1)}`);
  assert(S.COAST_MIN > 20, `đáy vịnh ăn quá sâu: ${S.COAST_MIN.toFixed(1)}`);
});

check("vịnh nằm đúng vùng lõm và mũi đá nằm đúng mũi đất", () => {
  const bay = S.coastRadius(S.BAY_ANGLE);
  const cliff = S.coastRadius(S.CLIFF_ANGLE);
  assert(bay < S.ISLAND_RADIUS * 0.86, `vịnh không lõm: ${bay.toFixed(1)} so với ${S.ISLAND_RADIUS}`);
  assert(cliff > S.ISLAND_RADIUS * 1.06, `mũi đá không nhô: ${cliff.toFixed(1)} so với ${S.ISLAND_RADIUS}`);
});

check("mép nước rơi đúng vào mực nước biển", () => {
  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * Math.PI * 2;
    if (S.cliffMask(Math.cos(angle) * S.COAST_MAX * 0.9, Math.sin(angle) * S.COAST_MAX * 0.9) > 0.2) continue;
    const radius = S.coastRadius(angle) * S.SHORELINE_U;
    const y = S.terrainHeightAt(Math.cos(angle) * radius, Math.sin(angle) * radius);
    assert(
      Math.abs(y - S.WATER_LEVEL) < 0.45,
      `ở ${((angle * 180) / Math.PI).toFixed(0)}° mép nước cao ${y.toFixed(2)}, mực nước ${S.WATER_LEVEL}`
    );
  }
});

check("quảng trường và bệ công trình đều phẳng tuyệt đối", () => {
  assert(S.terrainHeightAt(0, 0) === 0, `tâm quảng trường lệch ${S.terrainHeightAt(0, 0)}`);
  for (const [x, z] of S.DISTRICT_ANCHORS) {
    assert(Math.abs(S.terrainHeightAt(x, z)) < 1e-9, `bệ công trình (${x}, ${z}) lệch ${S.terrainHeightAt(x, z)}`);
    assert(S.terrainFlatness(x, z) === 0, `bệ công trình (${x}, ${z}) vẫn cho đất gợn`);
  }
});

check("bốn quận đứng trên cỏ, không đứng dưới nước hay trên cát", () => {
  for (const [x, z] of S.DISTRICT_ANCHORS) {
    const u = S.coastU(x, z);
    assert(u < S.PLATEAU_U - 0.15, `quận (${x.toFixed(1)}, ${z.toFixed(1)}) ở u=${u.toFixed(2)}, quá sát bãi cát`);
    assert(S.sandiness(x, z) === 0, `quận (${x.toFixed(1)}, ${z.toFixed(1)}) đứng trên cát`);
  }
});

check("bãi cát không nuốt quá nửa hòn đảo", () => {
  const beachShare = 1 - S.PLATEAU_U ** 2;
  assert(beachShare < 0.5, `bãi cát chiếm ${(beachShare * 100).toFixed(0)}% diện tích đảo`);
  assert(beachShare > 0.25, `bãi cát chỉ còn ${(beachShare * 100).toFixed(0)}%, mép đảo sẽ thành vách`);
});

check("mũi đá nhô hẳn lên trên mặt nước", () => {
  const radius = S.coastRadius(S.CLIFF_ANGLE) * 0.9;
  const y = S.terrainHeightAt(Math.cos(S.CLIFF_ANGLE) * radius, Math.sin(S.CLIFF_ANGLE) * radius);
  assert(y > S.WATER_LEVEL + 3, `đỉnh mũi đá chỉ cao ${y.toFixed(2)}, mực nước ${S.WATER_LEVEL}`);
  assert(S.sandiness(Math.cos(S.CLIFF_ANGLE) * radius, Math.sin(S.CLIFF_ANGLE) * radius) < 0.1, "mũi đá lại ra bãi cát");
});

check("lưới địa hình quay mặt lên trời", () => {
  /* Dựng đúng cách `buildTerrain` dựng: cùng công thức toạ độ, cùng thứ tự
     đỉnh. Nếu thứ tự đỉnh bị đảo thì pháp tuyến chúc xuống và cả mặt đảo bị
     cull — mã vẫn chạy, không một dòng cảnh báo nào. */
  const SEGMENTS = 64;
  const RINGS = 16;
  const vertex = (ring, seg) => {
    const u = Math.pow(ring / RINGS, 0.82);
    const angle = (seg / SEGMENTS) * Math.PI * 2;
    const radius = u * S.coastRadius(angle);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    return [x, S.terrainHeightAt(x, z), z];
  };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const crossY = (p, q, r) => {
    const u = sub(q, p);
    const v = sub(r, p);
    return u[2] * v[0] - u[0] * v[2];
  };
  let up = 0;
  let down = 0;
  for (let ring = 0; ring < RINGS; ring++) {
    for (let seg = 0; seg < SEGMENTS; seg++) {
      const a = vertex(ring, seg);
      const b = vertex(ring, (seg + 1) % SEGMENTS);
      const c = vertex(ring + 1, seg);
      const d = vertex(ring + 1, (seg + 1) % SEGMENTS);
      /* Đúng thứ tự mà `build.ts` đẩy vào chỉ mục: (a, d, c) và (a, b, d). */
      for (const y of [crossY(a, d, c), crossY(a, b, d)]) {
        if (y > 0) up++;
        else if (y < 0) down++;
      }
    }
  }
  assert(down === 0, `${down}/${up + down} tam giác quay mặt xuống đất`);
});

check("gieo hạt tất định: cùng hạt giống ra cùng bố cục", () => {
  const options = { count: 40, minU: 0.3, maxU: 0.7, seed: 1234, spacing: 2.5, avoidCliff: true };
  const a = S.scatter(options);
  const b = S.scatter(options);
  assert(a.length === b.length, `số điểm lệch nhau: ${a.length} so với ${b.length}`);
  assert(a.length >= options.count * 0.8, `chỉ đặt được ${a.length}/${options.count} điểm`);
  for (let i = 0; i < a.length; i++) {
    assert(a[i].x === b[i].x && a[i].z === b[i].z, `điểm ${i} nhảy chỗ giữa hai lần gieo`);
  }
});

check("mọi vật thể gieo ra đều nằm trên đảo và đúng cao độ mặt đất", () => {
  const spots = S.scatter({ count: 120, minU: 0.3, maxU: 0.94, seed: 99, spacing: 1.8 });
  for (const spot of spots) {
    const u = S.coastU(spot.x, spot.z);
    assert(u <= 0.95, `điểm ở u=${u.toFixed(3)} nằm ngoài mép đảo`);
    assert(
      Math.abs(spot.y - S.terrainHeightAt(spot.x, spot.z)) < 1e-9,
      "cao độ trả về không khớp với mặt đất — vật thể sẽ lơ lửng"
    );
  }
});

check("cỏ không mọc xuống nước, không mọc lên lối đi", () => {
  const spots = S.scatter({ count: 200, minU: 0.2, maxU: S.GRASS_U, seed: 7, spacing: 0.9, minFlatness: 0.55 });
  assert(S.GRASS_U < S.PLATEAU_U, `mốc cỏ ${S.GRASS_U} vượt qua mốc bãi cát ${S.PLATEAU_U}`);
  for (const spot of spots) {
    assert(spot.y > S.WATER_LEVEL, `ngọn cỏ ở cao độ ${spot.y.toFixed(2)}, dưới mực nước`);
    assert(S.terrainFlatness(spot.x, spot.z) >= 0.55, "ngọn cỏ mọc lên lối đi lát đá");
  }
});

check("hàm bờ viết bằng GLSL khớp với hàm bờ viết bằng TypeScript", () => {
  /* Không chạy được shader ở đây, nên đọc thẳng các hằng số trong chuỗi GLSL và
     dựng lại phép tính. Cái cần chặn là ai đó sửa hằng số một bên quên bên kia. */
  const glsl = S.COAST_GLSL;
  const grab = (pattern, label) => {
    const found = glsl.match(pattern);
    assert(found, `không tìm thấy ${label} trong chuỗi GLSL`);
    return Number(found[1]);
  };
  const c3 = grab(/([\d.]+) \* sin\(a \* 3\.0/, "biên độ hài bậc 3");
  const p3 = grab(/sin\(a \* 3\.0 \+ ([\d.]+)\)/, "pha hài bậc 3");
  const c5 = grab(/([\d.]+) \* sin\(a \* 5\.0/, "biên độ hài bậc 5");
  const p5 = grab(/sin\(a \* 5\.0 \+ ([\d.]+)\)/, "pha hài bậc 5");
  const bayAngle = grab(/abs\(a - ([\d.]+)\)/, "hướng vịnh");
  const width = grab(/gap \/ ([\d.]+)/, "bề rộng vịnh");
  const radius = grab(/return ([\d.]+) \*/, "bán kính danh nghĩa");
  const depth = grab(/capes - ([\d.]+) \* bump/, "độ sâu vịnh");
  const rebuilt = (angle) => {
    const capes = c3 * Math.sin(angle * 3 + p3) + c5 * Math.sin(angle * 5 + p5);
    let gap = Math.abs(angle - bayAngle) % (Math.PI * 2);
    gap = Math.min(gap, Math.PI * 2 - gap);
    const t = gap / width;
    const bump = t >= 1 ? 0 : Math.pow(Math.cos(t * 1.5707963), 2);
    return radius * (1 + capes - depth * bump);
  };
  for (let i = 0; i < 90; i++) {
    const angle = (i / 90) * Math.PI * 2;
    const diff = Math.abs(rebuilt(angle) - S.coastRadius(angle));
    assert(diff < 0.02, `lệch ${diff.toFixed(3)} tại ${((angle * 180) / Math.PI).toFixed(0)}°`);
  }
});

console.log("");
if (failures.length) {
  console.log(`✗ ${failures.length} kiểm tra hình học đảo thất bại\n`);
  process.exit(1);
}
console.log(`✓ Hình học đảo chính nhất quán qua ${passed} kiểm tra\n`);
