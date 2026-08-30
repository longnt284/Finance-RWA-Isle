/**
 * Danh sách hạng mục trang trí đảo. Tách khỏi `world/build.ts` để giao diện
 * dùng được mà không kéo theo cả Three.js vào chunk của bảng điều khiển.
 */
export const DECOR_IDS = ["palms", "neon", "flags", "dock", "torch"] as const;
export type DecorId = (typeof DECOR_IDS)[number];
