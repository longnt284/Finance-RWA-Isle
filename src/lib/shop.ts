/* ------------------------------------------------------------------ */
/*  Chợ Trang Trí — 100 hạng mục đổi bằng xu bán cá                     */
/*                                                                     */
/*  Tách khỏi `world/` để bảng điều khiển không kéo Three.js vào chunk  */
/*  của mình. Tên hạng mục song ngữ ngay trong dữ liệu: 100 món × 2     */
/*  ngôn ngữ mà nhét vào từ điển i18n thì từ điển sẽ dài hơn cả game.   */
/* ------------------------------------------------------------------ */

export type ShopCat = "ground" | "plant" | "light" | "build" | "statue" | "sea" | "fx";

/** Kiểu dựng hình trong thế giới 3D — `world/props.ts` hiện thực từng kiểu. */
export type PropKind =
  | "ground"
  | "palm" | "pine" | "bush" | "flowerbed" | "bamboo" | "cactus" | "blossom" | "vine"
  | "lantern" | "lamppost" | "torch" | "neonarch" | "glowstone" | "firefly" | "beacon"
  | "cottage" | "villa" | "pagoda" | "windmill" | "gazebo" | "tent" | "stall" | "greenhouse" | "tower" | "bridge"
  | "obelisk" | "coinpile" | "statue" | "fountain" | "sundial" | "totem"
  | "buoy" | "sailboat" | "raft" | "pier" | "netrack"
  | "aura" | "petalfall" | "bubbles" | "sparks";

export interface GroundPalette {
  top: number;
  rim: number;
  rock: number;
  glow: number;
}

export interface ShopItem {
  id: string;
  vi: string;
  en: string;
  cat: ShopCat;
  price: number;
  kind: PropKind;
  color: number;
  accent?: number;
  /** Số bản sao rải quanh đảo. */
  count?: number;
  scale?: number;
  /** Chỉ dùng cho hạng mục `ground`: bảng màu thay cho nền đảo. */
  palette?: GroundPalette;
}

const g = (id: string, vi: string, en: string, price: number, palette: GroundPalette): ShopItem => ({
  id, vi, en, cat: "ground", price, kind: "ground", color: palette.top, palette,
});

const p = (
  id: string, vi: string, en: string, cat: ShopCat, price: number, kind: PropKind,
  color: number, extra: Partial<ShopItem> = {}
): ShopItem => ({ id, vi, en, cat, price, kind, color, count: 1, scale: 1, ...extra });

/* ------------------------------------------------------------------ */

export const SHOP_ITEMS: ShopItem[] = [
  /* ---------------- nền đảo & sắc màu (14) ---------------- */
  g("gr_emerald", "Nền Lục Bảo", "Emerald Ground", 0, { top: 0x216b59, rim: 0xb28a54, rock: 0x244c47, glow: 0x5ce8c4 }),
  g("gr_ivory", "Nền Ngà Voi", "Ivory Ground", 140, { top: 0xc9c2a4, rim: 0xe6dcc0, rock: 0x6e6a5a, glow: 0xfff0c9 }),
  g("gr_coral", "Nền San Hô", "Coral Ground", 180, { top: 0xa8574f, rim: 0xf0a17c, rock: 0x53312f, glow: 0xff9a7b }),
  g("gr_azure", "Nền Thiên Thanh", "Azure Ground", 180, { top: 0x2a7fa8, rim: 0xa8dcf0, rock: 0x1d4054, glow: 0x7bdcf5 }),
  g("gr_amethyst", "Nền Thạch Anh Tím", "Amethyst Ground", 220, { top: 0x6b57a0, rim: 0xd6bcff, rock: 0x352f52, glow: 0xb79cff }),
  g("gr_sakura", "Nền Anh Đào", "Sakura Ground", 240, { top: 0xc07a94, rim: 0xffd4e2, rock: 0x59353f, glow: 0xffb7cd }),
  g("gr_obsidian", "Nền Hắc Diệu", "Obsidian Ground", 260, { top: 0x2a2f36, rim: 0x8f98a4, rock: 0x14171b, glow: 0x7fb0ff }),
  g("gr_savanna", "Nền Thảo Nguyên", "Savanna Ground", 200, { top: 0x8f8a3c, rim: 0xd9cf7e, rock: 0x4d4826, glow: 0xf2e28a }),
  g("gr_glacier", "Nền Băng Hà", "Glacier Ground", 280, { top: 0x9fc4d4, rim: 0xeaf6ff, rock: 0x4a6c7a, glow: 0xd7f2ff }),
  g("gr_volcano", "Nền Núi Lửa", "Volcano Ground", 320, { top: 0x5a2b22, rim: 0xff7a3c, rock: 0x2a1512, glow: 0xff8a4c }),
  g("gr_jade", "Nền Ngọc Phỉ Thúy", "Jade Ground", 300, { top: 0x2f9f7a, rim: 0xc7f2df, rock: 0x1a4a3c, glow: 0x8ff5cf }),
  g("gr_midnight", "Nền Nửa Đêm", "Midnight Ground", 340, { top: 0x22304d, rim: 0x9db4e8, rock: 0x121a2c, glow: 0x8fb6ff }),
  g("gr_goldsand", "Nền Cát Vàng", "Golden Sand", 360, { top: 0xc9a34e, rim: 0xffe6a8, rock: 0x6a5227, glow: 0xffd88a }),
  g("gr_aurora", "Nền Cực Quang", "Aurora Ground", 480, { top: 0x2c6f8f, rim: 0xa6ffd8, rock: 0x1b3550, glow: 0x9dfff0 }),

  /* ---------------- cây cối & vườn (22) ---------------- */
  p("pl_palm3", "Ba cây dừa", "Palm Trio", "plant", 60, "palm", 0x3f9c70, { count: 3 }),
  p("pl_palm6", "Rặng dừa", "Palm Grove", "plant", 140, "palm", 0x2e8d63, { count: 6 }),
  p("pl_palmgold", "Dừa lá vàng", "Golden Palms", "plant", 260, "palm", 0xd9b64a, { count: 4 }),
  p("pl_palmviolet", "Dừa lá tím", "Violet Palms", "plant", 300, "palm", 0xa88ce0, { count: 4 }),
  p("pl_pine", "Rừng thông", "Pine Stand", "plant", 120, "pine", 0x2b6b4c, { count: 5 }),
  p("pl_pinesnow", "Thông phủ tuyết", "Snow Pines", "plant", 220, "pine", 0xa9c8c2, { count: 5 }),
  p("pl_bush", "Bụi cây thấp", "Low Shrubs", "plant", 45, "bush", 0x357a55, { count: 7 }),
  p("pl_bushberry", "Bụi mọng đỏ", "Berry Shrubs", "plant", 90, "bush", 0x7a3540, { count: 6, accent: 0xff6f6f }),
  p("pl_flowerred", "Luống hoa đỏ", "Red Flower Bed", "plant", 70, "flowerbed", 0xe2604f, { count: 4 }),
  p("pl_flowerviolet", "Luống hoa tím", "Violet Flower Bed", "plant", 70, "flowerbed", 0xb79cff, { count: 4 }),
  p("pl_flowergold", "Luống hoa vàng", "Golden Flower Bed", "plant", 90, "flowerbed", 0xf0c268, { count: 4 }),
  p("pl_flowerwhite", "Luống hoa trắng", "White Flower Bed", "plant", 70, "flowerbed", 0xe9f3f0, { count: 4 }),
  p("pl_flowerocean", "Luống hoa biển", "Ocean Flower Bed", "plant", 110, "flowerbed", 0x5ce8c4, { count: 5 }),
  p("pl_meadow", "Đồng hoa dại", "Wildflower Meadow", "plant", 240, "flowerbed", 0xff9ac1, { count: 9 }),
  p("pl_bamboo", "Khóm tre", "Bamboo Clump", "plant", 130, "bamboo", 0x5f9e4a, { count: 4 }),
  p("pl_bamboogold", "Tre vàng", "Golden Bamboo", "plant", 280, "bamboo", 0xcbb24a, { count: 4 }),
  p("pl_cactus", "Xương rồng sa mạc", "Desert Cacti", "plant", 100, "cactus", 0x4a8f5c, { count: 5 }),
  p("pl_blossom", "Cây anh đào", "Cherry Blossom", "plant", 320, "blossom", 0xffb7cd, { count: 3 }),
  p("pl_blossomwhite", "Anh đào trắng", "White Blossom", "plant", 320, "blossom", 0xf2f7ff, { count: 3 }),
  p("pl_vine", "Giàn dây leo", "Vine Trellis", "plant", 150, "vine", 0x3f9c70, { count: 3 }),
  p("pl_topiary", "Cây cắt tỉa", "Topiary Set", "plant", 190, "bush", 0x2f7d6a, { count: 8, scale: 1.35 }),
  p("pl_mangrove", "Rừng ngập mặn", "Mangrove Fringe", "plant", 260, "pine", 0x1f5d4a, { count: 8, scale: 0.8 }),

  /* ---------------- đèn & ánh sáng (16) ---------------- */
  p("li_lantern", "Đèn lồng gỗ", "Wooden Lanterns", "light", 55, "lantern", 0xffc069, { count: 4 }),
  p("li_lanternjade", "Đèn lồng ngọc", "Jade Lanterns", "light", 95, "lantern", 0x5ce8c4, { count: 4 }),
  p("li_lanternrose", "Đèn lồng hồng", "Rose Lanterns", "light", 95, "lantern", 0xff9ac1, { count: 4 }),
  p("li_lamppost", "Cột đèn phố", "Street Lamps", "light", 120, "lamppost", 0xffd88a, { count: 5 }),
  p("li_lamppostblue", "Cột đèn lam", "Cobalt Lamps", "light", 140, "lamppost", 0x9fd0ff, { count: 5 }),
  p("li_torchgold", "Đuốc vàng", "Golden Braziers", "light", 130, "torch", 0xffb347, { count: 4 }),
  p("li_torchjade", "Đuốc ngọc bích", "Jade Braziers", "light", 130, "torch", 0x5ce8c4, { count: 4 }),
  p("li_torchviolet", "Đuốc tím", "Violet Braziers", "light", 160, "torch", 0xb79cff, { count: 4 }),
  p("li_neonarch", "Cổng neon", "Neon Arch", "light", 240, "neonarch", 0x5ce8c4),
  p("li_neonarchgold", "Cổng neon vàng", "Gold Neon Arch", "light", 260, "neonarch", 0xffd88a),
  p("li_neonarchrose", "Cổng neon hồng", "Rose Neon Arch", "light", 260, "neonarch", 0xff8fc0),
  p("li_glowstone", "Đá phát sáng", "Glowing Stones", "light", 180, "glowstone", 0x7bdcf5, { count: 7 }),
  p("li_glowstonegold", "Đá sáng vàng", "Amber Glowstones", "light", 180, "glowstone", 0xffd88a, { count: 7 }),
  p("li_firefly", "Đàn đom đóm", "Firefly Swarm", "light", 300, "firefly", 0xc9ff8a),
  p("li_beacon", "Cột sáng dẫn đường", "Guiding Beacon", "light", 420, "beacon", 0x5ce8c4),
  p("li_beacongold", "Cột sáng hoàng kim", "Golden Beacon", "light", 480, "beacon", 0xffd88a),

  /* ---------------- công trình (20) ---------------- */
  p("bd_cottage", "Nhà gỗ ven biển", "Seaside Cottage", "build", 200, "cottage", 0xdde9e4, { accent: 0x1e5f58, count: 2 }),
  p("bd_cottagerow", "Xóm nhà nhỏ", "Cottage Row", "build", 380, "cottage", 0xf0e4cb, { accent: 0xa8574f, count: 4 }),
  p("bd_villa", "Biệt thự trắng", "White Villa", "build", 460, "villa", 0xeef4f0, { accent: 0x2a5f7a }),
  p("bd_villagold", "Biệt thự mái vàng", "Gilded Villa", "build", 620, "villa", 0xf6ead0, { accent: 0xe0aa50 }),
  p("bd_pagoda", "Tháp chùa", "Pagoda", "build", 520, "pagoda", 0xc94f42, { accent: 0xe0aa50 }),
  p("bd_pagodajade", "Chùa ngọc", "Jade Pagoda", "build", 560, "pagoda", 0x2f7d6a, { accent: 0x9ff5da }),
  p("bd_windmill", "Cối xay gió", "Windmill", "build", 480, "windmill", 0xdde9e4, { accent: 0x6e4b33 }),
  p("bd_gazebo", "Vọng lâu", "Garden Gazebo", "build", 300, "gazebo", 0xe6dcc0, { accent: 0x1e5f58 }),
  p("bd_gazebogold", "Vọng lâu vàng", "Golden Gazebo", "build", 420, "gazebo", 0xffe6a8, { accent: 0xe0aa50 }),
  p("bd_tent", "Lều trại", "Camp Tents", "build", 160, "tent", 0xe2604f, { count: 3 }),
  p("bd_tentmarket", "Lều chợ phiên", "Market Tents", "build", 240, "tent", 0x4cb0d9, { count: 4 }),
  p("bd_stall", "Quầy hàng", "Market Stalls", "build", 220, "stall", 0xd9a066, { accent: 0xe2604f, count: 3 }),
  p("bd_stallfish", "Quầy hải sản", "Fish Market", "build", 280, "stall", 0x9fd0ff, { accent: 0x2a5f7a, count: 2 }),
  p("bd_greenhouse", "Nhà kính", "Glasshouse", "build", 540, "greenhouse", 0xbfe8e0, { accent: 0xdde9e4 }),
  p("bd_tower", "Tháp canh", "Watchtower", "build", 400, "tower", 0xa9b9b3, { accent: 0x1e5f58 }),
  p("bd_towergold", "Tháp vàng", "Golden Spire", "build", 700, "tower", 0xffe6a8, { accent: 0xe0aa50 }),
  p("bd_bridge", "Cầu đá", "Stone Bridge", "build", 340, "bridge", 0xa9b9b3),
  p("bd_bridgewood", "Cầu gỗ", "Wooden Bridge", "build", 260, "bridge", 0x8a6a44),
  p("bd_shrine", "Miếu nhỏ", "Little Shrine", "build", 300, "pagoda", 0x8f5a4a, { accent: 0xffd88a, scale: 0.62 }),
  p("bd_manor", "Dinh thự mái vòm", "Domed Manor", "build", 880, "villa", 0xe9f0f4, { accent: 0x1f3f66, scale: 1.35 }),

  /* ---------------- tượng đài (12) ---------------- */
  p("st_obelisk", "Bia đá cổ", "Ancient Obelisk", "statue", 260, "obelisk", 0xa9b9b3, { accent: 0x5ce8c4 }),
  p("st_obeliskgold", "Bia vàng", "Gilded Obelisk", "statue", 380, "obelisk", 0xffe6a8, { accent: 0xffd88a }),
  p("st_coinpile", "Đống tiền vàng", "Coin Hoard", "statue", 320, "coinpile", 0xffd88a, { count: 3 }),
  p("st_coinpilejade", "Đống ngọc", "Jade Hoard", "statue", 320, "coinpile", 0x7fe8bb, { count: 3 }),
  p("st_bull", "Tượng bò vàng", "Golden Bull", "statue", 620, "statue", 0xffd88a, { accent: 0xe0aa50 }),
  p("st_whale", "Tượng cá voi", "Whale Monument", "statue", 680, "statue", 0x9fd0ff, { accent: 0x2a5f7a, scale: 1.2 }),
  p("st_fountain", "Đài phun nước", "Marble Fountain", "statue", 440, "fountain", 0xe6ecea, { accent: 0x7bdcf5 }),
  p("st_fountaingold", "Đài phun vàng", "Golden Fountain", "statue", 560, "fountain", 0xffe6a8, { accent: 0xffd88a }),
  p("st_sundial", "Đồng hồ mặt trời", "Sundial", "statue", 240, "sundial", 0xa9b9b3, { accent: 0xe0aa50 }),
  p("st_totem", "Cột totem", "Island Totem", "statue", 300, "totem", 0xa8574f, { accent: 0x5ce8c4, count: 2 }),
  p("st_totemjade", "Totem ngọc", "Jade Totem", "statue", 340, "totem", 0x2f7d6a, { accent: 0x9ff5da, count: 2 }),
  p("st_anchor", "Neo đá tưởng niệm", "Memorial Anchor", "statue", 280, "sundial", 0x64787a, { accent: 0x9fd0ff, scale: 1.1 }),

  /* ---------------- ven biển (10) ---------------- */
  p("se_buoy", "Phao tiêu", "Channel Buoys", "sea", 90, "buoy", 0xff7f6e, { count: 4 }),
  p("se_buoyjade", "Phao ngọc", "Jade Buoys", "sea", 90, "buoy", 0x5ce8c4, { count: 4 }),
  p("se_sailboat", "Thuyền buồm nhỏ", "Little Sailboat", "sea", 260, "sailboat", 0xdde9e4, { accent: 0xe0aa50 }),
  p("se_sailboatred", "Thuyền buồm đỏ", "Red Sailboat", "sea", 260, "sailboat", 0xf0e4cb, { accent: 0xe2604f }),
  p("se_raft", "Bè tre", "Bamboo Raft", "sea", 140, "raft", 0x8a6a44, { count: 2 }),
  p("se_pier", "Cầu tàu gỗ", "Wooden Pier", "sea", 320, "pier", 0x6e4b33),
  p("se_pierstone", "Cầu tàu đá", "Stone Pier", "sea", 380, "pier", 0xa9b9b3),
  p("se_netrack", "Giàn phơi lưới", "Net Racks", "sea", 150, "netrack", 0x8a6a44, { count: 3 }),
  p("se_lightbuoy", "Phao đèn đêm", "Beacon Buoys", "sea", 220, "buoy", 0xffd88a, { count: 5, accent: 0xffc069 }),
  p("se_harbor", "Bến cá nhỏ", "Fishing Wharf", "sea", 460, "pier", 0x7a5a3a, { accent: 0xffc069, scale: 1.3 }),

  /* ---------------- hiệu ứng (6) ---------------- */
  p("fx_auragold", "Hào quang vàng", "Golden Aura", "fx", 380, "aura", 0xffd88a),
  p("fx_aurajade", "Hào quang ngọc", "Jade Aura", "fx", 380, "aura", 0x5ce8c4),
  p("fx_auraviolet", "Hào quang tím", "Violet Aura", "fx", 380, "aura", 0xb79cff),
  p("fx_petals", "Mưa cánh hoa", "Petal Fall", "fx", 420, "petalfall", 0xffb7cd),
  p("fx_bubbles", "Bong bóng biển", "Sea Bubbles", "fx", 340, "bubbles", 0x9ff0e2),
  p("fx_sparks", "Đom đóm sao", "Star Sparks", "fx", 460, "sparks", 0xffe6a8),
];

export const SHOP_BY_ID = new Map(SHOP_ITEMS.map((item) => [item.id, item]));
export const SHOP_CATS: ShopCat[] = ["ground", "plant", "light", "build", "statue", "sea", "fx"];

export function shopName(item: ShopItem, lang: "vi" | "en"): string {
  return lang === "vi" ? item.vi : item.en;
}

/** Hạng mục miễn phí được sở hữu sẵn để đảo không bao giờ trống bảng màu. */
export const FREE_ITEMS = SHOP_ITEMS.filter((item) => item.price === 0).map((item) => item.id);
