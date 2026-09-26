/* ------------------------------------------------------------------ */
/*  Danh sách góc máy — tách khỏi `camera.ts` vì một lý do duy nhất:     */
/*  HUD và chế độ ảnh cần tên các góc máy để vẽ nút, mà `camera.ts`      */
/*  import three cùng toàn bộ bộ dựng cảnh. Chỉ một dòng import của HUD  */
/*  là đủ kéo hơn 150KB gzip của three vào bundle trang bìa — đúng thứ   */
/*  mà việc lazy-load WorldScene sinh ra để tránh. Tệp này không được    */
/*  import three, trực tiếp hay gián tiếp.                               */
/* ------------------------------------------------------------------ */

export type ShotId = "harbor" | "lighthouse" | "skyline" | "pier" | "lagoon" | "cliff" | "bay" | "drone";

/**
 * Thứ tự hiện trong giao diện, và cũng là nguồn sự thật cho bài kiểm tra i18n —
 * nó đọc thẳng mảng này từ mã nguồn để biết cần những khoá `shot.*` nào. Kiểu
 * `ShotId` giữ cho danh sách này và `CAMERA_SHOTS` trong `camera.ts` không lệch
 * nhau.
 */
export const SHOT_IDS: ShotId[] = ["harbor", "lighthouse", "skyline", "pier", "lagoon", "cliff", "bay", "drone"];
