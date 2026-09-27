import * as THREE from "three";
import { generateTexture, sizeOf } from "./texturegen";
import type { SurfaceKind, TextureData, TextureKey } from "./texturegen";

export type { SurfaceKind } from "./texturegen";

/* ------------------------------------------------------------------ */
/*  Vân bề mặt sinh tại chỗ — thứ tách "đồ hoạ hoạt hình" khỏi "đồ hoạ   */
/*  thật". Không tải file, không thêm request.                          */
/*                                                                      */
/*  Vì sao đây là đòn bẩy lớn nhất: một khối `MeshStandardMaterial` chỉ  */
/*  có `color` thì mọi điểm trên mặt phản xạ y hệt nhau, nên mắt đọc ra  */
/*  ngay là "nhựa tô màu". Chỉ cần độ nhám thay đổi vài phần trăm theo   */
/*  vị trí, cộng thêm pháp tuyến gợn nhẹ, thì cùng hình khối ấy đã ra    */
/*  đá, gỗ hay kim loại.                                                */
/*                                                                      */
/*  Phần số học nằm trong `texturegen.ts` và chạy trong Web Worker. Tệp  */
/*  này trả texture về NGAY, mang dữ liệu trung tính (pháp tuyến thẳng,  */
/*  độ nhám nhân 1), rồi lấp vân thật vào khi worker gửi về. Texture giữ  */
/*  chỗ đúng cỡ tấm thật và đã gắn sẵn vào vật liệu, nên lúc vân tới chỉ  */
/*  là một lượt tải lên GPU — không dựng lại vật liệu, không biên dịch   */
/*  lại shader nào.                                                     */
/* ------------------------------------------------------------------ */

export interface SurfaceMaps {
  /** Pháp tuyến gợn — làm ánh sáng "bám" vào mặt phẳng. */
  normalMap: THREE.Texture;
  /** Độ nhám loang lổ — vệt bóng, vệt mờ, chỗ mòn chỗ mới. */
  roughnessMap: THREE.Texture;
}

/* --------------------------- dựng texture --------------------------- */

function dataTexture(data: Uint8Array, size: number): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, size, size);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  /* Anisotropy 16 giữ vân sắc ở góc nhìn lướt (bãi cát, sân đá) thay vì
     nhòe thành mảng phẳng. three tự kẹp về mức GPU hỗ trợ. */
  texture.anisotropy = 16;
  /* Sống ở tầng module, qua được nhiều lần mount cảnh: vòng dọn dẹp của
     WorldScene phải bỏ qua. */
  texture.userData.shared = true;
  texture.needsUpdate = true;
  return texture;
}

/** Tấm trung tính: pháp tuyến thẳng đứng, độ nhám nhân 1 — vật liệu y như chưa có vân. */
function neutral(size: number, rgb: [number, number, number]): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
  return data;
}

const FLAT_NORMAL: [number, number, number] = [128, 128, 255];
const FULL_ROUGH: [number, number, number] = [255, 255, 255];

interface Slot {
  normal: THREE.DataTexture;
  rough: THREE.DataTexture | null;
  /** Bản sao theo số lần lặp. Chúng dùng chung ảnh gốc với `normal`/`rough`,
      nhưng mỗi bản giữ số phiên bản riêng nên phải được báo "cần tải lại"
      từng cái một. Cache theo `repeat` để mount lại cảnh không đẻ thêm bản sao. */
  copies: Map<number, SurfaceMaps>;
}

const SLOTS = new Map<TextureKey, Slot>();
/** Dữ liệu đã sinh xong nhưng chưa có texture nào đòi — thường là do làm ấm sẵn. */
const READY = new Map<TextureKey, TextureData>();
/** Đã gửi đi sinh (hoặc đã có): không gửi lại lần hai. */
const REQUESTED = new Set<TextureKey>();
/** Đã nhận dữ liệu thật. */
const DONE = new Set<TextureKey>();

/**
 * Thứ tự sinh: thứ phủ nhiều điểm ảnh nhất lên trước. Mặt nước chiếm nửa khung
 * hình, cát và đá là cả hòn đảo; vải và lá chỉ là chi tiết.
 */
const PRIORITY: TextureKey[] = ["water", "sand", "stone", "plaster", "wood", "metal", "foliage", "fabric"];

function slotFor(key: TextureKey): Slot {
  let slot = SLOTS.get(key);
  if (slot) return slot;
  const size = sizeOf(key);
  const ready = READY.get(key);
  READY.delete(key);
  slot = {
    normal: dataTexture(ready?.normal ?? neutral(size, FLAT_NORMAL), size),
    rough: key === "water" ? null : dataTexture(ready?.rough ?? neutral(size, FULL_ROUGH), size),
    copies: new Map(),
  };
  SLOTS.set(key, slot);
  if (!ready) requestTextures([key]);
  return slot;
}

/** Vân thật vừa tới: thay ảnh gốc (dùng chung cho mọi bản sao) rồi báo tải lại. */
function accept(result: TextureData) {
  DONE.add(result.key);
  /* Đủ bộ rồi thì trả luồng lại cho trình duyệt: worker không còn việc gì nữa. */
  if (DONE.size === PRIORITY.length && worker) {
    worker.terminate();
    worker = null;
  }
  const slot = SLOTS.get(result.key);
  if (!slot) {
    READY.set(result.key, result);
    return;
  }
  const { size } = result;
  slot.normal.image = { data: result.normal, width: size, height: size };
  slot.normal.needsUpdate = true;
  if (slot.rough && result.rough) {
    slot.rough.image = { data: result.rough, width: size, height: size };
    slot.rough.needsUpdate = true;
  }
  for (const copy of slot.copies.values()) {
    copy.normalMap.needsUpdate = true;
    copy.roughnessMap.needsUpdate = true;
  }
}

/* ------------------------------ worker ------------------------------ */

let worker: Worker | null = null;
let workerBroken = false;

/**
 * Đường lui khi không có worker (CSP chặn, trình duyệt cũ, worker lỗi giữa
 * chừng): sinh trên luồng chính, mỗi tấm một nhịp riêng để không đứng hình
 * liền một mạch.
 */
function generateInline(keys: TextureKey[]) {
  const queue = keys.filter((key) => !DONE.has(key));
  const step = () => {
    const key = queue.shift();
    if (!key) return;
    if (!DONE.has(key)) accept(generateTexture(key));
    setTimeout(step, 0);
  };
  setTimeout(step, 0);
}

function spawnWorker(): Worker | null {
  if (worker || workerBroken) return worker;
  try {
    worker = new Worker(new URL("./textures.worker.ts", import.meta.url), { type: "module" });
  } catch {
    workerBroken = true;
    return null;
  }
  worker.onmessage = (event: MessageEvent<TextureData>) => accept(event.data);
  worker.onerror = () => {
    worker?.terminate();
    worker = null;
    workerBroken = true;
    generateInline([...REQUESTED]);
  };
  return worker;
}

function requestTextures(keys: TextureKey[]) {
  const fresh = PRIORITY.filter((key) => keys.includes(key) && !REQUESTED.has(key));
  if (!fresh.length) return;
  for (const key of fresh) REQUESTED.add(key);
  const target = typeof Worker === "undefined" ? null : spawnWorker();
  if (target) target.postMessage(fresh);
  else generateInline(fresh);
}

/**
 * Bắt đầu sinh toàn bộ vân ngay, trước khi cảnh cần tới. Gọi lúc trang bìa
 * đang rảnh: tới khi người chơi bấm "Vào đảo" thì vân đã nằm sẵn trong bộ nhớ,
 * cảnh hiện ra đủ chất liệu ngay khung đầu tiên.
 */
export function warmSurfaces(): void {
  requestTextures(PRIORITY);
}

/**
 * Bộ map đã đặt sẵn số lần lặp. Bản sao chép dùng chung ảnh gốc trong GPU
 * nên thêm một tỉ lệ lặp mới gần như không tốn bộ nhớ.
 */
export function surface(kind: SurfaceKind, repeat = 1): SurfaceMaps {
  const slot = slotFor(kind);
  const baseRough = slot.rough as THREE.DataTexture;
  if (repeat === 1) return { normalMap: slot.normal, roughnessMap: baseRough };
  const cached = slot.copies.get(repeat);
  if (cached) return cached;
  const maps: SurfaceMaps = { normalMap: slot.normal.clone(), roughnessMap: baseRough.clone() };
  for (const texture of [maps.normalMap, maps.roughnessMap]) {
    texture.repeat.set(repeat, repeat);
    texture.needsUpdate = true;
  }
  slot.copies.set(repeat, maps);
  return maps;
}

/**
 * Bản đồ pháp tuyến cho mặt nước: nhiễu nhiều tầng, lặp liền mạch, dùng để
 * cuộn hai lớp ngược chiều nhau trong shader đại dương. Đây là thứ tạo ra
 * dải nắng vỡ vụn trên sóng — dấu hiệu dễ nhận nhất của nước thật.
 */
export function waterNormalMap(): THREE.DataTexture {
  return slotFor("water").normal;
}

/* ------------------------------------------------------------------ */
/*  Sprite sinh tại chỗ cho tầng mây billboard                          */
/* ------------------------------------------------------------------ */

function canvasTexture(size: number, paint: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) paint(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  /* Cùng quy ước với vật liệu dùng chung trong `build.ts`: tấm này được cache
     ở tầng module và sống lâu hơn một lần dựng cảnh, nên vòng dọn dẹp của
     WorldScene phải bỏ qua nó. Dispose nhầm thì lần mount sau cache vẫn trả về
     đúng đối tượng ấy nhưng texture trên GPU đã chết — mây ra một mảng trắng. */
  texture.userData.shared = true;
  return texture;
}

let puffTex: THREE.CanvasTexture | null = null;
/** Đốm mây xốp: nhiều blob gaussian chồng nhau + viền mềm — thay cho sphere
 *  đặc, cho tầng mây nhẹ, trong, có chiều sâu khi xếp nhiều lớp. */
export function cloudPuffTexture(): THREE.CanvasTexture {
  if (puffTex) return puffTex;
  puffTex = canvasTexture(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const blobs: [number, number, number, number][] = [
      [0.5, 0.55, 0.30, 0.85], [0.36, 0.58, 0.22, 0.7], [0.64, 0.57, 0.24, 0.72],
      [0.46, 0.46, 0.20, 0.6], [0.58, 0.48, 0.18, 0.55], [0.30, 0.50, 0.14, 0.5],
    ];
    for (const [cx, cy, r, a] of blobs) {
      const g = ctx.createRadialGradient(cx * s, cy * s, 1, cx * s, cy * s, r * s);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(0.6, `rgba(255,255,255,${(a * 0.45).toFixed(3)})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
  });
  return puffTex;
}
