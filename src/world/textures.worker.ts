/* ------------------------------------------------------------------ */
/*  Worker sinh vân bề mặt. Nhận một danh sách việc theo thứ tự ưu tiên, */
/*  gửi trả từng tấm ngay khi xong — tấm nào lên trước thì cảnh đẹp lên  */
/*  trước, không đợi cả bộ.                                              */
/* ------------------------------------------------------------------ */

import { generateTexture } from "./texturegen";
import type { TextureKey } from "./texturegen";

/* tsconfig chỉ nạp thư viện DOM, không nạp WebWorker: khai báo đúng phần
   phạm vi worker mà tệp này dùng. */
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<TextureKey[]>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
};

scope.onmessage = (event) => {
  for (const key of event.data) {
    const result = generateTexture(key);
    const transfer: Transferable[] = [result.normal.buffer];
    if (result.rough) transfer.push(result.rough.buffer);
    scope.postMessage(result, transfer);
  }
};
