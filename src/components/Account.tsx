import { useEffect, useState } from "react";
import { useStore, normalizeSave, serializeSave } from "../state/store";
import { makeT } from "../lib/i18n";
import { timeAgo } from "../lib/format";
import { sound } from "../lib/audio";
import {
  cloudEnabled, signIn, signUp, signOut, pushSave, pullSave, deleteRemoteSave,
  validateEmail, validatePassword, MIN_PASSWORD, CloudError,
} from "../lib/cloud";
import type { State } from "../state/store";
import { IconUser, IconShield, IconCloud, IconClose, IconCheck, IconArrowR, IconTrash } from "./icons";

type Mode = "signin" | "signup";
type Busy = null | "auth" | "push" | "pull" | "delete";

function errorKey(error: unknown): string {
  return error instanceof CloudError ? `ac.err.${error.code}` : "ac.err.unknown";
}

/* ------------------------------------------------------------------ */
/*  Cam kết riêng tư — hiển thị ngay trong màn hình, không giấu sau link */
/* ------------------------------------------------------------------ */

export function PrivacyPanel({ compact }: { compact?: boolean }) {
  const { state } = useStore();
  const t = makeT(state.lang);
  const points = ["p1", "p2", "p3", "p4", "p5"];
  return (
    <section className="rounded-xl border border-jade-500/25 bg-jade-500/[0.045] p-4">
      <div className="flex items-center gap-2">
        <IconShield className="h-4 w-4 shrink-0 text-jade-400" />
        <h3 className="font-display text-[11px] font-semibold tracking-[0.14em] text-jade-300">{t("pv.title")}</h3>
      </div>
      {!compact && <p className="mt-1.5 text-[11.5px] leading-relaxed text-mist-400">{t("pv.sub")}</p>}
      <ol className="mt-3 space-y-2.5">
        {points.map((point, index) => (
          <li key={point} className="flex gap-2.5">
            <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-jade-500/20 font-mono text-[9px] text-jade-300">
              {index + 1}
            </span>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-mist-100">{t(`pv.${point}.t`)}</div>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-mist-400">{t(`pv.${point}.b`)}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 border-t border-jade-500/15 pt-2.5 text-[10.5px] italic leading-relaxed text-mist-500">{t("pv.note")}</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export default function AccountPanel({ onClose }: { onClose: () => void }) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const account = state.account;
  const canSubmit =
    validateEmail(email) && validatePassword(password) && (mode === "signin" || displayName.trim().length > 0);

  async function submit() {
    if (!canSubmit || busy) return;
    setBusy("auth");
    setError(null);
    setNotice(null);
    try {
      const session =
        mode === "signup"
          ? await signUp(email.trim(), password, displayName.trim())
          : await signIn(email.trim(), password);
      api.setAccount({
        id: session.userId,
        email: session.email,
        displayName: session.displayName || displayName.trim() || session.email.split("@")[0],
        syncedAt: 0,
      });
      /* Đăng ký mới thì đẩy tiến độ đang có lên; đăng nhập lại thì ưu tiên bản
         trên máy chủ nếu nó tồn tại, vì đó là bản người dùng mong đợi thấy. */
      if (mode === "signup") {
        const at = await pushSave(serializeSave(state));
        api.setAccount({ id: session.userId, email: session.email, displayName: session.displayName || displayName.trim(), syncedAt: at });
      } else {
        const remote = await pullSave<Partial<State>>();
        if (remote) {
          const restored = normalizeSave(remote.payload, false);
          if (restored) {
            api.hydrate({
              ...restored,
              account: { id: session.userId, email: session.email, displayName: session.displayName || restored.account?.displayName || "", syncedAt: remote.updatedAt },
            });
          }
        }
      }
      setPassword("");
      sound.chime();
      setNotice(mode === "signup" ? "ac.pushed" : "ac.pulled");
    } catch (caught) {
      setError(errorKey(caught));
    } finally {
      setBusy(null);
    }
  }

  async function doPush() {
    setBusy("push");
    setError(null);
    setNotice(null);
    try {
      const at = await pushSave(serializeSave(state));
      if (account) api.setAccount({ ...account, syncedAt: at });
      setNotice("ac.pushed");
      sound.coin();
    } catch (caught) {
      setError(errorKey(caught));
    } finally {
      setBusy(null);
    }
  }

  async function doPull() {
    if (!window.confirm(t("ac.pullQ"))) return;
    setBusy("pull");
    setError(null);
    setNotice(null);
    try {
      const remote = await pullSave<Partial<State>>();
      if (!remote) {
        setNotice("ac.pullEmpty");
        return;
      }
      const restored = normalizeSave(remote.payload, false);
      if (!restored) {
        setError("ac.err.unknown");
        return;
      }
      api.hydrate({ ...restored, account: account ? { ...account, syncedAt: remote.updatedAt } : restored.account });
      setNotice("ac.pulled");
      sound.chime();
    } catch (caught) {
      setError(errorKey(caught));
    } finally {
      setBusy(null);
    }
  }

  async function doDelete() {
    if (!window.confirm(t("ac.deleteQ"))) return;
    setBusy("delete");
    setError(null);
    setNotice(null);
    try {
      await deleteRemoteSave();
      if (account) api.setAccount({ ...account, syncedAt: 0 });
      setNotice("ac.deleted");
    } catch (caught) {
      setError(errorKey(caught));
    } finally {
      setBusy(null);
    }
  }

  async function doSignOut() {
    await signOut();
    api.setAccount(null);
    setNotice(null);
    setError(null);
    sound.tick();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("ac.title")}
      className="anim-slide-left panel absolute inset-y-0 right-0 z-40 flex w-full flex-col sm:inset-y-auto sm:bottom-10 sm:top-[88px] sm:w-[420px] sm:rounded-l-2xl sm:border-l"
    >
      <div className="flex items-center justify-between border-b border-mist-500/10 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="text-gold-400"><IconUser className="h-[18px] w-[18px]" /></span>
          <h2 className="font-display text-sm font-semibold tracking-wide text-mist-100">{t("ac.title")}</h2>
        </div>
        <button onClick={onClose} aria-label={t("misc.close")} className="rounded-md p-1.5 text-mist-500 transition-colors hover:bg-ink-700 hover:text-mist-100">
          <IconClose className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {!cloudEnabled && (
          <div className="rounded-xl border border-gold-500/25 bg-gold-500/[0.06] p-4">
            <div className="font-display text-[11px] font-semibold tracking-[0.14em] text-gold-300">{t("ac.localOnly")}</div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-mist-400">{t("ac.localOnlyNote")}</p>
          </div>
        )}

        {account ? (
          /* ------------------------- đã đăng nhập ------------------------- */
          <>
            <section className="rounded-xl border border-jade-500/30 bg-jade-500/[0.06] p-4">
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-mist-500">{t("ac.signedInAs")}</div>
              <div className="mt-1 truncate font-display text-[15px] font-semibold text-mist-100">{account.displayName || account.email}</div>
              <div className="truncate font-mono text-[11px] text-mist-500">{account.email}</div>
              <div className="mt-2.5 flex items-center gap-1.5 font-mono text-[10px] text-jade-300">
                <IconCloud className="h-3.5 w-3.5" />
                {account.syncedAt ? t("ac.synced", { t: timeAgo(account.syncedAt) }) : t("ac.neverSynced")}
              </div>
              <p className="mt-1.5 text-[10.5px] text-mist-500">{t("ac.autoSync")}</p>
            </section>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={doPush} disabled={busy !== null} className="btn-gold rounded-xl py-2.5 font-display text-[10px] tracking-wider disabled:opacity-50">
                {busy === "push" ? t("ac.syncing") : t("ac.push")}
              </button>
              <button onClick={doPull} disabled={busy !== null} className="btn-ghost rounded-xl py-2.5 font-display text-[10px] tracking-wider disabled:opacity-50">
                {busy === "pull" ? t("ac.syncing") : t("ac.pull")}
              </button>
            </div>

            <button onClick={doSignOut} disabled={busy !== null} className="btn-ghost w-full rounded-xl py-2.5 font-display text-[10px] tracking-wider disabled:opacity-50">
              {t("ac.signOut")}
            </button>

            <button
              onClick={doDelete}
              disabled={busy !== null}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-coral-500/30 py-2.5 text-[11px] text-coral-400 transition-colors hover:bg-coral-500/10 disabled:opacity-50"
            >
              <IconTrash className="h-3.5 w-3.5" />
              {busy === "delete" ? t("misc.loading") : t("ac.deleteData")}
            </button>
          </>
        ) : (
          /* ------------------------- chưa đăng nhập ------------------------- */
          <>
            <section className="rounded-xl border hairline-gold bg-ink-850/60 p-4">
              <div className="font-display text-[11px] font-semibold tracking-[0.14em] text-mist-100">{t("ac.guest")}</div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-mist-400">{t("ac.guestSub")}</p>
            </section>

            <PrivacyPanel />

            {!state.privacyAccepted ? (
              <button
                onClick={() => {
                  api.acceptPrivacy();
                  sound.tick();
                }}
                disabled={!cloudEnabled}
                className="btn-gold flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-[11px] tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <IconCheck className="h-4 w-4" />
                {t("pv.accept")}
              </button>
            ) : (
              <>
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-jade-400">
                  <IconCheck className="h-3.5 w-3.5" />
                  {t("pv.accepted")}
                </div>

                <div className="chip flex items-center rounded-lg p-0.5">
                  {(["signin", "signup"] as Mode[]).map((candidate) => (
                    <button
                      key={candidate}
                      onClick={() => {
                        setMode(candidate);
                        setError(null);
                        setNotice(null);
                      }}
                      className={`flex-1 rounded-md px-3 py-2 font-display text-[10px] tracking-wider transition-all ${
                        mode === candidate ? "bg-gold-500/90 text-ink-950" : "text-mist-400 hover:text-mist-100"
                      }`}
                    >
                      {candidate === "signin" ? t("ac.signIn") : t("ac.signUp")}
                    </button>
                  ))}
                </div>

                <div className="space-y-2.5">
                  {mode === "signup" && (
                    <label className="block">
                      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-mist-500">{t("ac.name")}</span>
                      <input
                        className="field w-full rounded-lg px-3 py-2.5 text-[13px] text-mist-100"
                        placeholder={t("ac.namePh")}
                        value={displayName}
                        autoComplete="nickname"
                        onChange={(event) => setDisplayName(event.target.value)}
                      />
                    </label>
                  )}
                  <label className="block">
                    <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-mist-500">{t("ac.email")}</span>
                    <input
                      className="field w-full rounded-lg px-3 py-2.5 text-[13px] text-mist-100"
                      placeholder={t("ac.emailPh")}
                      value={email}
                      type="email"
                      autoComplete="email"
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-mist-500">{t("ac.password")}</span>
                    <input
                      className="field w-full rounded-lg px-3 py-2.5 text-[13px] text-mist-100"
                      placeholder={t("ac.passwordPh", { n: MIN_PASSWORD })}
                      value={password}
                      type="password"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      onChange={(event) => setPassword(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void submit();
                      }}
                    />
                  </label>
                </div>

                <button
                  onClick={() => void submit()}
                  disabled={!canSubmit || busy !== null || !cloudEnabled}
                  className="btn-gold flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-[11px] tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy === "auth" ? t("misc.loading") : mode === "signup" ? t("ac.signUp") : t("ac.signIn")}
                  {busy !== "auth" && <IconArrowR className="h-4 w-4" />}
                </button>

                <button
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                  className="w-full text-[11px] text-mist-500 underline-offset-4 transition-colors hover:text-mist-300 hover:underline"
                >
                  {mode === "signin" ? t("ac.toSignUp") : t("ac.toSignIn")}
                </button>
              </>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-coral-500/35 bg-coral-500/8 px-3 py-2.5 text-[11.5px] leading-relaxed text-coral-400">
            {t(error)}
          </p>
        )}
        {notice && !error && (
          <p role="status" className="rounded-lg border border-jade-500/35 bg-jade-500/8 px-3 py-2.5 text-[11.5px] leading-relaxed text-jade-300">
            {t(notice)}
          </p>
        )}

        {account && <PrivacyPanel compact />}
      </div>
    </div>
  );
}
