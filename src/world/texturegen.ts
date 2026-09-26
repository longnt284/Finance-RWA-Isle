/* ------------------------------------------------------------------ */
/*  Bộ sinh dữ liệu vân bề mặt — thuần số học, không đụng tới three hay  */
/*  DOM, để chạy được trong Web Worker.                                  */
/*                                                                      */
/*  Toàn bộ bộ vân (bảy loại vật liệu cộng mặt nước) là khoảng 25 triệu  */
/*  lượt gọi nhiễu. Chạy trên luồng chính, đó là 1,3 giây đứng hình đúng  */
/*  lúc người chơi vừa bấm "Vào đảo" — lâu hơn trên máy yếu. Trong worker  */
/*  thì luồng chính không mất một khung nào.                             */
/* ------------------------------------------------------------------ */

/** Kiểu vật liệu quyết định cách trộn nhiễu thành trường độ cao. */
export type SurfaceKind = "stone" | "plaster" | "wood" | "metal" | "sand" | "fabric" | "foliage";

/** Một việc sinh vân: một loại vật liệu, hoặc bản đồ pháp tuyến mặt nước. */
export type TextureKey = SurfaceKind | "water";

export interface TextureData {
  key: TextureKey;
  size: number;
  /** RGBA8 — bản đồ pháp tuyến. */
  normal: Uint8Array;
  /** RGBA8 — bản đồ độ nhám. Mặt nước không có. */
  rough: Uint8Array | null;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
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
  /* Lớp micro chung: hạt li ti ở tần số gấp 3 lần, biên độ nhỏ — thứ khiến
     ánh sáng xiên tạo ra "hạt" thay vì mảng phẳng khi dí camera lại gần. */
  const micro = (seed: number) => fbm(u * 18, v * 18, period * 18, 2, seed) * 0.09;
  switch (kind) {
    case "stone": {
      /* Mảng loang lớn cộng hạt sạn — mặt đá mài chứ không phải đá tảng thô. */
      const blotch = fbm(u, v, period, 5, 11);
      const grain = fbm(u * 4, v * 4, period * 4, 4, 29);
      /* Vài đường nứt mảnh: lấy rãnh của nhiễu (gần 0.5 thì tối đi). */
      const crack = 1 - Math.min(1, Math.abs(fbm(u * 1.6, v * 1.6, period * 2, 4, 61) - 0.5) * 9);
      const pores = fbm(u * 11, v * 11, period * 11, 2, 101) * 0.08;
      return blotch * 0.58 + grain * 0.24 - crack * crack * 0.20 + pores + micro(103) + 0.14;
    }
    case "plaster": {
      /* Vữa trát: hạt rất mịn, gợn đều, không có hướng + rỗ khí li ti. */
      const pits = Math.pow(1 - fbm(u * 14, v * 14, period * 14, 2, 113), 3) * 0.12;
      return fbm(u * 3, v * 3, period * 3, 5, 7) * 0.66 + fbm(u * 9, v * 9, period * 9, 3, 43) * 0.28 - pits + micro(107);
    }
    case "wood": {
      /* Vân gỗ là những vòng gần song song, bị nhiễu bẻ cong nhẹ. */
      const warp = fbm(u * 0.9, v * 0.35, period, 4, 17) * 2.4;
      const rings = Math.sin((v * 5.5 + warp) * Math.PI * 2) * 0.5 + 0.5;
      const fibre = fbm(u * 1.2, v * 14, period * 14, 3, 53);
      const pore = fbm(u * 8, v * 30, period * 30, 2, 127) * 0.10;
      return rings * 0.48 + fibre * 0.30 + fbm(u * 2, v * 2, period * 2, 4, 71) * 0.16 + pore * 0.4 + micro(109);
    }
    case "metal": {
      /* Kim loại xước theo một hướng + xước chéo mịn thứ hai cho ánh brushed thật. */
      const brush = fbm(u * 0.5, v * 26, period * 26, 3, 23);
      const cross = fbm(u * 22, v * 0.7, period * 22, 2, 137) * 0.18;
      const patch = fbm(u, v, period, 4, 89);
      return brush * 0.58 + patch * 0.30 + cross + micro(131);
    }
    case "sand": {
      /* Sóng cát nhỏ chồng lên hạt li ti + gợn gió thứ hai lệch hướng. */
      const dune = Math.sin((u * 2.6 + fbm(u, v, period, 4, 5) * 3.1) * Math.PI * 2) * 0.5 + 0.5;
      const dune2 = Math.sin((v * 3.4 + fbm(v, u, period, 3, 149) * 2.2) * Math.PI * 2) * 0.5 + 0.5;
      const speck = fbm(u * 12, v * 12, period * 12, 3, 97);
      return dune * 0.30 + dune2 * 0.12 + speck * 0.42 + fbm(u * 3, v * 3, period * 3, 4, 13) * 0.16 + micro(151);
    }
    case "fabric": {
      /* Sợi dọc và sợi ngang đan nhau + độ lệch sợi ngẫu nhiên. */
      const warpThread = Math.sin(u * period * Math.PI * 2) * 0.5 + 0.5;
      const weftThread = Math.sin(v * period * Math.PI * 2) * 0.5 + 0.5;
      return Math.max(warpThread, weftThread) * 0.52 + fbm(u * 6, v * 6, period * 6, 3, 37) * 0.42 + micro(139);
    }
    case "foliage": {
      /* Gân lá toả ra cộng lấm tấm mặt lá + đốm khô viền lá. */
      const veins = 1 - Math.min(1, Math.abs(Math.sin(v * 9.5 * Math.PI) ) * 2.2);
      const mottle = fbm(u * 5, v * 5, period * 5, 4, 67);
      const speckle = fbm(u * 16, v * 16, period * 16, 2, 157) * 0.10;
      return mottle * 0.68 + veins * 0.26 + speckle + micro(163);
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
    const v = clamp(1 + (height[i] - 0.5) * spread * 2, 0, 1);
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

/** Thông số riêng của từng loại: kích thước tấm, độ nổi, biên độ nhám.
 *  Bản photoreal: tấm 512 cho mọi mặt hero, thêm tầng nhiễu micro để
 *  ánh sáng có hạt ở cả tầm gần lẫn tầm xa. */
export const PROFILE: Record<SurfaceKind, { size: number; period: number; bump: number; rough: number }> = {
  stone: { size: 512, period: 9, bump: 3.1, rough: 0.34 },
  plaster: { size: 512, period: 9, bump: 1.35, rough: 0.21 },
  wood: { size: 512, period: 7, bump: 2.3, rough: 0.30 },
  metal: { size: 512, period: 9, bump: 0.9, rough: 0.38 },
  sand: { size: 512, period: 11, bump: 1.9, rough: 0.19 },
  fabric: { size: 256, period: 18, bump: 1.7, rough: 0.24 },
  foliage: { size: 256, period: 9, bump: 1.5, rough: 0.26 },
};

/** Mặt nước: 512px, lặp liền mạch để cuộn ba lớp không lộ mối nối. */
export const WATER_SIZE = 512;

/** Cỡ tấm của một việc — texture giữ chỗ phải đúng cỡ này ngay từ đầu. */
export function sizeOf(key: TextureKey): number {
  return key === "water" ? WATER_SIZE : PROFILE[key].size;
}

function generateSurface(kind: SurfaceKind): TextureData {
  const { size, period, bump, rough } = PROFILE[kind];
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * period;
      const v = (y / size) * period;
      height[y * size + x] = clamp(heightFor(kind, u, v, period), 0, 1);
    }
  }
  return {
    key: kind,
    size,
    normal: heightToNormal(height, size, bump),
    rough: heightToRoughness(height, size, rough),
  };
}

/**
 * Bản đồ pháp tuyến cho mặt nước: nhiễu nhiều tầng, lặp liền mạch, dùng để
 * cuộn hai lớp ngược chiều nhau trong shader đại dương. Đây là thứ tạo ra
 * dải nắng vỡ vụn trên sóng — dấu hiệu dễ nhận nhất của nước thật.
 */
function generateWater(): TextureData {
  /* 3 tầng: gợn lừng, sóng chop, lăn tăn micro cho dải nắng vỡ vụn mịn thay
     vì đốm to. */
  const size = WATER_SIZE;
  const period = 8;
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * period;
      const v = (y / size) * period;
      const swell = fbm(u * 0.8, v * 0.8, period, 4, 3);
      const chop = fbm(u * 3.1, v * 3.1, period * 3, 4, 19);
      const microW = fbm(u * 9.4, v * 9.4, period * 9, 2, 211);
      height[y * size + x] = clamp(swell * 0.58 + chop * 0.30 + microW * 0.12, 0, 1);
    }
  }
  return { key: "water", size, normal: heightToNormal(height, size, 3.0), rough: null };
}

export function generateTexture(key: TextureKey): TextureData {
  return key === "water" ? generateWater() : generateSurface(key);
}
