/* ------------------------------------------------------------------ */
/*  Đi qua cổng vào                                                    */
/*                                                                     */
/*  Từ khi trang bìa được dựng trước còn thế giới 3D dựng sau, canvas   */
/*  KHÔNG tồn tại cho tới lúc người chơi bấm nút vào đảo. Mọi bài kiểm  */
/*  mở thẳng trang rồi chờ `canvas` vì thế đều treo đủ 30 giây rồi hỏng */
/*  — không phải vì ứng dụng sai, mà vì bài kiểm chưa bấm nút.         */
/*                                                                     */
/*  Nút mang `data-gate="enter"` nên chỗ này không phụ thuộc vào nhãn   */
/*  chữ, vốn đổi theo ngôn ngữ và theo việc người chơi đã lập đảo chưa. */
/* ------------------------------------------------------------------ */

/**
 * Bấm nút vào đảo rồi chờ canvas hiện ra.
 *
 * @param {import("playwright").Page} page
 * @param {{ timeout?: number }} [options]
 */
async function enterIsland(page, options = {}) {
  /* Dựng cảnh là một khối công việc đồng bộ nặng: trên máy chạy phần mềm giả
     lập GPU (đúng cái mà máy chủ CI hay dùng) nó khoá luồng chính hơn nửa phút.
     Ba mươi giây là quá sát, và một bài kiểm hỏng vì máy chậm thì không nói lên
     điều gì về ứng dụng. */
  const timeout = options.timeout ?? 90_000;
  const enter = page.locator('[data-gate="enter"]');
  const demo = page.locator('[data-gate="demo"]');
  await enter.waitFor({ state: "visible", timeout });
  /* Với người chơi chưa lập đảo, nút chính chỉ mở bảng lập đảo chứ không mở
     cổng; đường vào thẳng thế giới của họ là nút demo. Bản lưu đã lập đảo thì
     không có nút demo, và nút chính mở cổng ngay. */
  const gate = (await demo.count()) ? demo : enter;
  await gate.click();
  await page.locator("canvas").waitFor({ state: "visible", timeout });
}

module.exports = { enterIsland };
