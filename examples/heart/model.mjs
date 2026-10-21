export const REST_BPM = 72;
export const LIMITS = [48, 150];
export const SQUEEZE = 0.014;

export const cycleOf = (bpm) => 60 / bpm;

export function systoleOf(bpm) {
  const cycle = cycleOf(bpm);
  return Math.min(0.45 * cycle, 0.2 + 0.1 * cycle);
}

const bump = (x) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x) ** 2);

export function beatAt(time, bpm = REST_BPM) {
  const cycle = cycleOf(bpm);
  const t = ((time % cycle) + cycle) % cycle;
  const systole = systoleOf(bpm);
  const atrial = 0.12 * cycle;
  const ventricle = bump(t / systole);
  const kick = 0.22 * bump((t - (cycle - atrial)) / atrial);
  return { scale: 1 - SQUEEZE * (ventricle + kick), phase: t < systole ? "systole" : "diastole", share: t / cycle };
}
