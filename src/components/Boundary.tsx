import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  Lưới an toàn cuối cùng                                             */
/*                                                                     */
/*  Gần như mọi màn hình của ứng dụng được nạp bằng `lazy()`. Một chunk */
/*  tải hụt — bản deploy mới vừa thay tên tệp, hay mạng rớt giữa chừng  */
/*  — là một lần React ném lỗi lúc dựng, và không có lưới này thì cả    */
/*  trang trắng bóc: không một chữ, không một nút, không cách nào thử   */
/*  lại. Thế giới 3D cũng vậy, WebGL có thể từ chối khởi tạo trên máy   */
/*  không có GPU.                                                      */
/*                                                                     */
/*  Chủ ý viết bằng style nội tuyến và song ngữ cứng: lúc này không thể */
/*  giả định bảng màu, Tailwind hay kho ngôn ngữ đã nạp được.          */
/* ------------------------------------------------------------------ */

interface Props {
  children: ReactNode;
}

interface State {
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    /* Không có máy chủ gom lỗi, nên console là chỗ duy nhất giữ lại vết. */
    console.error("[isle] lỗi không bắt được", error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.message) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          position: "fixed",
          inset: 0,
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#04141b",
          color: "#dbe7ea",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "34rem" }}>
          <p style={{ margin: 0, fontSize: "17px", fontWeight: 600 }}>Quần đảo chưa dựng lên được.</p>
          <p style={{ margin: "6px 0 0", fontSize: "15px", opacity: 0.72 }}>The archipelago failed to load.</p>
          <p style={{ margin: "18px 0 0", fontSize: "13px", opacity: 0.6, wordBreak: "break-word" }}>{this.state.message}</p>
          <p style={{ margin: "18px 0 0", fontSize: "12.5px", opacity: 0.6 }}>
            Tiến độ của bạn vẫn nằm nguyên trong máy — tải lại trang là vào chơi tiếp được.
            <br />
            Your progress is safe on this device; reloading the page picks up where you left off.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: "22px",
              padding: "11px 26px",
              borderRadius: "11px",
              border: "1px solid rgba(240,194,104,0.45)",
              background: "rgba(240,194,104,0.12)",
              color: "#f0c268",
              fontSize: "13px",
              letterSpacing: "0.08em",
              cursor: "pointer",
            }}
          >
            Tải lại · Reload
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
