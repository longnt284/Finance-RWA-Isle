import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Lớp hậu kỳ cuối cùng: chỉnh màu, tối góc, tán sắc và hạt phim       */
/*                                                                      */
/*  Vì sao một cảnh dựng đúng vẫn trông "như game": ống kính thật không  */
/*  bao giờ cho ra ảnh sạch tuyệt đối. Nó tối dần ở bốn góc, nó tách     */
/*  màu rất nhẹ ở rìa, cảm biến của nó luôn có hạt. Bộ não đã học suốt   */
/*  đời rằng ảnh có những khuyết tật đó là ảnh chụp, còn ảnh không có    */
/*  thì là ảnh máy vẽ. Thêm lại đúng liều lượng ấy là cách rẻ nhất để    */
/*  kéo khung hình từ "render" về phía "quay được".                      */
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
    uVignette: { value: 0.34 },
    /** Biên độ hạt phim. */
    uGrain: { value: 0.030 },
    /** Độ lệch kênh màu ở rìa khung, tính theo điểm ảnh. */
    uAberration: { value: 1.15 },
    /** Độ tương phản thêm vào quanh vùng trung tính. */
    uContrast: { value: 0.10 },
    /** Độ bão hoà nhân thêm. */
    uSaturation: { value: 1.06 },
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
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec2 centred = vUv - 0.5;
      float r2 = dot(centred, centred);

      /* --- tán sắc ---
         Thấu kính thật không hội tụ ba bước sóng vào đúng một điểm, và sai lệch
         đó tăng theo bình phương khoảng cách tới tâm ảnh. Ở giữa khung phải
         tuyệt đối sạch, nếu không thì thành nhoè chứ không thành "ống kính". */
      vec2 shift = centred * r2 * uAberration * uAmount / uResolution * 2.0;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + shift).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - shift).b;

      /* --- tương phản kiểu phim ---
         Đường cong chữ S quanh 0,5: vùng tối sâu thêm, vùng sáng nén lại, vùng
         giữa dựng đứng hơn. Kéo tuyến tính thì chỉ làm cháy sáng. */
      vec3 graded = mix(col, col * col * (3.0 - 2.0 * col), uContrast * uAmount);

      /* --- bão hoà, nhưng chia hai đầu sáng tối ---
         Bóng đổ ngả lam lạnh, vùng sáng ngả vàng ấm. Đây là cách phân loại màu
         của phim nhựa ngoài trời, và nó làm cảnh biển "có nắng" hơn hẳn so với
         việc chỉ tăng đều độ bão hoà. */
      float luma = dot(graded, vec3(0.2126, 0.7152, 0.0722));
      graded = mix(vec3(luma), graded, uSaturation);
      vec3 shadowTint = vec3(0.90, 0.99, 1.06);
      vec3 highTint = vec3(1.045, 1.005, 0.955);
      graded *= mix(shadowTint, highTint, smoothstep(0.25, 0.85, luma)) * uAmount + (1.0 - uAmount);

      /* --- tối góc --- */
      float vignette = 1.0 - uVignette * uAmount * smoothstep(0.16, 0.78, r2);
      graded *= vignette;

      /* --- hạt cảm biến ---
         Nhiều ở vùng tối, gần như biến mất ở vùng sáng — đúng như tỉ lệ tín
         hiệu trên nhiễu của một cảm biến thật. */
      float grain = hash(gl_FragCoord.xy + fract(uTime) * 431.7) - 0.5;
      graded += grain * uGrain * uAmount * (1.0 - smoothstep(0.2, 0.95, luma));

      gl_FragColor = vec4(clamp(graded, 0.0, 1.0), 1.0);
    }`,
};
