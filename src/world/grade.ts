import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Lớp hậu kỳ cuối cùng: chỉnh màu điện ảnh, nét, tối góc, tán sắc,    */
/*  hạt phim và dither khử banding.                                     */
/*                                                                      */
/*  v2 photoreal — thêm 3 thứ mà bản trước thiếu:                        */
/*   1. Sharpen thích ứng theo độ sáng (CAS-lite 5-tap): mái ngói, lan   */
/*      can, tàu lá dừa nét căng ở tầm gần nhưng trời và biển xa không   */
/*      bị ringing.                                                      */
/*   2. Teal-orange split mạnh tay hơn + lift/gain: bóng đổ ngả lam      */
/*      lạnh sâu, vùng sáng ngả vàng mật ong — đúng stock phim ngoài     */
/*      trời, không phải "tăng bão hoà đều".                             */
/*   3. Dither 8-bit cuối chuỗi: bầu trời gradient mịn không còn vệt     */
/*      banding khi nén qua bloom + tone-map.                            */
/*                                                                      */
/*  Chạy sau `OutputPass`, tức là trên dữ liệu đã tone-map và mã hoá     */
/*  sRGB — đây là chỗ đúng cho những phép chỉnh mang tính "ống kính".    */
/* ------------------------------------------------------------------ */

export const GradeShader = {
  name: "GradeShader",
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    /** Hệ số tổng: 0 tắt hẳn hiệu ứng, 1 là liều đầy đủ. */
    uAmount: { value: 1 },
    uTime: { value: 0 },
    /** Độ tối bốn góc. */
    uVignette: { value: 0.30 },
    /** Biên độ hạt phim. */
    uGrain: { value: 0.026 },
    /** Độ lệch kênh màu ở rìa khung, tính theo điểm ảnh. */
    uAberration: { value: 0.9 },
    /** Độ tương phản thêm vào quanh vùng trung tính. */
    uContrast: { value: 0.12 },
    /** Độ bão hoà nhân thêm. */
    uSaturation: { value: 1.07 },
    /** Độ nét thích ứng (0 tắt). */
    uSharp: { value: 0.42 },
    /** Cường độ split teal-orange (0 trung tính). */
    uTeal: { value: 0.85 },
    /** Nâng chân đen / nén đỉnh sáng — mặc định trung tính. */
    uLift: { value: 0.0 },
    uGain: { value: 1.04 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAberration;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uSharp;
    uniform float uTeal;
    uniform float uLift;
    uniform float uGain;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float lumaOf(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

    void main() {
      vec2 centred = vUv - 0.5;
      float r2 = dot(centred, centred);
      vec2 texel = 1.0 / max(uResolution, vec2(1.0));

      /* --- tán sắc: sạch ở tâm, tách ~1px ở rìa ---
         Công thức gốc: shift tính theo texel (chia cho resolution), nhân 2.
         Giữ đúng tỉ lệ này — chỉ cần lệch hơn là viền đỏ/lục hiện rõ. */
      vec2 shift = centred * r2 * uAberration * uAmount * 2.0 / max(uResolution, vec2(1.0));
      shift = clamp(shift, vec2(-0.0016), vec2(0.0016));
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + shift).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - shift).b;

      /* --- sharpen thích ứng (CAS-lite) ---
         Lấy trung bình 4 điểm lân cận, chỉ nét ở vùng có chi tiết (tránh
         amplifying noise ở trời đêm), và nén ở vùng rất tối / rất sáng để
         không ringing quanh đèn và mặt trời. */
      float sharpAmt = uSharp * uAmount;
      if (sharpAmt > 0.001) {
        vec3 n = texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb;
        vec3 s = texture2D(tDiffuse, vUv - vec2(0.0, texel.y)).rgb;
        vec3 e = texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb;
        vec3 w = texture2D(tDiffuse, vUv - vec2(texel.x, 0.0)).rgb;
        vec3 avg = (n + s + e + w) * 0.25;
        float l = lumaOf(col);
        float detail = clamp(length(col - avg) * 6.0, 0.0, 1.0);
        float safe = smoothstep(0.02, 0.12, l) * (1.0 - smoothstep(0.86, 0.99, l));
        col += (col - avg) * sharpAmt * (0.25 + detail * 0.75) * (0.35 + safe * 0.65);
      }

      /* --- tương phản kiểu phim: S-curve quanh 0.5 --- */
      vec3 graded = mix(col, col * col * (3.0 - 2.0 * col), clamp(uContrast * uAmount, 0.0, 1.0));

      /* --- bão hoà --- */
      float luma0 = lumaOf(graded);
      graded = mix(vec3(luma0), graded, uSaturation);

      /* --- teal-orange split + lift/gain ---
         Bóng: đẩy về lam-lục lạnh. Sáng: đẩy về vàng mật ong.
         uTeal điều liều để ban đêm không bị ám màu quá tay. */
      float luma = lumaOf(graded);
      vec3 shadowTint = mix(vec3(1.0), vec3(0.88, 0.99, 1.07), uTeal);
      vec3 highTint = mix(vec3(1.0), vec3(1.055, 1.005, 0.945), uTeal);
      vec3 splitMix = mix(shadowTint, highTint, smoothstep(0.18, 0.85, luma));
      graded *= mix(vec3(1.0), splitMix, uAmount);
      graded = graded * uGain + vec3(uLift) * (1.0 - smoothstep(0.0, 0.55, luma)) * uAmount;

      /* --- tối góc điện ảnh: cong mượt + hơi tối đỉnh trên --- */
      float vig = 1.0 - uVignette * uAmount * smoothstep(0.12, 0.80, r2);
      vig *= 1.0 - 0.05 * uAmount * smoothstep(0.1, 0.9, vUv.y);
      graded *= vig;

      /* --- hạt cảm biến: nhiều ở tối, tan ở sáng, động theo thời gian --- */
      float t = fract(uTime) * 431.7 + fract(uTime * 0.37) * 97.3;
      float grain = hash(gl_FragCoord.xy + t) - 0.5;
      float grainMask = (1.0 - smoothstep(0.15, 0.95, luma));
      graded += grain * uGrain * uAmount * (0.35 + grainMask * 0.65);

      /* --- dither 8-bit: 1 LSB nhiễu để gradient trời không banding --- */
      graded += (hash(gl_FragCoord.xy * 0.713 + 19.19) - 0.5) * (1.2 / 255.0);

      gl_FragColor = vec4(clamp(graded, 0.0, 1.0), 1.0);
    }`,
};
