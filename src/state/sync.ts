import { useEffect, useMemo, useRef } from "react";
import { useStore, serializeSave } from "./store";
import { cloudEnabled, currentSession, restoreSession, pushSave } from "../lib/cloud";

/** Chờ ngần này trước khi đẩy lên máy chủ, gộp nhiều thao tác liên tiếp lại. */
const PUSH_DEBOUNCE_MS = 4000;

/**
 * Đồng bộ nền: khôi phục phiên lúc mở app rồi tự lưu tiến độ lên máy chủ sau
 * mỗi thay đổi.
 *
 * Chủ ý không tự kéo bản trên máy chủ đè lên bản đang chơi — ghi đè ngầm là
 * cách nhanh nhất để người dùng mất tiến độ. Việc kéo về là hành động có xác
 * nhận trong màn hình tài khoản.
 */
export function useCloudSync(): void {
  const { state, api } = useStore();
  const stateRef = useRef(state);
  stateRef.current = state;
  const apiRef = useRef(api);
  apiRef.current = api;

  /* ---------- khôi phục phiên ---------- */
  useEffect(() => {
    if (!cloudEnabled) return;
    let cancelled = false;
    void (async () => {
      const session = await restoreSession();
      if (cancelled) return;
      if (!session) {
        /* Token hỏng hoặc đã hết hạn hẳn: hạ cờ tài khoản để UI không nói dối. */
        if (stateRef.current.account) apiRef.current.setAccount(null);
        return;
      }
      const existing = stateRef.current.account;
      apiRef.current.setAccount({
        id: session.userId,
        email: session.email,
        displayName: session.displayName || existing?.displayName || session.email.split("@")[0],
        syncedAt: existing?.syncedAt ?? 0,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------- chữ ký nội dung, không tính phần siêu dữ liệu tài khoản ---------- */
  const signature = useMemo(() => {
    const { account: _account, toasts: _toasts, ...rest } = state;
    try {
      return JSON.stringify(rest);
    } catch {
      return "";
    }
  }, [state]);

  const accountId = state.account?.id ?? "";

  /* ---------- tự đẩy lên máy chủ ---------- */
  useEffect(() => {
    if (!cloudEnabled || !accountId || !signature) return;
    const timer = window.setTimeout(() => {
      if (!currentSession()) return;
      void pushSave(serializeSave(stateRef.current))
        .then((updatedAt) => {
          const account = stateRef.current.account;
          if (account) apiRef.current.setAccount({ ...account, syncedAt: updatedAt });
        })
        .catch(() => {
          /* Mất mạng thì bỏ qua vòng này — lần thay đổi sau sẽ thử lại. */
        });
    }, PUSH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [signature, accountId]);
}
