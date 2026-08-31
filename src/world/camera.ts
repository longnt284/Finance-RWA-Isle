/* ------------------------------------------------------------------ */
/*  Giá máy: giới hạn góc theo ngữ cảnh, va chạm, và những góc máy đẹp  */
/*                                                                     */
/*  `OrbitControls` để mặc định cho phép người chơi tự đưa mình vào     */
/*  những khung hình xấu: chúi xuống thấy mặt dưới địa hình, hoặc lùi   */
/*  camera xuyên qua tường một công trình. Cả hai đều sửa được ở tầng   */
/*  này mà không phải đụng vào bộ điều khiển.                          */
/* ------------------------------------------------------------------ */

import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ISLE_POSITIONS, terrainHeightAt } from "./build";
import { ISLAND_RADIUS, WATER_LEVEL } from "./ocean";
import { PIER_POSITION } from "./props";

/* ------------------------------------------------------------------ */
/*  Góc máy đẹp                                                        */
/* ------------------------------------------------------------------ */

export type ShotId = "harbor" | "lighthouse" | "skyline" | "pier" | "lagoon" | "drone";

export interface CameraShot {
  id: ShotId;
  pos: THREE.Vector3;
  target: THREE.Vector3;
  /** Tiêu cự riêng: góc hẹp nén phối cảnh lại, hợp với ảnh chân dung hòn đảo. */
  fov: number;
}

/**
 * Sáu khung hình đã ngắm sẵn.
 *
 * Chúng không phải "vị trí camera ngẫu nhiên nhìn cũng được": mỗi cái đặt một
 * tiền cảnh cụ thể vào một phần ba khung — cổng đảo, chân hải đăng, hàng công
 * trình, cọc bến câu — nên người chơi bấm một nút là có ảnh, thay vì phải tự
 * xoay tìm suốt hai phút rồi bỏ cuộc.
 */
export const CAMERA_SHOTS: CameraShot[] = [
  {
    /* Từ ngoài biển nhìn vào cổng đảo: cổng vàng làm tiền cảnh, hải đăng lùi
       về sau và cao hơn — bố cục ba lớp cổ điển. */
    id: "harbor",
    pos: new THREE.Vector3(1.5, 4.2, ISLAND_RADIUS + 17),
    target: new THREE.Vector3(0, 4.4, ISLAND_RADIUS - 6),
    fov: 40,
  },
  {
    /* Chân hải đăng, máy đặt thấp và ngước lên: công trình cao nhất đảo trông
       đúng là cao nhất đảo. */
    id: "lighthouse",
    pos: new THREE.Vector3(7.4, 2.0, 9.6),
    target: new THREE.Vector3(0, 7.4, 0),
    fov: 52,
  },
  {
    /* Ống kính dài đặt ngang tầm mắt, nhìn từ ngoài cổng vào: cổng, hai quận
       trước và hải đăng nén lại thành một hàng chân trời thay vì bốn khối rời
       rạc. Điểm ngắm nằm trước dãy nhà chứ không sau, để tia va chạm không bao
       giờ xuyên qua chính thứ đang được lấy làm mẫu. */
    id: "skyline",
    pos: new THREE.Vector3(0, 5.8, 40),
    target: new THREE.Vector3(0, 4.6, 12),
    fov: 30,
  },
  {
    /* Sát mặt nước ngoài bến câu, nhìn ngược vào bờ — con sóng chạy ngay dưới
       ống kính, cọc bến làm tiền cảnh. */
    id: "pier",
    pos: new THREE.Vector3(PIER_POSITION.x - 8.6, WATER_LEVEL + 4.2, PIER_POSITION.z + 9.8),
    target: new THREE.Vector3(PIER_POSITION.x, 1.4, PIER_POSITION.z),
    fov: 46,
  },
  {
    /* Vành san hô và một hòn đảo riêng ở hậu cảnh: khung hình duy nhất cho
       thấy lãnh thổ rộng tới đâu. */
    id: "lagoon",
    pos: new THREE.Vector3(74, 12.5, 58),
    target: ISLE_POSITIONS.academy.clone().setY(3.2),
    fov: 38,
  },
  {
    /* Flycam: nhìn xuống toàn đảo, đủ cao để thấy cả bốn quận lẫn vành cát. */
    id: "drone",
    pos: new THREE.Vector3(-26, 46, 30),
    target: new THREE.Vector3(0, 1.5, 0),
    fov: 48,
  },
];

/**
 * Thứ tự hiện trong giao diện, và cũng là nguồn sự thật cho bài kiểm tra i18n —
 * nó đọc thẳng mảng này từ mã nguồn để biết cần những khoá `shot.*` nào. Kiểu
 * `ShotId` giữ cho hai danh sách không lệch nhau.
 */
export const SHOT_IDS: ShotId[] = ["harbor", "lighthouse", "skyline", "pier", "lagoon", "drone"];
export const SHOT_BY_ID = new Map(CAMERA_SHOTS.map((shot) => [shot.id, shot]));

/* ------------------------------------------------------------------ */
/*  Giá máy                                                            */
/* ------------------------------------------------------------------ */

export interface CameraRig {
  /** Trả camera về đúng vị trí quỹ đạo trước khi `controls.update()` chạy. */
  beforeControls(): void;
  /**
   * Kẹp góc, đẩy camera tránh vật cản, rồi ghim sàn. Gọi sau `controls.update()`.
   *
   * `dt` phải là thời gian thật của khung hình, KHÔNG phải giá trị đã bị kẹp
   * xuống 0,05 giây cho vật lý. Trên máy chạy 2 khung/giây, dùng dt đã kẹp thì
   * camera cần ba giây mới lùi hết ra sau một va chạm, và người chơi thấy nó
   * lết chứ không thấy nó trở lại.
   */
  afterControls(dt: number): void;
  /** Danh sách vật thể camera không được chui qua. */
  colliders: THREE.Object3D[];
  /**
   * Nới trần góc chúi cho một khung hình đã ngắm sẵn.
   *
   * Giới hạn tự động tồn tại để người chơi không tự lia camera xuống dưới mặt
   * đảo. Nhưng "chân hải đăng" hay "bến câu sát nước" cố tình đặt máy thấp hơn
   * điểm ngắm và ngước lên — đó là toàn bộ lý do chúng đẹp. Khung hình do người
   * dựng thì được ưu tiên; `null` để trả lại cho giới hạn tự động, và nó tự trả
   * lại ngay khi người chơi cầm lấy chuột.
   */
  polarOverride: number | null;
  /** Tắt hẳn khi đang lái du thuyền ngoài khơi — ở đó không có gì để đâm vào. */
  enabled: boolean;
}

/** Chừa một khoảng trước mặt vật cản để không nhìn thấy mặt trong của tường. */
const COLLIDE_MARGIN = 0.85;
/** Camera không bao giờ dí sát hơn mức này, kể cả khi bị tường ép. */
const MIN_ORBIT = 2.6;
/**
 * Vùng miễn trừ quanh điểm ngắm.
 *
 * Chính thứ đang được lấy làm mẫu không được phép đẩy camera vào. Không có
 * khoảng này thì góc máy "chân hải đăng" — điểm ngắm nằm trong lòng tháp —
 * dí camera sát vào tường ngay khi vừa hạ cánh.
 */
const TARGET_SKIP = 1.6;

/**
 * Góc chúi tối đa theo khoảng cách.
 *
 * Ở tầm gần, `maxPolarAngle` mặc định 1,5 rad (86°) cho phép camera hạ xuống
 * gần như ngang mặt đất, và vì mặt đảo là một khối trụ hữu hạn nên người chơi
 * nhìn thẳng vào… mặt dưới của nó. Càng lại gần càng phải chặn sớm.
 */
function maxPolarFor(distance: number): number {
  const k = THREE.MathUtils.smoothstep(distance, 12, 86);
  return THREE.MathUtils.lerp(1.3, 1.52, k);
}

/** Góc chúi của một cặp (điểm ngắm, vị trí máy) — 0 là nhìn thẳng từ trên xuống. */
export function polarBetween(position: THREE.Vector3, target: THREE.Vector3): number {
  const dy = position.y - target.y;
  const distance = position.distanceTo(target);
  return distance < 1e-4 ? Math.PI / 2 : Math.acos(THREE.MathUtils.clamp(dy / distance, -1, 1));
}

export function makeCameraRig(camera: THREE.PerspectiveCamera, controls: OrbitControls): CameraRig {
  const raycaster = new THREE.Raycaster();
  const orbitPos = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const origin = new THREE.Vector3();
  let applied = false;
  /* Khoảng cách đã lọc: nhảy thẳng tới điểm va chạm sẽ giật mỗi khi một cành
     cây quét ngang tia, nên nó được kéo mượt về đích. */
  let smoothed = 0;

  const rig: CameraRig = {
    colliders: [],
    polarOverride: null,
    enabled: true,

    beforeControls() {
      /* Vị trí đang hiển thị có thể đã bị va chạm kéo vào. `OrbitControls` suy
         ra quỹ đạo từ chính `camera.position`, nên phải trả nó về đúng chỗ cũ,
         nếu không camera sẽ tự thu lại dần cho tới khi dính vào mục tiêu. */
      if (applied) {
        camera.position.copy(orbitPos);
        applied = false;
      }
    },

    afterControls(rawDt: number) {
      const dt = Math.min(0.3, Math.max(0, rawDt));
      orbitPos.copy(camera.position);
      direction.subVectors(orbitPos, controls.target);
      const distance = direction.length();
      if (distance < 1e-4) return;
      direction.divideScalar(distance);

      controls.maxPolarAngle = Math.max(maxPolarFor(distance), rig.polarOverride ?? 0);

      let wanted = distance;
      if (rig.enabled && rig.colliders.length) {
        const skip = Math.min(TARGET_SKIP, distance * 0.4);
        origin.copy(controls.target).addScaledVector(direction, skip);
        raycaster.set(origin, direction);
        raycaster.far = distance - skip;
        /* Lớp cây cỏ đã tự khoá `raycast`, nên tia chỉ chạm địa hình và công
           trình — thứ thật sự chắn tầm nhìn. Mặt sau bị loại theo `side` của
           vật liệu, nên tia xuất phát từ trong lòng một khối kín thì đi thẳng
           ra ngoài chứ không báo va chạm giả. */
        const hits = raycaster.intersectObjects(rig.colliders, true);
        if (hits.length) wanted = Math.max(MIN_ORBIT, skip + hits[0].distance - COLLIDE_MARGIN);
      }

      /* Lùi ra thì từ tốn, bị ép vào thì lập tức — chậm một nhịp lúc bị ép là
         đúng một nhịp người chơi nhìn xuyên qua tường. */
      if (smoothed <= 0) smoothed = wanted;
      smoothed = wanted < smoothed ? wanted : THREE.MathUtils.damp(smoothed, wanted, 3.4, dt);

      camera.position.copy(controls.target).addScaledVector(direction, smoothed);

      /* Sàn cứng: dù xoay kiểu gì camera cũng không rơi xuống dưới mặt cỏ hay
         chìm dưới mặt biển. */
      const radial = Math.hypot(camera.position.x, camera.position.z);
      /* Trên đảo thì sàn là mặt cỏ; ngoài đảo là mặt biển. Lấy giá trị lớn hơn
         vì bãi cát thoải xuống dưới mực nước — bám mặt cát ở đó nghĩa là dìm
         camera xuống dưới sóng. */
      const floor = Math.max(
        WATER_LEVEL + 1.0,
        radial < ISLAND_RADIUS + 2 ? terrainHeightAt(camera.position.x, camera.position.z) + 1.15 : -Infinity
      );
      if (camera.position.y < floor) camera.position.y = floor;

      applied = camera.position.distanceToSquared(orbitPos) > 1e-6;
    },
  };
  return rig;
}
