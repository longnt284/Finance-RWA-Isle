/**
 * Danh mục Chợ Trang Trí: 100 hạng mục, id không trùng, giá hợp lý, và — quan
 * trọng nhất — mọi `kind` đều được `world/props.ts` dựng thành hình.
 *
 * Bài kiểm tra cuối là thứ đáng giá nhất ở đây: thêm một hạng mục với `kind`
 * mới mà quên viết bộ dựng thì trong game nó vẫn mua được, vẫn "đặt lên đảo"
 * được, chỉ là không có gì hiện ra — một lỗi im lặng gần như không thể thấy khi
 * duyệt code.
 *
 *   node tests/shop_catalog.cjs
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

function loadShop() {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "shop.ts"), "utf8");
  const { code } = esbuild.transformSync(source, { loader: "ts", format: "cjs", target: "node18" });
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "shop-")), "shop.cjs");
  fs.writeFileSync(file, code, "utf8");
  return require(file);
}

const shop = loadShop();
const { SHOP_ITEMS, SHOP_CATS, SHOP_BY_ID, FREE_ITEMS } = shop;
const propsSource = fs.readFileSync(path.join(__dirname, "..", "src", "world", "props.ts"), "utf8");

test("danh mục có đúng 100 hạng mục, id không trùng", () => {
  assert.equal(SHOP_ITEMS.length, 100, `phải đủ 100 món, đang có ${SHOP_ITEMS.length}`);
  const ids = new Set();
  for (const item of SHOP_ITEMS) {
    assert.ok(!ids.has(item.id), `id trùng: ${item.id}`);
    ids.add(item.id);
  }
  assert.equal(SHOP_BY_ID.size, 100, "bản đồ tra cứu phải phủ hết danh mục");
});

test("mỗi hạng mục có tên song ngữ, nhóm hợp lệ và giá không âm", () => {
  for (const item of SHOP_ITEMS) {
    assert.ok(item.vi && item.en, `${item.id} thiếu tên song ngữ`);
    assert.notEqual(item.vi, item.en, `${item.id} quên dịch một trong hai ngôn ngữ`);
    assert.ok(SHOP_CATS.includes(item.cat), `${item.id} thuộc nhóm lạ: ${item.cat}`);
    assert.ok(Number.isInteger(item.price) && item.price >= 0, `${item.id} có giá bất thường: ${item.price}`);
    assert.ok(Number.isInteger(item.color) && item.color >= 0 && item.color <= 0xffffff, `${item.id} có màu sai định dạng`);
  }
});

test("mỗi nhóm đều có hàng, và nhóm nào cũng có món dưới 300 xu", () => {
  for (const cat of SHOP_CATS) {
    const list = SHOP_ITEMS.filter((item) => item.cat === cat);
    assert.ok(list.length >= 6, `nhóm ${cat} chỉ có ${list.length} món, quá mỏng để lọc`);
    assert.ok(
      list.some((item) => item.price <= 300),
      `nhóm ${cat} không có món nào dưới 300 xu — người chơi mới sẽ không với tới nhóm này`
    );
  }
});

test("chỉ hạng mục sắc nền được miễn phí, và nó phải có bảng màu", () => {
  assert.ok(FREE_ITEMS.length >= 1, "phải có ít nhất một nền miễn phí để đảo không bao giờ trống bảng màu");
  for (const id of FREE_ITEMS) {
    assert.equal(SHOP_BY_ID.get(id).cat, "ground", `${id} miễn phí nhưng không phải sắc nền`);
  }
  for (const item of SHOP_ITEMS.filter((row) => row.cat === "ground")) {
    assert.ok(item.palette, `${item.id} là sắc nền nhưng thiếu bảng màu`);
    for (const key of ["top", "rim", "rock", "glow"]) {
      assert.ok(Number.isInteger(item.palette[key]), `${item.id} thiếu màu ${key}`);
    }
  }
});

test("chỉ sắc nền dùng kind `ground`; mọi món khác đều có hình khối riêng", () => {
  for (const item of SHOP_ITEMS) {
    if (item.cat === "ground") assert.equal(item.kind, "ground", `${item.id} là sắc nền thì kind phải là ground`);
    else assert.notEqual(item.kind, "ground", `${item.id} không phải sắc nền mà lại dùng kind ground`);
  }
});

test("mọi kind trong danh mục đều được props.ts dựng thành hình", () => {
  const handled = new Set([...propsSource.matchAll(/case\s+"([a-zA-Z]+)":/g)].map((match) => match[1]));
  assert.ok(handled.size > 20, `chỉ đọc được ${handled.size} nhánh case — biểu thức tìm kiếm có lẽ đã lỗi thời`);
  const missing = [...new Set(SHOP_ITEMS.map((item) => item.kind))].filter((kind) => kind !== "ground" && !handled.has(kind));
  assert.deepEqual(missing, [], `những kind sau mua được nhưng không hiện ra gì: ${missing.join(", ")}`);
});

test("số bản sao và tỷ lệ nằm trong khoảng dựng được", () => {
  for (const item of SHOP_ITEMS) {
    if (item.count !== undefined) {
      assert.ok(Number.isInteger(item.count) && item.count >= 1 && item.count <= 10, `${item.id} có count ${item.count} bất thường`);
    }
    if (item.scale !== undefined) {
      assert.ok(item.scale > 0.2 && item.scale <= 2, `${item.id} có scale ${item.scale} bất thường`);
    }
  }
});

test("giá tăng dần theo độ công phu: hiệu ứng và tượng đài đắt hơn cây cỏ", () => {
  const mean = (cat) => {
    const list = SHOP_ITEMS.filter((item) => item.cat === cat && item.price > 0);
    return list.reduce((sum, item) => sum + item.price, 0) / list.length;
  };
  assert.ok(mean("statue") > mean("plant"), "tượng đài phải đắt hơn cây cối trung bình");
  assert.ok(mean("build") > mean("plant"), "công trình phải đắt hơn cây cối trung bình");
});

if (failures.length) {
  console.error(`\n✗ Chợ Trang Trí: ${failures.length} bài kiểm tra hỏng`);
  process.exit(1);
}
console.log(`\n✓ Danh mục ${SHOP_ITEMS.length} hạng mục nhất quán và đều dựng được hình`);
