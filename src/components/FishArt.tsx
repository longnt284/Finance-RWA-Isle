import { useId } from "react";
import { artFor } from "../lib/fishArt";
import type { FishArtSpec, FishShape } from "../lib/fishArt";
import { RARITY_META } from "../lib/fishing";
import type { FishDef } from "../lib/fishing";

/* ------------------------------------------------------------------ */
/*  Chân dung một con cá                                               */
/*                                                                     */
/*  Khung vẽ 120×72, đầu quay sang phải, thân nằm quanh trục y = 36.    */
/*  Mọi dáng đều tôn trọng ba mốc đó nên đổi loài giữa chừng không làm  */
/*  hình nhảy trong ô.                                                 */
/* ------------------------------------------------------------------ */

interface Parts {
  spec: FishArtSpec;
  /** id gradient thân — mỗi lần vẽ một id riêng, nếu không hai con cá trên
      cùng trang sẽ giành nhau một định nghĩa gradient. */
  fill: string;
  accentFill: string;
}

function eye(cx: number, cy: number, r = 3) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#0d1a1c" />
      <circle cx={cx + r * 0.32} cy={cy - r * 0.32} r={r * 0.34} fill="#ffffff" opacity="0.9" />
    </g>
  );
}

function shapeOf(shape: FishShape, { spec, fill, accentFill }: Parts) {
  const stroke = { stroke: spec.accent, strokeWidth: 1.1, strokeLinejoin: "round" as const };
  switch (shape) {
    case "slim":
      return (
        <g>
          <path d="M28 36 L8 17 L15 36 L8 55 Z" fill={accentFill} {...stroke} />
          <path d="M60 23 L70 9 L79 24 Z" fill={accentFill} {...stroke} />
          <path d="M58 49 L64 61 L73 48 Z" fill={accentFill} {...stroke} />
          <path d="M27 36 C42 17 78 14 106 33 C108 34.5 108 37.5 106 39 C78 58 42 55 27 36 Z" fill={fill} {...stroke} />
          <path d="M34 40 C56 51 82 50 102 39 C80 46 56 46 34 40 Z" fill={spec.belly} opacity="0.75" />
          {eye(96, 32)}
        </g>
      );
    case "round":
      return (
        <g>
          <path d="M30 36 L8 15 L16 36 L8 57 Z" fill={accentFill} {...stroke} />
          <path d="M52 13 C64 3 80 8 88 19 L60 22 Z" fill={accentFill} {...stroke} />
          <path d="M54 58 C62 66 74 62 80 54 L58 50 Z" fill={accentFill} {...stroke} />
          <path d="M29 36 C33 12 70 5 98 26 C106 32 106 40 98 46 C70 67 33 60 29 36 Z" fill={fill} {...stroke} />
          <path d="M40 44 C60 58 84 54 99 42 C80 50 58 51 40 44 Z" fill={spec.belly} opacity="0.72" />
          <path d="M74 18 C78 30 78 42 74 54" fill="none" stroke={spec.accent} strokeWidth="1.6" opacity="0.5" />
          {eye(91, 31)}
        </g>
      );
    case "tuna":
      return (
        <g>
          <path d="M30 36 L6 12 L22 36 L6 60 Z" fill={accentFill} {...stroke} />
          <path d="M56 22 L70 6 L78 24 Z" fill={accentFill} {...stroke} />
          <path d="M56 50 L62 64 L74 48 Z" fill={accentFill} {...stroke} />
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M${36 + i * 7} 26 l5 -4 l0 4 z`} fill={spec.accent} opacity="0.8" />
          ))}
          <path d="M28 36 C40 14 78 11 106 32 C108 33.5 108 38.5 106 40 C78 61 40 58 28 36 Z" fill={fill} {...stroke} />
          <path d="M36 42 C58 55 86 52 103 40 C82 49 56 49 36 42 Z" fill={spec.belly} opacity="0.78" />
          <path d="M46 30 C66 26 88 28 102 34" fill="none" stroke={spec.accent} strokeWidth="1.8" opacity="0.55" />
          {eye(95, 31)}
        </g>
      );
    case "bill":
      return (
        <g>
          <path d="M28 36 L6 14 L20 36 L6 58 Z" fill={accentFill} {...stroke} />
          <path d="M46 24 C58 2 78 2 86 16 L54 27 Z" fill={accentFill} {...stroke} />
          <path d="M52 50 L58 63 L70 48 Z" fill={accentFill} {...stroke} />
          <path d="M27 36 C40 17 74 14 96 31 C97.5 32.5 97.5 39 96 40 C74 57 40 55 27 36 Z" fill={fill} {...stroke} />
          <path d="M96 34 L119 34.6 L119 37.4 L96 38 Z" fill={spec.accent} />
          <path d="M34 41 C56 52 80 50 94 40 C76 46 54 47 34 41 Z" fill={spec.belly} opacity="0.75" />
          {eye(89, 32, 2.6)}
        </g>
      );
    case "shark":
      return (
        <g>
          <path d="M28 36 L8 10 L20 34 L8 52 Z" fill={accentFill} {...stroke} />
          <path d="M52 24 L62 4 L72 26 Z" fill={accentFill} {...stroke} />
          <path d="M56 48 L52 62 L70 47 Z" fill={accentFill} {...stroke} />
          <path d="M27 36 C40 18 72 15 94 30 C96 31.5 96 40 94 41 C72 56 40 54 27 36 Z" fill={fill} {...stroke} />
          {/* Đầu búa: chỗ duy nhất khiến loài này nhận ra được từ xa. */}
          <path d="M92 26 C104 24 112 26 114 30 C116 34 114 40 108 42 C100 44 94 42 92 40 Z" fill={fill} {...stroke} />
          <path d="M34 41 C56 51 80 48 93 40 C76 45 54 46 34 41 Z" fill={spec.belly} opacity="0.7" />
          {eye(112, 29, 2.4)}
          {eye(97, 43, 2.4)}
        </g>
      );
    case "ray":
      return (
        <g>
          <path d="M52 40 C40 48 24 56 6 58 C22 52 36 46 48 38 Z" fill={accentFill} {...stroke} />
          <path d="M20 36 C34 12 74 8 100 26 C110 32 110 40 100 46 C74 64 34 60 20 36 Z" fill={fill} {...stroke} />
          <path d="M30 36 C46 22 78 20 98 32 C78 42 46 44 30 36 Z" fill={spec.belly} opacity="0.55" />
          <path d="M96 22 C104 20 110 24 108 28" fill="none" stroke={spec.accent} strokeWidth="2.4" strokeLinecap="round" />
          {eye(93, 30, 2.6)}
        </g>
      );
    case "eel":
      return (
        <g>
          <path
            d="M8 46 C24 20 40 58 56 34 C70 13 86 46 104 30"
            fill="none"
            stroke={spec.accent}
            strokeWidth="13"
            strokeLinecap="round"
            opacity="0.45"
          />
          <path
            d="M8 46 C24 20 40 58 56 34 C70 13 86 46 104 30"
            fill="none"
            stroke={fill}
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path d="M104 30 C112 27 116 30 114 35 C112 40 106 39 103 36 Z" fill={fill} {...stroke} />
          {eye(108, 32, 2.2)}
        </g>
      );
    case "puffer":
      return (
        <g>
          {Array.from({ length: 14 }).map((_, i) => {
            const a = (i / 14) * Math.PI * 2;
            const cx = 62 + Math.cos(a) * 25;
            const cy = 36 + Math.sin(a) * 25;
            return (
              <path
                key={i}
                d={`M${cx} ${cy} L${62 + Math.cos(a) * 34} ${36 + Math.sin(a) * 34} L${cx + Math.cos(a + 1.6) * 5} ${cy + Math.sin(a + 1.6) * 5} Z`}
                fill={spec.accent}
              />
            );
          })}
          <circle cx="62" cy="36" r="26" fill={fill} stroke={spec.accent} strokeWidth="1.2" />
          <path d="M42 46 C52 58 74 58 84 45 C74 52 52 53 42 46 Z" fill={spec.belly} opacity="0.8" />
          <path d="M84 34 C92 32 96 36 92 40 C88 43 84 40 84 37 Z" fill={spec.belly} stroke={spec.accent} strokeWidth="1" />
          {eye(78, 28, 3.4)}
        </g>
      );
    case "squid":
      return (
        <g>
          {[-16, -8, 0, 8, 16].map((offset, i) => (
            <path
              key={offset}
              d={`M40 ${36 + offset * 0.55} C26 ${34 + offset} 16 ${40 + offset * 1.5} 6 ${36 + offset * 1.8}`}
              fill="none"
              stroke={i % 2 ? spec.accent : fill}
              strokeWidth="4.2"
              strokeLinecap="round"
            />
          ))}
          <path d="M42 36 C42 20 62 12 84 14 C104 16 112 26 112 36 C112 46 104 56 84 58 C62 60 42 52 42 36 Z" fill={fill} stroke={spec.accent} strokeWidth="1.2" />
          <path d="M56 44 C74 54 96 50 108 40 C94 46 74 48 56 44 Z" fill={spec.belly} opacity="0.7" />
          <path d="M96 12 L112 4 L108 18 Z" fill={spec.accent} opacity="0.85" />
          <path d="M96 60 L112 68 L108 54 Z" fill={spec.accent} opacity="0.85" />
          {eye(58, 32, 3.6)}
        </g>
      );
    case "crab":
      return (
        <g>
          {[-1, 1].map((side) =>
            [0, 1, 2].map((i) => (
              <path
                key={`${side}-${i}`}
                d={`M${58 + i * 11} ${36 + side * 12} L${52 + i * 13} ${36 + side * 26} L${60 + i * 13} ${36 + side * 30}`}
                fill="none"
                stroke={spec.accent}
                strokeWidth="4"
                strokeLinecap="round"
              />
            ))
          )}
          <path d="M26 26 C16 22 8 28 12 36 C16 44 28 42 30 34 Z" fill={fill} stroke={spec.accent} strokeWidth="1.2" />
          <path d="M26 46 C16 50 10 44 14 38" fill="none" stroke={spec.accent} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M34 36 C34 20 54 12 72 12 C92 12 104 22 104 36 C104 50 92 60 72 60 C54 60 34 52 34 36 Z" fill={fill} stroke={spec.accent} strokeWidth="1.3" />
          <path d="M44 44 C60 54 84 52 98 42 C84 48 60 50 44 44 Z" fill={spec.belly} opacity="0.75" />
          {eye(58, 26, 3.2)}
          {eye(80, 26, 3.2)}
        </g>
      );
    case "lobster":
      return (
        <g>
          <path d="M96 20 C110 10 118 14 116 22" fill="none" stroke={spec.accent} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M96 52 C110 62 118 58 116 50" fill="none" stroke={spec.accent} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M24 36 L6 22 L14 36 L6 50 Z" fill={spec.accent} />
          {[0, 1, 2, 3].map((i) => (
            <path
              key={i}
              d={`M${26 + i * 15} 26 C${34 + i * 15} 18 ${42 + i * 15} 22 ${44 + i * 15} 28 L${44 + i * 15} 44 C${42 + i * 15} 50 ${34 + i * 15} 54 ${26 + i * 15} 46 Z`}
              fill={fill}
              stroke={spec.accent}
              strokeWidth="1.1"
            />
          ))}
          <path d="M86 24 C102 18 112 26 106 34 C100 41 88 38 86 32 Z" fill={fill} stroke={spec.accent} strokeWidth="1.2" />
          <path d="M86 48 C102 54 112 46 106 39" fill="none" stroke={spec.accent} strokeWidth="3.6" strokeLinecap="round" />
          <path d="M32 40 C56 48 78 46 92 40 C76 44 54 45 32 40 Z" fill={spec.belly} opacity="0.6" />
          {eye(80, 30, 2.4)}
        </g>
      );
    case "lantern":
      return (
        <g>
          <circle cx="86" cy="18" r="13" fill={spec.accent} opacity="0.25" />
          <path d="M76 30 C80 20 84 16 86 14" fill="none" stroke={spec.accent} strokeWidth="2" strokeLinecap="round" />
          <circle cx="86" cy="13" r="5" fill={spec.accent} />
          <path d="M26 36 L8 20 L15 36 L8 52 Z" fill={spec.accent} opacity="0.7" />
          <path d="M25 36 C36 20 66 16 92 32 C94 33.5 94 38.5 92 40 C66 56 36 52 25 36 Z" fill={fill} stroke={spec.accent} strokeWidth="1.1" />
          <path d="M32 42 C54 51 76 49 90 40 C72 46 52 47 32 42 Z" fill={spec.belly} opacity="0.55" />
          {[38, 50, 62, 74].map((x) => (
            <circle key={x} cx={x} cy="41" r="2.2" fill={spec.accent} />
          ))}
          {eye(84, 33, 2.6)}
        </g>
      );
    case "disc":
      return (
        <g>
          <path d="M60 14 C58 2 70 0 76 10 L74 22 Z" fill={accentFill} {...stroke} />
          <path d="M60 58 C58 70 70 72 76 62 L74 50 Z" fill={accentFill} {...stroke} />
          <path d="M34 36 C34 14 56 6 78 12 C98 18 104 28 104 36 C104 44 98 54 78 60 C56 66 34 58 34 36 Z" fill={fill} stroke={spec.accent} strokeWidth="1.2" />
          <path d="M34 30 C28 32 26 40 34 42 C31 38 31 34 34 30 Z" fill={spec.accent} />
          <path d="M50 46 C68 56 90 50 101 41 C88 48 68 51 50 46 Z" fill={spec.belly} opacity="0.7" />
          {eye(90, 28, 3)}
        </g>
      );
    case "whale":
      return (
        <g>
          <path d="M24 36 L4 18 L16 36 L4 54 Z" fill={accentFill} {...stroke} />
          <path d="M58 20 L68 8 L74 22 Z" fill={accentFill} {...stroke} />
          <path d="M22 36 C34 14 72 10 104 30 C107 32 107 40 104 42 C72 62 34 58 22 36 Z" fill={fill} stroke={spec.accent} strokeWidth="1.2" />
          <path d="M34 44 C60 58 88 54 102 43 C84 51 56 52 34 44 Z" fill={spec.belly} opacity="0.8" />
          {[46, 58, 70, 82].map((x) => (
            <path key={x} d={`M${x} 44 C${x + 2} 50 ${x + 2} 52 ${x} 54`} fill="none" stroke={spec.accent} strokeWidth="1.4" opacity="0.6" />
          ))}
          <path d="M86 22 C90 16 94 16 96 20" fill="none" stroke={spec.accent} strokeWidth="1.8" strokeLinecap="round" />
          {eye(97, 34, 2.6)}
        </g>
      );
    case "bottom":
      return (
        <g>
          <path d="M28 40 L8 28 L16 40 L10 54 Z" fill={accentFill} {...stroke} />
          <path d="M46 28 L56 14 L66 30 Z" fill={accentFill} {...stroke} />
          <path d="M50 52 L52 64 L64 52 Z" fill={accentFill} {...stroke} />
          <path d="M74 50 L80 62 L90 50 Z" fill={accentFill} {...stroke} />
          <path d="M27 40 C40 22 74 18 100 32 C102 33.5 102 42 100 44 C74 58 40 56 27 40 Z" fill={fill} {...stroke} />
          <path d="M36 46 C58 55 82 52 97 44 C78 50 56 51 36 46 Z" fill={spec.belly} opacity="0.7" />
          {[46, 58, 70].map((x) => (
            <circle key={x} cx={x} cy="34" r="2.4" fill={spec.belly} opacity="0.8" />
          ))}
          {eye(90, 36, 2.8)}
        </g>
      );

    /* ---------------- đồ vớt được ---------------- */
    case "weed":
      return (
        <g>
          {[-18, -6, 6, 18].map((offset, i) => (
            <path
              key={offset}
              d={`M${60 + offset} 66 C${52 + offset} 48 ${70 + offset} 38 ${58 + offset} 14`}
              fill="none"
              stroke={i % 2 ? spec.accent : fill}
              strokeWidth="6"
              strokeLinecap="round"
            />
          ))}
          <path d="M36 66 C54 62 72 62 88 66 Z" fill={spec.accent} opacity="0.6" />
          <circle cx="52" cy="30" r="4" fill={spec.belly} opacity="0.85" />
          <circle cx="72" cy="42" r="3.4" fill={spec.belly} opacity="0.85" />
        </g>
      );
    case "wood":
      return (
        <g>
          <path d="M14 44 C26 30 92 26 106 34 C110 36.5 110 43 106 46 C92 54 26 58 14 50 Z" fill={fill} stroke={spec.accent} strokeWidth="1.2" />
          <ellipse cx="106" cy="40" rx="5" ry="7" fill={spec.belly} stroke={spec.accent} strokeWidth="1" />
          <ellipse cx="106" cy="40" rx="2" ry="3" fill={spec.accent} />
          {[34, 54, 74].map((x) => (
            <path key={x} d={`M${x} 32 C${x + 3} 40 ${x + 3} 44 ${x} 54`} fill="none" stroke={spec.accent} strokeWidth="1.3" opacity="0.6" />
          ))}
        </g>
      );
    case "boot":
      return (
        <g>
          <path d="M46 8 L74 8 L76 40 L102 46 C110 48 110 62 100 62 L46 62 C40 62 40 54 42 46 Z" fill={fill} stroke={spec.accent} strokeWidth="1.3" />
          <path d="M42 52 L106 56 L106 62 L44 62 Z" fill={spec.accent} />
          <path d="M46 8 L74 8 L74 16 L46 16 Z" fill={spec.belly} opacity="0.7" />
          {[24, 32].map((y) => (
            <path key={y} d={`M50 ${y} L70 ${y + 3}`} stroke={spec.accent} strokeWidth="1.6" opacity="0.7" />
          ))}
        </g>
      );
    default:
      return (
        <g>
          <path d="M20 34 C20 18 100 18 100 34 L100 58 C100 62 96 64 92 64 L28 64 C24 64 20 62 20 58 Z" fill={fill} stroke={spec.accent} strokeWidth="1.3" />
          <path d="M20 34 C20 18 100 18 100 34 Z" fill={spec.belly} stroke={spec.accent} strokeWidth="1.3" />
          <rect x="18" y="34" width="84" height="6" fill={spec.accent} />
          <rect x="54" y="30" width="12" height="18" rx="2" fill={spec.accent} />
          <circle cx="60" cy="40" r="2.6" fill="#2a1a08" />
        </g>
      );
  }
}

interface Props {
  fish: FishDef;
  className?: string;
  /** Loài chưa gặp: vẽ bóng đen thay vì tô màu, giữ nguyên dáng để tò mò. */
  unknown?: boolean;
  /** Quầng sáng theo độ hiếm phía sau con cá. */
  halo?: boolean;
}

export default function FishArt({ fish, className, unknown = false, halo = true }: Props) {
  const uid = useId().replace(/:/g, "");
  const spec = artFor(fish.id);
  const rarity = RARITY_META[fish.rarity].color;
  const bodyId = `fa-${uid}-b`;
  const accentId = `fa-${uid}-a`;
  const haloId = `fa-${uid}-h`;
  const shade: FishArtSpec = unknown
    ? { shape: spec.shape, body: "#1b2b2e", belly: "#25383b", accent: "#31494d" }
    : spec;

  return (
    <svg viewBox="0 0 120 72" className={className} role="img" aria-hidden="true" focusable="false">
      <defs>
        {/* Gradient chạy chéo từ lưng xuống bụng — cách rẻ nhất để một hình
            phẳng đọc ra khối tròn. */}
        <linearGradient id={bodyId} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor={shade.body} />
          <stop offset="58%" stopColor={shade.body} />
          <stop offset="100%" stopColor={shade.belly} />
        </linearGradient>
        <linearGradient id={accentId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={shade.accent} />
          <stop offset="100%" stopColor={shade.body} />
        </linearGradient>
        <radialGradient id={haloId}>
          <stop offset="0%" stopColor={rarity} stopOpacity="0.34" />
          <stop offset="100%" stopColor={rarity} stopOpacity="0" />
        </radialGradient>
      </defs>
      {halo && !unknown && <ellipse cx="62" cy="36" rx="58" ry="34" fill={`url(#${haloId})`} />}
      {shapeOf(spec.shape, { spec: shade, fill: `url(#${bodyId})`, accentFill: `url(#${accentId})` })}
      {unknown && (
        <text x="60" y="44" textAnchor="middle" fontSize="24" fontWeight="700" fill="#5f7d82" opacity="0.85">
          ?
        </text>
      )}
    </svg>
  );
}
