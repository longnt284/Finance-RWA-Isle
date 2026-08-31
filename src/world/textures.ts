import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Vân bề mặt sinh tại chỗ — thứ tách "đồ hoạ hoạt hình" khỏi "đồ hoạ   */
/*  thật". Không tải file, không thêm request: mọi tấm map dưới đây đều  */
/*  vẽ bằng canvas ngay khi trang mở, mỗi loại đúng một lần.            */
/*                                                                      */
/*  Vì sao đây là đòn bẩy lớn nhất: một khối `MeshStandardMaterial` chỉ  */
/*  có `color` thì mọi điểm trên mặt phản xạ y hệt nhau, nên mắt đọc ra  */
/*  ngay là "nhựa tô màu". Chỉ cần độ nhám thay đổi vài phần trăm theo   */
/*  vị trí, cộng thêm pháp tuyến gợn nhẹ, thì cùng hình khối ấy đã ra    */
/*  đá, gỗ hay kim loại.                                                */
/* ------------------------------------------------------------------ */

/** Kiểu vật liệu quyết định cách trộn nhiễu thành trường độ cao. */
export type SurfaceKind = "stone" | "plaster" | "wood" | "metal" | "sand" | "fabric" | "foliage";

export interface SurfaceMaps {
  /** Pháp tuyến gợn — làm ánh sáng "bám" vào mặt phẳng. */
  normalMap: THREE.Texture;
  /** Độ nhám loang lổ — vệt bóng, vệt mờ, chỗ mòn chỗ mới. */
  roughnessMap: THREE.Texture;
}

/* ----------------------------- nhiễu ----------------------------- */

/**
 * Băm số nguyên có chu kỳ. Chu kỳ là thứ khiến tấm vân lặp liền mạch: lưới
 * ở cạnh phải trùng khớp lưới ở cạnh trái nên không bao giờ thấy đường nối.
 */
function hash2(xi: number, yi: number, period: number, seed: number): number {
  const x = ((xi % period) + period) % period;
  const y = ((yi % period) + period) % period;
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, period: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, period, seed);
  const b = hash2(x0 + 1, y0, period, seed);
  const c = hash2(x0, y0 + 1, period, seed);
  const d = hash2(x0 + 1, y0 + 1, period, seed);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}

/** Nhiễu nhiều tầng: tầng thô cho mảng lớn, tầng mịn cho hạt li ti. */
function fbm(x: number, y: number, period: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * freq, y * freq, period * freq, seed + o * 131) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/* ------------------------- trường độ cao ------------------------- */

/**
 * Mỗi loại vật liệu là một công thức trộn khác nhau trên cùng bộ nhiễu.
 * Trả về độ cao trong khoảng 0..1 tại toạ độ lưới (u, v) đã nhân sẵn tần số.
 */
function heightFor(kind: SurfaceKind, u: number, v: number, period: number): number {
  switch (kind) {
    case "stone": {
      /* Mảng loang lớn cộng hạt sạn — mặt đá mài chứ không phải đá tảng thô. */
      const blotch = fbm(u, v, period, 4, 11);
      const grain = fbm(u * 4, v * 4, period * 4, 3, 29);
      /* Vài đường nứt mảnh: lấy rãnh của nhiễu (gần 0.5 thì tối đi). */
      const crack = 1 - Math.min(1, Math.abs(fbm(u * 1.6, v * 1.6, period * 2, 3, 61) - 0.5) * 9);
      return blotch * 0.62 + grain * 0.26 - crack * crack * 0.22 + 0.16;
    }
    case "plaster": {
      /* Vữa trát: hạt rất mịn, gợn đều, không có hướng. */
      return fbm(u * 3, v * 3, period * 3, 4, 7) * 0.7 + fbm(u * 9, v * 9, period * 9, 2, 43) * 0.3;
    }
    case "wood": {
      /* Vân gỗ là những vòng gần song song, bị nhiễu bẻ cong nhẹ. */
      const warp = fbm(u * 0.9, v * 0.35, period, 3, 17) * 2.4;
      const rings = Math.sin((v * 5.5 + warp) * Math.PI * 2) * 0.5 + 0.5;
      const fibre = fbm(u * 1.2, v * 14, period * 14, 2, 53);
      return rings * 0.5 + fibre * 0.32 + fbm(u * 2, v * 2, period * 2, 3, 71) * 0.18;
    }
    case "metal": {
      /* Kim loại xước theo một hướng — đó là dấu hiệu "đã gia công". */
      const brush = fbm(u * 0.5, v * 26, period * 26, 2, 23);
      const patch = fbm(u, v, period, 3, 89);
      return brush * 0.66 + patch * 0.34;
    }
    case "sand": {
      /* Sóng cát nhỏ chồng lên hạt li ti. */
      const dune = Math.sin((u * 2.6 + fbm(u, v, period, 3, 5) * 3.1) * Math.PI * 2) * 0.5 + 0.5;
      const speck = fbm(u * 12, v * 12, period * 12, 2, 97);
      return dune * 0.34 + speck * 0.46 + fbm(u * 3, v * 3, period * 3, 3, 13) * 0.2;
    }
    case "fabric": {
      /* Sợi dọc và sợi ngang đan nhau. */
      const warpThread = Math.sin(u * period * Math.PI * 2) * 0.5 + 0.5;
      const weftThread = Math.sin(v * period * Math.PI * 2) * 0.5 + 0.5;
      return Math.max(warpThread, weftThread) * 0.55 + fbm(u * 6, v * 6, period * 6, 2, 37) * 0.45;
    }
    case "foliage": {
      /* Gân lá toả ra cộng lấm tấm mặt lá. */
      const veins = 1 - Math.min(1, Math.abs(Math.sin(v * 9.5 * Math.PI) ) * 2.2);
      const mottle = fbm(u * 5, v * 5, period * 5, 3, 67);
      return mottle * 0.72 + veins * 0.28;
    }
  }
}

/* --------------------------- dựng texture --------------------------- */

/** Chuyển trường độ cao thành bản đồ pháp tuyến bằng sai phân Sobel. */
function heightToNormal(height: Float32Array, size: number, strength: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx =
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy =
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -dx * strength;
      let ny = -dy * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      const i = (y * size + x) * 4;
      data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((nz / len * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  return data;
}

/**
 * Độ nhám lấy từ chính trường độ cao nhưng nén quanh 1.0: `roughnessMap`
 * được **nhân** với `material.roughness`, nên trung bình phải xấp xỉ 1 thì
 * độ nhám gốc của vật liệu mới giữ nguyên ý đồ.
 */
function heightToRoughness(height: Float32Array, size: number, spread: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < height.length; i++) {
    const v = THREE.MathUtils.clamp(1 + (height[i] - 0.5) * spread * 2, 0, 1);
    const byte = Math.round(v * 255);
    const o = i * 4;
    /* three đọc kênh G cho độ nhám và kênh B cho độ kim loại. */
    data[o] = byte;
    data[o + 1] = byte;
    data[o + 2] = byte;
    data[o + 3] = 255;
  }
  return data;
}

function dataTexture(data: Uint8Array, size: number, srgb: boolean): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, size, size);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** Thông số riêng của từng loại: kích thước tấm, độ nổi, biên độ nhám. */
const PROFILE: Record<SurfaceKind, { size: number; period: number; bump: number; rough: number }> = {
  stone: { size: 256, period: 8, bump: 3.4, rough: 0.26 },
  plaster: { size: 256, period: 8, bump: 1.6, rough: 0.16 },
  wood: { size: 256, period: 6, bump: 2.6, rough: 0.22 },
  metal: { size: 256, period: 8, bump: 1.1, rough: 0.30 },
  sand: { size: 256, period: 10, bump: 2.2, rough: 0.14 },
  fabric: { size: 128, period: 16, bump: 2.0, rough: 0.18 },
  foliage: { size: 128, period: 8, bump: 1.8, rough: 0.20 },
};

const CACHE = new Map<SurfaceKind, SurfaceMaps>();

/** Sinh (hoặc lấy lại từ bộ nhớ đệm) bộ map gốc của một loại vật liệu. */
function baseMaps(kind: SurfaceKind): SurfaceMaps {
  const cached = CACHE.get(kind);
  if (cached) return cached;
  const { size, period, bump, rough } = PROFILE[kind];
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * period;
      const v = (y / size) * period;
      height[y * size + x] = THREE.MathUtils.clamp(heightFor(kind, u, v, period), 0, 1);
    }
  }
  const maps: SurfaceMaps = {
    normalMap: dataTexture(heightToNormal(height, size, bump), size, false),
    roughnessMap: dataTexture(heightToRoughness(height, size, rough), size, false),
  };
  CACHE.set(kind, maps);
  return maps;
}

/**
 * Bộ map đã đặt sẵn số lần lặp. Bản sao chép dùng chung ảnh gốc trong GPU
 * nên thêm một tỉ lệ lặp mới gần như không tốn bộ nhớ.
 */
export function surface(kind: SurfaceKind, repeat = 1): SurfaceMaps {
  const base = baseMaps(kind);
  if (repeat === 1) return base;
  const normalMap = base.normalMap.clone();
  const roughnessMap = base.roughnessMap.clone();
  for (const texture of [normalMap, roughnessMap]) {
    texture.repeat.set(repeat, repeat);
    texture.needsUpdate = true;
  }
  return { normalMap, roughnessMap };
}

/**
 * Bản đồ pháp tuyến cho mặt nước: nhiễu nhiều tầng, lặp liền mạch, dùng để
 * cuộn hai lớp ngược chiều nhau trong shader đại dương. Đây là thứ tạo ra
 * dải nắng vỡ vụn trên sóng — dấu hiệu dễ nhận nhất của nước thật.
 */
let waterNormal: THREE.DataTexture | null = null;
export function waterNormalMap(): THREE.DataTexture {
  if (waterNormal) return waterNormal;
  const size = 256;
  const period = 8;
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * period;
      const v = (y / size) * period;
      /* Sóng lăn tăn: tầng thô định hình gợn, tầng mịn tạo lấp lánh. */
      const swell = fbm(u * 0.8, v * 0.8, period, 3, 3);
      const chop = fbm(u * 3.1, v * 3.1, period * 3, 3, 19);
      height[y * size + x] = THREE.MathUtils.clamp(swell * 0.66 + chop * 0.34, 0, 1);
    }
  }
  waterNormal = dataTexture(heightToNormal(height, size, 2.8), size, false);
  return waterNormal;
}
