/* ------------------------------------------------------------------ */
/*  Phong vũ biểu thị trường                                           */
/*                                                                     */
/*  Trò này kéo giá thật của 250 mã theo thời gian thực, rồi dùng chúng */
/*  làm đúng một việc: chạy chữ dưới chân màn hình. Thế giới 3D không   */
/*  biết gì về chuyện thị trường đang xanh hay đỏ.                      */
/*                                                                     */
/*  Phong vũ biểu nối hai thứ đó lại. Danh mục theo dõi của bạn hôm nay */
/*  ra sao thì bầu trời trên đảo hôm nay như vậy, và cá cũng cắn câu    */
/*  theo. Không phải để "thưởng cho ngày xanh" — trời giông ngày đỏ đẹp */
/*  hơn trời quang, và cá hiếm lại nổi nhiều hơn khi biển động.         */
/*                                                                     */
/*  Thuần, không phụ thuộc gì: nhận vào mảng phần trăm thay đổi trong ngày,  */
/*  trả ra một con số.                                                  */
/* ------------------------------------------------------------------ */

import type { WeatherId } from "./season";

export type BarometerBand = "storm" | "gloom" | "calm" | "fair" | "radiant";

export interface Barometer {
  /** −1 (đỏ hết) tới +1 (xanh hết). */
  score: number;
  band: BarometerBand;
  /** Số mã thực sự góp mặt vào phép tính. */
  sampled: number;
  /** Phần trăm thay đổi trung vị, giữ nguyên đơn vị phần trăm. */
  medianPct: number;
}

/** Khi chưa có mã nào để đọc, phong vũ biểu đứng yên ở giữa. */
export const BAROMETER_IDLE: Barometer = { score: 0, band: "calm", sampled: 0, medianPct: 0 };

/**
 * Đọc phong vũ biểu từ một rổ giá.
 *
 * Dùng TRUNG VỊ chứ không dùng trung bình. Rổ theo dõi của người chơi hay có
 * một mã altcoin nhảy 40% trong ngày; lấy trung bình thì một mã đó điều khiển
 * cả bầu trời, còn trung vị thì nó chỉ là một phiếu trong rổ.
 */
export function readBarometer(percentChanges: readonly number[]): Barometer {
  /* Nhận thẳng phần trăm thay đổi chứ không nhận cặp giá: kho giá của ứng dụng
     đã có sẵn trường đó, và tự tính lại từ `prev` là tính nhầm — `prev` ở đó là
     giá của tick trước, không phải giá đóng cửa phiên trước. */
  const changes = percentChanges.filter((value) => Number.isFinite(value));
  if (!changes.length) return BAROMETER_IDLE;

  changes.sort((a, b) => a - b);
  const middle = changes.length >> 1;
  const medianPct = changes.length % 2 ? changes[middle] : (changes[middle - 1] + changes[middle]) / 2;

  /* tanh nén hai đầu: ±3% đã là một ngày rõ ràng, ±20% thì cũng chỉ là "hết
     biên" chứ không có gì hơn để nói. */
  const score = Math.tanh(medianPct / 2.4);
  return { score, band: bandFor(score), sampled: changes.length, medianPct };
}

export function bandFor(score: number): BarometerBand {
  if (score <= -0.55) return "storm";
  if (score <= -0.18) return "gloom";
  if (score < 0.18) return "calm";
  if (score < 0.55) return "fair";
  return "radiant";
}

/**
 * Bảng cân thời tiết mà phong vũ biểu cộng thêm vào bảng cân theo mùa.
 *
 * Đây là hệ số NHÂN, không phải bảng thay thế: mùa đông vẫn ra mùa đông, thị
 * trường chỉ nghiêng cán cân trong những kiểu thời tiết mà mùa ấy vốn đã có.
 * Thay hẳn thì một ngày đỏ giữa mùa xuân sẽ ra tuyết rơi.
 */
export function weatherBias(band: BarometerBand): Partial<Record<WeatherId, number>> {
  switch (band) {
    case "storm":
      return { storm: 3.4, rain: 2.2, mist: 1.5, cloudy: 1.4, clear: 0.35, petals: 0.4, fireflies: 0.5 };
    case "gloom":
      return { rain: 1.7, cloudy: 1.6, mist: 1.4, storm: 1.3, clear: 0.6 };
    case "calm":
      return {};
    case "fair":
      return { clear: 1.5, petals: 1.3, fireflies: 1.3, cloudy: 0.75, rain: 0.6, storm: 0.4 };
    case "radiant":
      return { clear: 2.4, petals: 1.8, fireflies: 1.8, leaves: 1.3, cloudy: 0.5, rain: 0.3, storm: 0.15 };
  }
}

/**
 * Hệ số may mắn khi câu cá.
 *
 * Cố tình nghịch chiều với thị trường: biển động thì cá hiếm nổi lên. Thuận
 * chiều thì ngày đỏ vừa mất tiền thật vừa mất luôn cả trò chơi, mà ngày xanh
 * thì chẳng còn lý do gì để ra biển.
 */
export function luckBias(band: BarometerBand): number {
  switch (band) {
    case "storm":
      return 1.55;
    case "gloom":
      return 1.25;
    case "calm":
      return 1;
    case "fair":
      return 0.92;
    case "radiant":
      return 0.85;
  }
}

/** Hệ số xu của một chuyến viễn dương — biển lặng thì hàng về nhiều hơn. */
export function voyageBias(band: BarometerBand): number {
  switch (band) {
    case "storm":
      return 0.82;
    case "gloom":
      return 0.93;
    case "calm":
      return 1;
    case "fair":
      return 1.1;
    case "radiant":
      return 1.22;
  }
}
