import { useEffect, useMemo, useState } from "react";
import { useStore, pendingExamLevel, dBuilding, MAX_LEVEL } from "../state/store";
import type { DistrictId } from "../state/store";
import { makeT } from "../lib/i18n";
import { buildExam, tiersForLevel, EXAM_SIZE, EXAM_PASS } from "../lib/quiz";
import type { Exam } from "../lib/quiz";
import { sound } from "../lib/audio";
import { IconBrain, IconCheck, IconClose, IconArrowR, IconScroll } from "./icons";

type Stage = "intro" | "quiz" | "result";

interface Props {
  district: DistrictId;
  onClose: () => void;
  onPassed: (district: DistrictId) => void;
}

const OPTION_KEYS = ["A", "B", "C", "D"];

export default function ExamModal({ district, onClose, onPassed }: Props) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  /* Chốt cấp đang thi lúc mở đề. Nếu đọc trực tiếp từ store, ngay khi thi đậu
     `certified` tăng lên khiến `pendingExamLevel` trả null và cả hộp thoại biến
     mất trước khi người chơi kịp thấy màn hình "Đạt". */
  const [target] = useState<number | null>(() => pendingExamLevel(state, district));
  const [stage, setStage] = useState<Stage>("intro");
  /* Chốt số lần thi lúc mở đề: nộp bài xong `examAttempts` tăng, nếu đọc trực
     tiếp từ store thì đề sẽ bị dựng lại ngay giữa màn hình kết quả. */
  const [attempt, setAttempt] = useState(() => state.examAttempts[district]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => Array(EXAM_SIZE).fill(null));
  const [submitted, setSubmitted] = useState(false);

  const exam: Exam = useMemo(
    () => buildExam(district, target ?? 1, attempt),
    [district, target, attempt]
  );

  const correctCount = useMemo(
    () => exam.questions.reduce((sum, item, i) => sum + (answers[i] === item.question.answer ? 1 : 0), 0),
    [exam, answers]
  );
  const passed = correctCount >= EXAM_PASS;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  /* Ghi kết quả đúng một lần, ngay khi chuyển sang màn hình tổng kết. */
  useEffect(() => {
    if (stage !== "result" || submitted || target === null) return;
    setSubmitted(true);
    api.submitExam(district, passed);
    if (passed) {
      sound.levelUp();
      onPassed(district);
    } else {
      sound.tick();
    }
  }, [stage, submitted, passed, target, district, api, onPassed]);

  if (target === null) return null;

  const building = dBuilding(t, district);
  const tiers = tiersForLevel(target);
  const tierLabel = tiers.map((tier) => t(`exam.tier${tier}`)).join(" · ");
  const current = exam.questions[index];
  const answered = answers[index] !== null;

  function choose(optionIndex: number) {
    if (stage !== "quiz") return;
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = optionIndex;
      return next;
    });
    sound.tick();
  }

  function advance() {
    if (index + 1 < exam.questions.length) {
      setIndex(index + 1);
      sound.tick();
    } else {
      setStage("result");
    }
  }

  function retry() {
    setAttempt(state.examAttempts[district] + 1);
    setAnswers(Array(EXAM_SIZE).fill(null));
    setIndex(0);
    setSubmitted(false);
    setStage("quiz");
    sound.whoosh();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("exam.title")}
      className="absolute inset-0 z-[60] flex items-center justify-center bg-ink-950/85 p-4 backdrop-blur-sm"
    >
      <div className="anim-pop panel flex max-h-[92vh] w-full max-w-[620px] flex-col rounded-2xl">
        {/* ------------------------------ header ------------------------------ */}
        <div className="flex items-start justify-between gap-3 border-b border-mist-500/12 p-5 pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <IconBrain className="h-4 w-4 shrink-0 text-gold-400" />
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-gold-400">{t("exam.title")}</span>
            </div>
            <h2 className="mt-1.5 truncate font-display text-lg font-bold text-mist-100">
              {t("exam.sub", { b: building, n: target })}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[9.5px] text-mist-500">
              <span className="chip rounded-full px-2 py-0.5">{tierLabel}</span>
              {attempt > 0 && <span className="chip rounded-full px-2 py-0.5">{t("exam.attempt", { n: attempt + 1 })}</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("misc.close")}
            className="shrink-0 rounded-md p-1.5 text-mist-500 transition-colors hover:bg-ink-700 hover:text-mist-100"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        {/* ------------------------------ intro ------------------------------ */}
        {stage === "intro" && (
          <div className="space-y-5 p-6">
            <p className="text-[13px] leading-relaxed text-mist-300">
              {t("exam.intro", { pass: EXAM_PASS, total: EXAM_SIZE })}
            </p>
            <div className="rounded-xl border border-gold-500/20 bg-ink-850/60 p-4">
              <div className="flex items-center gap-2 font-display text-[10px] tracking-[0.2em] text-mist-400">
                <IconScroll className="h-3.5 w-3.5 text-gold-400" />
                {t("ws.lvl", { n: state.certified[district] })} → {t("ws.lvl", { n: target })}
              </div>
              <div className="mt-2.5 flex items-center gap-1.5">
                {Array.from({ length: MAX_LEVEL }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${
                      i < state.certified[district] ? "bg-gold-400" : i === target - 1 ? "bg-gold-400/35 anim-breathe" : "bg-ink-700"
                    }`}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                setStage("quiz");
                sound.chime();
              }}
              className="btn-gold flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display text-[11px] tracking-[0.16em]"
            >
              {t("exam.start")} <IconArrowR className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ------------------------------ quiz ------------------------------ */}
        {stage === "quiz" && current && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-3 px-6 pt-4">
              <span className="font-mono text-[10px] text-mist-500">
                {t("exam.progress", { i: index + 1, n: exam.questions.length })}
              </span>
              <div className="flex flex-1 items-center gap-1">
                {exam.questions.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                      i < index ? "bg-gold-500/70" : i === index ? "bg-gold-400" : "bg-ink-700"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div key={index} className="anim-fade-up min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <p className="text-[14.5px] font-medium leading-relaxed text-mist-100">
                {current.question.q[state.lang]}
              </p>
              <div className="mt-4 space-y-2">
                {current.order.map((optionIndex, position) => {
                  const chosen = answers[index] === optionIndex;
                  return (
                    <button
                      key={optionIndex}
                      data-exam-option={position}
                      onClick={() => choose(optionIndex)}
                      className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-all duration-150 ${
                        chosen
                          ? "border-gold-500/65 bg-gold-500/12 text-mist-100 shadow-[0_0_20px_rgba(224,170,80,0.12)]"
                          : "hairline-gold bg-ink-850/55 text-mist-300 hover:border-gold-500/40 hover:bg-ink-850"
                      }`}
                    >
                      <span
                        className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md border font-mono text-[10px] ${
                          chosen ? "border-gold-400 bg-gold-400 text-ink-950" : "border-mist-500/40 text-mist-500"
                        }`}
                      >
                        {OPTION_KEYS[position]}
                      </span>
                      <span className="text-[13px] leading-relaxed">{current.question.options[optionIndex][state.lang]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-mist-500/12 px-6 py-4">
              <span className="font-mono text-[10px] text-mist-500">
                {t("exam.score", { c: answers.filter((a) => a !== null).length, n: exam.questions.length })}
              </span>
              <button
                onClick={advance}
                disabled={!answered}
                className="btn-gold flex items-center gap-2 rounded-xl px-5 py-2.5 font-display text-[10px] tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {index + 1 < exam.questions.length ? t("exam.next") : t("exam.finish")}
                <IconArrowR className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------ result ------------------------------ */}
        {stage === "result" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className={`mx-6 mt-5 rounded-xl border p-4 ${passed ? "border-jade-500/45 bg-jade-500/8" : "border-coral-500/40 bg-coral-500/6"}`}>
              <div className={`flex items-center gap-2 font-display text-[13px] font-bold ${passed ? "text-jade-300" : "text-coral-400"}`}>
                {passed ? <IconCheck className="h-4 w-4" /> : <IconClose className="h-4 w-4" />}
                {passed ? t("exam.pass", { n: target }) : t("exam.fail")}
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-mist-400">
                {passed
                  ? t("exam.passSub", { b: building, n: target })
                  : t("exam.failSub", { c: correctCount, n: exam.questions.length, pass: EXAM_PASS })}
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
              <h3 className="font-display text-[10px] tracking-[0.22em] text-mist-400">{t("exam.review")}</h3>
              {exam.questions.map((item, i) => {
                const chosen = answers[i];
                const right = chosen === item.question.answer;
                return (
                  <div key={item.question.id} className={`rounded-xl border p-3.5 ${right ? "border-jade-500/30 bg-jade-500/5" : "border-coral-500/30 bg-coral-500/4"}`}>
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 shrink-0 font-mono text-[10px] ${right ? "text-jade-400" : "text-coral-400"}`}>
                        {right ? "✓" : "✕"}
                      </span>
                      <p className="text-[12.5px] font-medium leading-snug text-mist-100">{item.question.q[state.lang]}</p>
                    </div>
                    {!right && chosen !== null && (
                      <div className="mt-2 text-[11px] text-coral-400/90">
                        {t("exam.yourAnswer")}: {item.question.options[chosen][state.lang]}
                      </div>
                    )}
                    <div className="mt-1.5 text-[11.5px] text-jade-300/90">
                      {t("exam.correct")}: {item.question.options[item.question.answer][state.lang]}
                    </div>
                    <div className="mt-2 border-t border-mist-500/12 pt-2 text-[11.5px] leading-relaxed text-mist-400">
                      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-mist-500">{t("exam.why")} · </span>
                      {item.question.why[state.lang]}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-mist-500/12 px-6 py-4">
              <span className="font-mono text-[11px] text-gold-300">
                {t("exam.score", { c: correctCount, n: exam.questions.length })}
              </span>
              {passed ? (
                <button onClick={onClose} className="btn-gold rounded-xl px-5 py-2.5 font-display text-[10px] tracking-[0.14em]">
                  {t("misc.close")}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={onClose} className="btn-ghost rounded-xl px-4 py-2.5 font-display text-[10px] tracking-wider">
                    {t("misc.close")}
                  </button>
                  <button onClick={retry} className="btn-gold rounded-xl px-5 py-2.5 font-display text-[10px] tracking-[0.14em]">
                    {t("exam.retry")}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
