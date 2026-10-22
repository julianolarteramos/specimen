export const THREAT = 40 * 60;
export const END = 3 * 3600;
export const BASAL = 0.12;
export const TAU = { nerve: 0.4, adrenalineUp: 1.5, adrenalineDown: 90, crh: 20, acth: 150, cortisol: 600 };
export const BRAKE = { crh: 0.9, acth: 0.7 };
export const BRAKING = 4 * 60;
export const DURATION = 30;
export const REST_BPM = 66;
export const PEAK_BPM = 118;

export const threat = (t) => (t >= 0 && t < THREAT ? 1 : 0);

const toward = (x, goal, dt, tau) => x + (goal - x) * (1 - Math.exp(-dt / tau));

export function step(s, t, dt) {
  const signal = threat(t);
  return {
    nerve: toward(s.nerve, signal, dt, TAU.nerve),
    adrenaline: toward(s.adrenaline, s.nerve, dt, s.nerve > s.adrenaline ? TAU.adrenalineUp : TAU.adrenalineDown),
    crh: toward(s.crh, Math.max(0, (BASAL + signal) * (1 - BRAKE.crh * s.cortisol)), dt, TAU.crh),
    acth: toward(s.acth, Math.max(0, s.crh * (1 - BRAKE.acth * s.cortisol)), dt, TAU.acth),
    cortisol: toward(s.cortisol, s.acth, dt, TAU.cortisol),
  };
}

export function rest() {
  let s = { nerve: 0, adrenaline: 0, crh: BASAL, acth: BASAL, cortisol: BASAL };
  for (let i = 0; i < 40000; i++) s = step(s, -1, 1);
  return s;
}

export function table(samples = 260) {
  const times = [0];
  for (let i = 0; i < samples; i++) times.push(0.05 * Math.pow(END / 0.05, i / (samples - 1)));
  const rows = [];
  let s = rest();
  let t = 0;
  for (const goal of times) {
    while (t < goal - 1e-9) {
      const dt = Math.min(goal - t, t < 30 ? 0.005 : t < 600 ? 0.1 : 1);
      s = step(s, t, dt);
      t += dt;
    }
    rows.push([goal, s.nerve, s.adrenaline, s.crh, s.acth, s.cortisol].map((v) => Math.round(v * 10000) / 10000));
  }
  return rows;
}

export function modelTime(r) {
  if (r <= 0) return 0;
  if (r < 7) return (10 * r) / 7;
  if (r < 21) return 10 * Math.pow((45 * 60) / 10, (r - 7) / 14);
  if (r < DURATION) return 45 * 60 * Math.pow(END / (45 * 60), (r - 21) / 9);
  return END;
}

export function read(rows, t) {
  if (t <= rows[0][0]) return rows[0];
  let lo = 0;
  let hi = rows.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (rows[mid][0] <= t) lo = mid;
    else hi = mid;
  }
  const a = rows[lo];
  const b = rows[hi];
  const u = Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0] || 1)));
  return a.map((v, i) => v + (b[i] - v) * u);
}

export function clockText(t) {
  if (t < 60) return `${t < 10 ? t.toFixed(1) : Math.round(t)} s`;
  const min = Math.floor(t / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

export function phaseOf(t, row) {
  const [, , , , acth, cortisol] = row;
  if (t < 0.6) return "perceive";
  if (t < 4) return "nerve";
  if (t < 25) return "adrenaline";
  if (t < THREAT && t < BRAKING) return acth < 0.4 ? "crh" : "acth";
  if (t < THREAT) return "brake";
  if (cortisol > 0.2) return "falling";
  return "rest";
}

export const bpmOf = (adrenaline) => REST_BPM + (PEAK_BPM - REST_BPM) * adrenaline;
