let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = localStorage.getItem("vuong-muted") === "1";

function ensure(): boolean {
  if (typeof window === "undefined") return false;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.14;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return true;
}

function tone(freq: number, dur: number, type: OscillatorType, when = 0, vol = 1, glideTo?: number) {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sound = {
  isMuted: () => muted,
  toggleMute(): boolean {
    muted = !muted;
    localStorage.setItem("vuong-muted", muted ? "1" : "0");
    return muted;
  },
  /** small UI tick */
  tick() {
    if (muted || !ensure()) return;
    tone(1400, 0.06, "triangle", 0, 0.5);
  },
  /** task complete */
  chime() {
    if (muted || !ensure()) return;
    tone(880, 0.14, "sine", 0, 0.8);
    tone(1318.5, 0.22, "sine", 0.07, 0.7);
  },
  /** coin / trade */
  coin() {
    if (muted || !ensure()) return;
    tone(1975, 0.07, "square", 0, 0.28);
    tone(2637, 0.1, "square", 0.05, 0.24);
  },
  /** level up arpeggio */
  levelUp() {
    if (muted || !ensure()) return;
    const seq = [523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => tone(f, 0.22, "triangle", i * 0.09, 0.7));
    tone(1568, 0.5, "sine", 0.38, 0.5);
  },
  /** soft whoosh for camera travel */
  whoosh() {
    if (muted || !ensure()) return;
    tone(220, 0.5, "sine", 0, 0.25, 660);
  },
};
