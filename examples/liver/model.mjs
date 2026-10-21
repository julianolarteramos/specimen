import * as G from "../../kit/lathe.mjs";
import * as B from "../../kit/blob.mjs";
import { frame, along, cutVessel, onSurface, spline } from "../shared/specimen.mjs";

// Liver frame: l runs to the patient's left, a to the front, s up. The right lobe sits at negative l.
export const { lift, dir } = frame(45);
export const LIFT = 100;
// The liver's mass sits over the plinth: its local origin is moved 22 units to the patient's left.
export const SHIFT = 22;
const raise = lift(LIFT);
export const W = ([l, a, s]) => raise([l + SHIFT, a, s]);
const AXES = [dir([1, 0, 0]), dir([0, 1, 0])];
const liver = { mat: "liver" };
const blob = (c, r) => B.ellipsoid(W(c), r, { axes: AXES, ...liver });

// The right lobe is a thick rounded mass; the dome carries the diaphragmatic surface over to the left lobe, which
// thins and tapers to a point on the patient's left.
const RIGHT = blob([-48, -4, -12], [54, 56, 60]);
const DOME = blob([-14, -10, 12], [58, 46, 34]);
const LEFT = [
  [18, -6, 17, 26, 25, 13],
  [42, -6, 21, 22, 19, 7.5],
  [62, -4, 23, 16, 13, 4.5],
  [80, -2, 24, 8, 7, 2.2],
].map(([l, a, s, rl, ra, rs]) => blob([l, a, s], [rl, ra, rs]));
const CAUDATE = blob([-8, -36, -8], [12, 10, 16]);
const BODY = B.blend(22, RIGHT, DOME, ...LEFT, CAUDATE);

// The inferior border is the sharp edge where the anterior surface meets the visceral surface. It runs from low on the
// right up to the tip of the left lobe; both planes hold that line.
const BORDER = G.unit3([1, -0.06, 0.34]);
const across = (a, s) => {
  const n = [0, a, s];
  n[0] = -(n[1] * BORDER[1] + n[2] * BORDER[2]) / BORDER[0];
  return G.unit3(n);
};
const BORDER_AT = [-10, 26, -30];
const ANTERIOR = B.halfspace(W(BORDER_AT), dir(across(0.68, -0.73)));
const VISCERAL = B.halfspace(W(BORDER_AT), dir(across(-0.36, -0.93)));
const SHAPED = B.intersect(2.5, B.intersect(16, BODY, ANTERIOR), VISCERAL);
export const BASE = B.field(SHAPED);

// Walks out of a field from an inside point along a direction (local frame) and returns the surface point and normal.
export function surface(F, from, toward) {
  const d = G.unit3(dir(toward));
  const start = W(from);
  let t = 0;
  while (F.value(G.add3(start, G.mul3(d, t))) < 0 && t < 300) t += 0.25;
  return onSurface(F, G.add3(start, G.mul3(d, t)));
}

// The falciform ligament: a low fold of peritoneum from the top of the liver down its front to the notch in the
// inferior border, between the right lobe and the left lobe.
export const FALCIFORM_L = 22;
const HUB = [FALCIFORM_L, -10, 14];
const NOTCH_AT = surface(BASE, [FALCIFORM_L, 20, -14], [0, 1, -0.55]).p;
const NOTCH = B.capsule(G.add3(NOTCH_AT, dir([0, 6, -2])), G.add3(NOTCH_AT, dir([0, -8, 2])), 3.6, 1.6);
const NOTCHED = B.carve(SHAPED, NOTCH, 2.2);
const NOTCHED_F = B.field(NOTCHED);
const fold = Array.from({ length: 22 }, (_, i) => {
  const th = ((80 - (i / 21) * 112) * Math.PI) / 180;
  const { p, n } = surface(NOTCHED_F, [HUB[0] + i * 0.05, HUB[1], HUB[2]], [0, Math.cos(th), Math.sin(th)]);
  return G.add3(p, G.mul3(n, 0.2));
});
const FALCIFORM = B.vessel(spline(fold, 1.5), (t) => 0.8 + 0.35 * Math.sin(Math.PI * Math.min(1, t * 1.1)), { mat: "ligament" });
// The round ligament (ligamentum teres) runs in the free edge of the fold, through the notch and back under the liver.
const lastFold = fold[fold.length - 1];
const teresPath = [lastFold, G.add3(NOTCH_AT, dir([0, 1.5, 0.6])), G.add3(NOTCH_AT, dir([0, -5, 0.4])), G.add3(NOTCH_AT, dir([0.5, -14, 3.2]))];
const TERES = B.vessel(spline(teresPath, 1.5), (t) => 1.6 - 0.4 * t, { mat: "ligament" });

// The gallbladder lies in its fossa under the right lobe; the fundus shows just past the inferior border.
const GB_FUNDUS = [-22, 32, -39];
const GB_NECK = [-8, -4, -6];
const gbAxes = along(dir, GB_NECK, GB_FUNDUS, [1, 0, 0]);
const GALL = B.blend(
  4,
  B.ellipsoid(W(G.mul3(G.add3(GB_FUNDUS, GB_NECK), 0.5)), [G.len3(G.sub3(GB_FUNDUS, GB_NECK)) * 0.52, 8.5, 8], { axes: gbAxes, mat: "bile" }),
  B.capsule(W(GB_NECK), W([-5, -9, -8]), 4.6, 3, { mat: "bile" }),
);

// The porta hepatis: the common bile duct in front on the right, the hepatic artery in front on the left, the portal
// vein behind them. All three leave downward in the free edge of the lesser omentum.
const PORTA = [-2, -10, -10];
const down = (from, to) => [from, G.mul3(G.add3(from, to), 0.5), to];
const DUCT = cutVessel(down([-9, -6, -6], [-11, -3, -32]).map(W), 3, 2.8, "bile");
const ARTERY = cutVessel(down([5, -8, -6], [7, -8, -27]).map(W), 2.4, 2.2, "oxy");
const PORTAL = cutVessel(down([-2, -16, -4], [-1, -14, -34]).map(W), 6.4, 6, "portal");
const CYSTIC = B.vessel(spline([[-5, -9, -8], [-8, -8, -14], [-10, -5, -18]].map(W), 1), 1.4, { mat: "bile" });

// The inferior vena cava climbs the back of the liver in its groove, cut short above and below.
const IVC_L = -16;
const IVC_A = -51;
const IVC = B.union(
  cutVessel([[IVC_L, IVC_A, 8], [IVC_L, IVC_A, 32], [IVC_L, IVC_A - 0.5, 54]].map(W), 10, 9.7, "deoxy"),
  cutVessel([[IVC_L, IVC_A, 12], [IVC_L, IVC_A, -10], [IVC_L, IVC_A + 0.5, -30]].map(W), 10, 9.7, "deoxy"),
);
const GROOVE = B.capsule(W([IVC_L, IVC_A, 50]), W([IVC_L, IVC_A, -40]), 10.3, 10.3);

const LIVER = B.carve(NOTCHED, GROOVE, 1.5);
// The liver itself is one leaf, so that its distance is exact at the surface and the ligament, gallbladder and vessel
// tissues end where their own surfaces leave the liver's.
export const LIVER_ONLY = B.field(LIVER);
const PARENCHYMA = B.custom((p) => LIVER_ONLY.value(p), { bounds: LIVER_ONLY.bounds, mat: "liver" });
const ORGAN = B.blend(1.5, B.blend(3, B.blend(1.2, PARENCHYMA, FALCIFORM, TERES), GALL, CYSTIC, PORTAL, ARTERY, DUCT), IVC);
export const LIVER_FIELD = B.field(ORGAN, {
  name: "liver",
  mix: {
    pairs: [["liver", "portal"], ["liver", "deoxy", { steps: 1, width: 2, bias: 0 }], ["liver", "oxy"], ["liver", "bile", { steps: 2, width: 3, bias: 0 }], ["liver", "ligament", { steps: 1, width: 1.2, bias: 0 }]],
    width: 7,
    steps: 3,
    bias: 2,
  },
});

// Volume of the anatomical right and left lobes, divided at the falciform ligament.
export function lobeVolumes(F = LIVER_ONLY, step = 2) {
  const { min, max } = F.bounds;
  let right = 0;
  let left = 0;
  const inv = (p) => {
    const q = [p[0], p[1], p[2] - LIFT];
    const o = dir([SHIFT, 0, 0]);
    q[0] -= o[0];
    q[1] -= o[1];
    const Lx = dir([1, 0, 0]);
    const Ax = dir([0, 1, 0]);
    return [G.dot3(q, Lx), G.dot3(q, Ax), q[2]];
  };
  for (let x = min[0]; x <= max[0]; x += step)
    for (let y = min[1]; y <= max[1]; y += step)
      for (let z = min[2]; z <= max[2]; z += step) {
        if (F.v(x, y, z) >= 0) continue;
        if (inv([x, y, z])[0] < FALCIFORM_L) right++;
        else left++;
      }
  return { right, left, ratio: right / left };
}
