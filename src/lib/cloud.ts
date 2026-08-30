/* ------------------------------------------------------------------ */
/*  Tài khoản và đồng bộ tiến độ                                        */
/*                                                                     */
/*  Viết bằng fetch thuần trên REST API của Supabase nên không thêm bất  */
/*  kỳ dependency nào. Khi chưa cấu hình biến môi trường, toàn bộ ứng    */
/*  dụng vẫn chạy bình thường ở chế độ lưu-trên-máy — giao diện nói rõ   */
/*  điều đó thay vì giả vờ đã đồng bộ.                                  */
/* ------------------------------------------------------------------ */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";
const SESSION_KEY = "vuong-session-v1";
const TABLE = "isle_saves";

/** Chỉ bật tính năng tài khoản khi cả URL lẫn publishable key đều có mặt. */
export const cloudEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

export type CloudErrorCode =
  | "not_configured"
  | "invalid_credentials"
  | "email_taken"
  | "weak_password"
  | "invalid_email"
  | "email_confirm_required"
  | "rate_limited"
  | "unauthorized"
  | "network"
  | "unknown";

export class CloudError extends Error {
  code: CloudErrorCode;
  constructor(code: CloudErrorCode, message?: string) {
    super(message ?? code);
    this.name = "CloudError";
    this.code = code;
  }
}

export interface CloudSession {
  userId: string;
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
  /** epoch ms */
  expiresAt: number;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id?: string; email?: string; user_metadata?: Record<string, unknown> };
  error?: string;
  error_description?: string;
  msg?: string;
  message?: string;
  code?: string;
}

/* --------------------------- lưu phiên cục bộ --------------------------- */

function readStoredSession(): CloudSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CloudSession>;
    if (!parsed.userId || !parsed.accessToken || !parsed.refreshToken) return null;
    return {
      userId: parsed.userId,
      email: parsed.email ?? "",
      displayName: parsed.displayName ?? "",
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: parsed.expiresAt ?? 0,
    };
  } catch {
    return null;
  }
}

function writeStoredSession(session: CloudSession | null): void {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* Chế độ riêng tư chặn ghi: phiên chỉ tồn tại trong tab hiện tại. */
  }
}

let session: CloudSession | null = cloudEnabled ? readStoredSession() : null;

export function currentSession(): CloudSession | null {
  return session;
}

/* ------------------------------ helpers ------------------------------ */

function mapAuthError(status: number, payload: TokenResponse): CloudError {
  const raw = `${payload.error_description ?? payload.msg ?? payload.message ?? payload.error ?? ""}`.toLowerCase();
  const code = `${payload.code ?? ""}`.toLowerCase();
  if (status === 429 || code.includes("over_") || raw.includes("rate limit")) return new CloudError("rate_limited", raw);
  if (raw.includes("already registered") || raw.includes("already been registered") || code === "user_already_exists") {
    return new CloudError("email_taken", raw);
  }
  if (raw.includes("password") && (raw.includes("least") || raw.includes("weak") || raw.includes("short"))) {
    return new CloudError("weak_password", raw);
  }
  if (raw.includes("invalid") && raw.includes("email")) return new CloudError("invalid_email", raw);
  if (raw.includes("email not confirmed") || raw.includes("confirm")) return new CloudError("email_confirm_required", raw);
  if (status === 400 || status === 401) return new CloudError("invalid_credentials", raw);
  return new CloudError("unknown", raw || `http_${status}`);
}

async function authRequest(path: string, body: unknown): Promise<TokenResponse> {
  if (!cloudEnabled) throw new CloudError("not_configured");
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
      body: JSON.stringify(body),
    });
  } catch {
    throw new CloudError("network");
  }
  const payload = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok) throw mapAuthError(response.status, payload);
  return payload;
}

function sessionFrom(payload: TokenResponse, fallbackEmail: string, fallbackName: string): CloudSession {
  const metadata = payload.user?.user_metadata ?? {};
  const displayName = typeof metadata.display_name === "string" && metadata.display_name ? metadata.display_name : fallbackName;
  return {
    userId: payload.user?.id ?? "",
    email: payload.user?.email ?? fallbackEmail,
    displayName,
    accessToken: payload.access_token ?? "",
    refreshToken: payload.refresh_token ?? "",
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  };
}

/** Làm mới access token khi sắp hết hạn; thất bại thì coi như đã đăng xuất. */
async function ensureFreshToken(): Promise<CloudSession> {
  if (!session) throw new CloudError("unauthorized");
  if (Date.now() < session.expiresAt - 60_000) return session;
  try {
    const payload = await authRequest("/token?grant_type=refresh_token", { refresh_token: session.refreshToken });
    session = sessionFrom(payload, session.email, session.displayName);
    writeStoredSession(session);
    return session;
  } catch (error) {
    if (error instanceof CloudError && error.code === "network") throw error;
    session = null;
    writeStoredSession(null);
    throw new CloudError("unauthorized");
  }
}

async function restRequest(path: string, init: RequestInit): Promise<Response> {
  const active = await ensureFreshToken();
  try {
    return await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${active.accessToken}`,
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new CloudError("network");
  }
}

/* ------------------------------- API ------------------------------- */

export async function signUp(email: string, password: string, displayName: string): Promise<CloudSession> {
  const payload = await authRequest("/signup", {
    email,
    password,
    data: { display_name: displayName },
  });
  /* Dự án bật xác thực email sẽ không trả access_token ngay. */
  if (!payload.access_token) throw new CloudError("email_confirm_required");
  session = sessionFrom(payload, email, displayName);
  writeStoredSession(session);
  return session;
}

export async function signIn(email: string, password: string): Promise<CloudSession> {
  const payload = await authRequest("/token?grant_type=password", { email, password });
  if (!payload.access_token) throw new CloudError("invalid_credentials");
  session = sessionFrom(payload, email, "");
  writeStoredSession(session);
  return session;
}

export async function signOut(): Promise<void> {
  const active = session;
  session = null;
  writeStoredSession(null);
  if (!active || !cloudEnabled) return;
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${active.accessToken}` },
    });
  } catch {
    /* Token cục bộ đã xoá rồi, lỗi mạng ở bước này không ảnh hưởng gì. */
  }
}

/** Khôi phục phiên lúc mở lại ứng dụng. Trả `null` nếu chưa từng đăng nhập. */
export async function restoreSession(): Promise<CloudSession | null> {
  if (!cloudEnabled || !session) return null;
  try {
    return await ensureFreshToken();
  } catch {
    return null;
  }
}

export interface RemoteSave<T> {
  payload: T;
  updatedAt: number;
}

export async function pullSave<T>(): Promise<RemoteSave<T> | null> {
  if (!cloudEnabled) throw new CloudError("not_configured");
  const active = await ensureFreshToken();
  const response = await restRequest(
    `/${TABLE}?user_id=eq.${encodeURIComponent(active.userId)}&select=payload,updated_at&limit=1`,
    { method: "GET" }
  );
  if (response.status === 401) throw new CloudError("unauthorized");
  if (!response.ok) throw new CloudError("unknown", `http_${response.status}`);
  const rows = (await response.json().catch(() => [])) as Array<{ payload: T; updated_at: string }>;
  const row = rows[0];
  if (!row) return null;
  return { payload: row.payload, updatedAt: Date.parse(row.updated_at) || Date.now() };
}

export async function pushSave<T>(payload: T): Promise<number> {
  if (!cloudEnabled) throw new CloudError("not_configured");
  const active = await ensureFreshToken();
  const updatedAt = new Date().toISOString();
  const response = await restRequest(`/${TABLE}?on_conflict=user_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ user_id: active.userId, payload, updated_at: updatedAt }]),
  });
  if (response.status === 401) throw new CloudError("unauthorized");
  if (!response.ok) throw new CloudError("unknown", `http_${response.status}`);
  return Date.parse(updatedAt);
}

/** Xoá toàn bộ dữ liệu tiến độ trên máy chủ — quyền được xoá của người dùng. */
export async function deleteRemoteSave(): Promise<void> {
  if (!cloudEnabled) throw new CloudError("not_configured");
  const active = await ensureFreshToken();
  const response = await restRequest(`/${TABLE}?user_id=eq.${encodeURIComponent(active.userId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  if (!response.ok && response.status !== 404) throw new CloudError("unknown", `http_${response.status}`);
}

/* ---------------------------- kiểm tra đầu vào ---------------------------- */

export function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export const MIN_PASSWORD = 8;

export function validatePassword(value: string): boolean {
  return value.length >= MIN_PASSWORD;
}
