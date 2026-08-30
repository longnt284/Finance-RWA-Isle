import { useState } from "react";
import { useStore, DISTRICTS } from "../state/store";
import type { DistrictId } from "../state/store";
import { sound } from "../lib/audio";
import { IconCrypto, IconStocks, IconVault, IconAcademy, IconChevron } from "./icons";

const FOCUS: { id: DistrictId; icon: (p: { className?: string }) => JSX.Element; desc: string }[] = [
  { id: "crypto", icon: IconCrypto, desc: "DCA · trade · on-chain" },
  { id: "stocks", icon: IconStocks, desc: "Cổ phiếu · quỹ · cổ tức" },
  { id: "vault", icon: IconVault, desc: "Tiết kiệm · quỹ khẩn cấp" },
  { id: "academy", icon: IconAcademy, desc: "Học tập · nghiên cứu" },
];

export default function Onboarding() {
  const { api } = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("Đảo Vượng");

  return (
    <div className="anim-fade-in absolute inset-0 z-50 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(4,20,27,0.55)_0%,rgba(3,13,19,0.92)_100%)] p-4">
      <div className="panel w-full max-w-md rounded-xl p-7">
        {/* step dots */}
        <div className="mb-5 flex items-center gap-1.5">
          {[0, 1].map((i) => (
            <span key={i} className={`h-1 rounded-full transition-all duration-300 ${i === step ? "w-8 bg-gold-400" : "w-3 bg-mist-500/30"}`} />
          ))}
          <span className="ml-auto font-mono text-[10px] tracking-widest text-mist-500">0{step + 1} / 02</span>
        </div>

        {step === 0 ? (
          <div className="anim-fade-up">
            <div className="font-display text-[10px] tracking-[0.3em] text-gold-400">KHAI MỞ</div>
            <h1 className="mt-2 font-display text-2xl font-semibold leading-snug text-mist-100">
              Đặt tên cho nền<br />văn minh của bạn
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-mist-400">
              Một hòn đảo giữa biển sương. Mỗi nhiệm vụ tài chính bạn hoàn thành sẽ bồi đắp
              thành phố này — mục tiêu thành công trình, kỷ luật thành cấp độ.
            </p>
            <input
              className="field mt-5 w-full rounded-md px-3.5 py-2.5 font-display text-sm text-gold-300"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
            />
            <button
              className="btn-gold mt-4 flex w-full items-center justify-center gap-2 rounded-md py-3 font-display text-[12px] tracking-[0.14em]"
              onClick={() => {
                sound.tick();
                setStep(1);
              }}
            >
              TIẾP TỤC <IconChevron className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="anim-fade-up">
            <div className="font-display text-[10px] tracking-[0.3em] text-gold-400">TRỌNG TÂM</div>
            <h1 className="mt-2 font-display text-2xl font-semibold leading-snug text-mist-100">
              Bạn đang xây đắp<br />điều gì lúc này?
            </h1>
            <p className="mt-2 text-[13px] text-mist-400">Công trình đầu tiên sẽ mọc lên ở quận bạn chọn.</p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {FOCUS.map((f) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      sound.chime();
                      api.completeOnboarding(name, f.id, false);
                    }}
                    className="group rounded-lg border border-mist-500/20 bg-ink-850/70 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-gold-500/50 hover:bg-gold-500/8 hover:shadow-[0_10px_30px_rgba(224,170,80,0.12)]"
                  >
                    <Icon className="h-5 w-5 text-gold-400 transition-transform duration-200 group-hover:scale-110" />
                    <div className="mt-2.5 font-display text-[11px] tracking-wide text-mist-100">{DISTRICTS[f.id].building}</div>
                    <div className="mt-1 text-[10px] text-mist-500">{f.desc}</div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                className="btn-ghost flex-1 rounded-md py-2.5 font-display text-[10px] tracking-[0.14em]"
                onClick={() => {
                  sound.levelUp();
                  api.completeOnboarding(name, "crypto", true);
                }}
              >
                KHÁM PHÁ VỚI DỮ LIỆU MẪU
              </button>
              <button className="text-[11px] text-mist-500 transition-colors hover:text-mist-300" onClick={() => setStep(0)}>
                Quay lại
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
