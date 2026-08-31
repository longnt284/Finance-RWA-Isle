/* ------------------------------------------------------------------ */
/*  Hình vẽ cho từng loài cá                                           */
/*                                                                     */
/*  Bộ sưu tập ba mươi lăm loài trước đây chỉ là ba mươi lăm ô chữ:     */
/*  cùng một biểu tượng cá chung cho tất cả, khác nhau mỗi cái tên.     */
/*  Không có lý do gì để người chơi muốn lật xem, cũng không có gì để   */
/*  khoe khi bắt được con hiếm.                                        */
/*                                                                     */
/*  Ở đây mỗi loài có một dáng thân và một bảng ba màu. Vẽ bằng SVG     */
/*  dựng tại chỗ nên không thêm một byte tài nguyên nào phải tải, mà    */
/*  vẫn sắc nét ở mọi kích thước — từ ô 40px trong giỏ cá tới tấm       */
/*  chân dung lúc vừa kéo được cá lên.                                 */
/* ------------------------------------------------------------------ */

/** Dáng thân. Mỗi dáng là một bộ đường SVG dùng chung cho vài loài họ hàng. */
export type FishShape =
  | "slim"      // thân thoi dài: mòi, cơm, đối, thu, nhồng
  | "round"     // thân dẹp cao: rô phi, hồng, chẽm, mú, chép
  | "tuna"      // đuôi liềm, thân lực lưỡng: ngừ, ngừ chấm
  | "bill"      // mũi kiếm và vây lưng buồm: kiếm, cờ xanh
  | "shark"     // vây lưng tam giác, đuôi lệch: mập đầu búa
  | "ray"       // thân dẹt hình đĩa: đuối, bơn
  | "eel"       // thân dải: chình, mái chèo
  | "puffer"    // thân cầu có gai: cá nóc
  | "squid"     // thân ống và xúc tu: mực, bạch tuộc
  | "crab"      // mai và càng
  | "lobster"   // tôm hùm
  | "lantern"   // cá đèn lồng
  | "disc"      // cá mặt trăng
  | "whale"     // cá voi
  | "bottom"    // cá đáy, vây thuỳ: bống, vây tay
  | "weed" | "wood" | "boot" | "chest"; // đồ vớt được

export interface FishArtSpec {
  shape: FishShape;
  /** màu thân chính */
  body: string;
  /** màu bụng, sáng hơn thân */
  belly: string;
  /** màu điểm nhấn: vây, sọc, mắt, ánh kim */
  accent: string;
}

const A = (shape: FishShape, body: string, belly: string, accent: string): FishArtSpec => ({ shape, body, belly, accent });

export const FISH_ART: Record<string, FishArtSpec> = {
  /* ---------- bến câu ---------- */
  sardine: A("slim", "#7f9fb5", "#e9f1f5", "#b8d4e0"),
  anchovy: A("slim", "#6f8fa2", "#eef4f6", "#a9c9d6"),
  mullet: A("slim", "#8a9a86", "#e9ede0", "#bcc9a8"),
  goby: A("bottom", "#9a8258", "#e7dcc2", "#c2a56d"),
  tilapia: A("round", "#78877b", "#dde3d4", "#a8bda0"),
  crab: A("crab", "#c25a3a", "#f0c9a8", "#8f3a22"),
  seabass: A("round", "#8fa3ad", "#eef2f4", "#b7cdd6"),
  snapper: A("round", "#d2543f", "#f7d5c4", "#a63626"),
  grouper: A("round", "#6f5f4a", "#cbb894", "#9c8a63"),
  squid: A("squid", "#e2a3b4", "#fbe3e8", "#b56b80"),
  pufferfish: A("puffer", "#d9b45e", "#f6e6bd", "#8d6b28"),
  flounder: A("ray", "#8a7f6a", "#ded3b8", "#5c5343"),
  eel: A("eel", "#4e6b4a", "#a9c48f", "#2f4430"),
  lobster: A("lobster", "#b8402f", "#f0b79c", "#7a2418"),
  rainbowtrout: A("round", "#7fa4a0", "#f0e7d6", "#e07f9c"),

  /* ---------- xoáy nước ---------- */
  mackerel: A("slim", "#4d7f96", "#e8f1f4", "#24506a"),
  bonito: A("tuna", "#3f6f8f", "#e6eff3", "#1e4763"),
  barracuda: A("slim", "#93a3ac", "#f0f4f5", "#56707e"),
  yellowfin: A("tuna", "#2f6f9c", "#f2e9c8", "#f2c14e"),
  swordfish: A("bill", "#4a6b86", "#e9eff3", "#2a3f57"),
  marlin: A("bill", "#2f6fa8", "#dfeaf2", "#46b6e0"),
  manta: A("ray", "#3a4f66", "#e6edf2", "#1f2c3b"),
  hammerhead: A("shark", "#7c8f9c", "#edf1f2", "#4a5a66"),
  oarfish: A("eel", "#c3ced6", "#f2f6f8", "#d9455a"),
  sunfish: A("disc", "#8f9aa3", "#dfe6ea", "#bcc7ce"),
  lanternfish: A("lantern", "#2c3b4a", "#6f8697", "#ffd873"),
  coelacanth: A("bottom", "#4a6d7a", "#9fc0c8", "#d8e6ea"),
  goldenkoi: A("round", "#f0b942", "#fff2cf", "#e05a3a"),
  moonwhale: A("whale", "#5b6ea8", "#cfd9f2", "#ffe9a8"),
  krakenling: A("squid", "#6b3f7d", "#d5b3e8", "#ff9ac1"),
  abyssray: A("ray", "#3a2f5c", "#8f7fc0", "#9fe8ff"),

  /* ---------- đồ vớt được ---------- */
  seaweed: A("weed", "#3f7a52", "#7fbd7f", "#2b5b3a"),
  driftwood: A("wood", "#8a6b4a", "#c4a179", "#5f4a33"),
  oldboot: A("boot", "#4a4136", "#7a6a58", "#2e2820"),
  treasure: A("chest", "#8a5a2b", "#d8a860", "#f0c268"),
};

const FALLBACK = A("slim", "#7f9fb5", "#e9f1f5", "#b8d4e0");

export function artFor(id: string): FishArtSpec {
  return FISH_ART[id] ?? FALLBACK;
}
