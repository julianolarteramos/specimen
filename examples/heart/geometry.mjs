import * as G from "../../kit/lathe.mjs";
import * as B from "../../kit/blob.mjs";

export const AZ0 = 45;

const rad = Math.PI / 180;
const LW = [Math.sin(AZ0 * rad), -Math.cos(AZ0 * rad), 0];
const AW = [Math.cos(AZ0 * rad), Math.sin(AZ0 * rad), 0];
export const LIFT = 92;
export const W = ([l, a, s]) => [l * LW[0] + a * AW[0], l * LW[1] + a * AW[1], s + LIFT];
const AXES = [LW, AW];

export const PLINTH = { r: 46, h: 10 };
export const POST = { l: 10, a: -10, r: 3.2 };

function spline(points, step = 2) {
  const out = [];
  const n = points.length;
  const at = (i) => points[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const count = Math.max(2, Math.ceil(G.len3(G.sub3(p2, p1)) / step));
    for (let j = 0; j < count; j++) {
      const t = j / count;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([0, 1, 2].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  out.push(points[n - 1]);
  return out;
}

const Wd = ([l, a, s]) => [l * LW[0] + a * AW[0], l * LW[1] + a * AW[1], s];
const along = (from, to, side) => {
  const d = G.unit3(G.sub3(to, from));
  const u = G.unit3(G.sub3(side, G.mul3(d, G.dot3(side, d))));
  return [Wd(d), Wd(u)];
};

function cutVessel(local, r0, r1, mat, { lumen = 0.6, depth = 12, k = 0.5, step = r0 >= 6 ? 0.4 : 0.7 } = {}) {
  const points = spline(local.map(W), step);
  const last = points[points.length - 1];
  const tangent = G.unit3(G.sub3(last, points[points.length - 2]));
  const tube = B.vessel(points, (t) => r0 + (r1 - r0) * t, { mat });
  const bore = B.capsule(G.add3(last, G.mul3(tangent, -depth)), G.add3(last, G.mul3(tangent, 4)), r1 * lumen, r1 * lumen);
  return B.clip(B.carve(tube, bore, k), last, tangent, k);
}

const muscle = { mat: "muscle" };
const BASE_C = [4, 2, 14];
const APEX = [34, 20, -52];
const LV = B.ellipsoid(W([16, 0, -10]), [40, 27, 25], { axes: along(BASE_C, APEX, [1, 0, 0]), ...muscle });
const LV_TIP = B.ball(W([31, 15, -42]), 11, muscle);
const RV = B.ellipsoid(W([-7, 17, -2]), [34, 24, 15], { axes: along([-14, 16, 14], [18, 26, -36], [1, -0.4, 0]), ...muscle });
const CONUS = B.capsule(W([-2, 18, 8]), W([4, 19, 28]), 14.5, 13.5, muscle);
const RA = B.ellipsoid(W([-34, 0, 24]), [17, 16, 22], { axes: AXES, ...muscle });
const LA = B.ellipsoid(W([6, -26, 30]), [24, 14, 14], { axes: AXES, ...muscle });
const AORTA = cutVessel([[-4, 8, 22], [-12, 12, 56], [-9, 6, 78], [1, -8, 89], [14, -22, 87], [22, -31, 74], [24, -35, 52], [24, -36, 30]], 13, 11.5, "oxy");
const BRACHIOCEPHALIC = cutVessel([[-8, 3, 82], [-13, 5, 100], [-17, 7, 117]], 6.8, 6.2, "oxy");
const CAROTID = cutVessel([[2, -8, 86], [3, -8, 104], [4, -8, 119]], 4.6, 4.3, "oxy");
const SUBCLAVIAN = cutVessel([[12, -19, 85], [17, -23, 100], [21, -26, 114]], 5.2, 4.8, "oxy");
const TRUNK = B.vessel(spline([[4, 19, 27], [5, 15, 38], [6, 9, 48], [6, 6, 52]].map(W), 0.4), (t) => 13.5 - 2 * t, { mat: "deoxy" });
const LPA = cutVessel([[6, 6, 52], [19, -5, 58], [29, -17, 58]], 9, 8, "deoxy");
const RPA = cutVessel([[6, 6, 52], [-6, -14, 60], [-25, -21, 62]], 9, 8, "deoxy");
const SVC = cutVessel([[-35, -4, 36], [-35, -5, 70], [-34, -5, 96]], 10, 9.5, "deoxy");
const IVC = cutVessel([[-30, -10, 10], [-30, -12, -16]], 11, 10.5, "deoxy");
const VEINS = [
  [[-8, -32, 36], [-24, -38, 40]],
  [[-8, -32, 22], [-24, -38, 20]],
  [[20, -32, 36], [36, -38, 40]],
  [[20, -32, 22], [36, -38, 20]],
].map((points) => cutVessel(points, 5.6, 5.2, "oxy"));

const CHAMBERS = B.blend(9, B.blend(15, B.blend(18, LV, LV_TIP), RV, CONUS), RA, LA);
const BODY = CHAMBERS;
const VESSELS = [AORTA, BRACHIOCEPHALIC, CAROTID, SUBCLAVIAN, TRUNK, LPA, RPA, SVC, IVC, ...VEINS];
const BASE_FIELD = B.field(B.blend(3, BODY, ...VESSELS));

function onSurface(F, p) {
  let q = p;
  for (let i = 0; i < 30; i++) {
    const d = F.value(q);
    const g = F.gradient(q[0], q[1], q[2], 1e-3);
    const g2 = G.dot3(g, g) || 1;
    q = G.sub3(q, G.mul3(g, d / g2));
    if (Math.abs(d) < 1e-4) break;
  }
  return { p: q, n: F.normal(q[0], q[1], q[2]) };
}

const smooth01 = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function coronary(local, r0, r1, { rise = [0, 0.22], dive = [0.86, 1], mat = "coronary", raise = 1, sink = 1.8, taper = mat === "coronary" } = {}) {
  const guide = spline(local.map(W), 2).map((p) => onSurface(BASE_FIELD, p).p);
  const path = spline(guide.filter((_, i) => i % 2 === 0 || i === guide.length - 1), 1.2);
  const total = path.length - 1;
  const centres = path.map((p, i) => {
    const t = i / total;
    const r = (r0 + (r1 - r0) * t - (taper ? r1 * 0.6 * smooth01(0.7, 1, t) : 0)) * (taper ? 0.7 + 0.3 * smooth01(rise[0], rise[1], t) : 1);
    const lift = r * (raise - sink * (1 - smooth01(rise[0], rise[1], t)) - (taper ? 0.5 : sink) * smooth01(dive[0], dive[1], t));
    const { p: q, n } = onSurface(BASE_FIELD, p);
    return { c: G.add3(q, G.mul3(n, lift)), r };
  });
  return B.vessel(centres.map((x) => x.c), centres.map((x) => x.r), { mat });
}

const LAD = coronary([[10, 14, 30], [10, 28, 14], [12, 36, -4], [18, 36, -22], [26, 30, -38], [33, 22, -50]], 1.7, 0.9);
const DIAGONAL = coronary([[12, 36, -4], [21, 34, -9], [31, 27, -15], [39, 19, -21]], 1.1, 0.7, { rise: [-1, -0.5], dive: [0.8, 1] });
const RCA = coronary([[-15, 21, 34], [-12, 20, 28], [-22, 22, 18], [-32, 19, 7], [-38, 11, -4], [-39, 0, -14]], 1.7, 1);
const CIRCUMFLEX = coronary([[16, 6, 30], [26, -2, 28], [34, -10, 22], [38, -18, 13]], 1.4, 0.9);
const CORONARIES = [LAD, DIAGONAL, RCA, CIRCUMFLEX];
const draped = (local, r0, r1) => coronary(local, r0, r1, { mat: "muscle", raise: 0.25, sink: 1.2, rise: [0, 0.25], dive: [0.75, 1] });
const AURICLES = [draped([[24, -16, 42], [30, -4, 42], [28, 8, 38], [21, 16, 33]], 7.5, 3.6), draped([[-36, -2, 40], [-31, 10, 44], [-22, 18, 46], [-14, 22, 44]], 8, 4)];

export const MIX = { pairs: [["muscle", "oxy"], ["muscle", "deoxy"], ["muscle", "coronary", { steps: 0, width: 0.3, bias: 0.05 }]], width: 9, steps: 2, bias: 3 };
export const HEART = B.field(B.blend(0.7, B.blend(3, B.blend(2.5, BODY, ...AURICLES), ...VESSELS), ...CORONARIES), { name: "heart", mix: MIX });

function postTop() {
  const [x, y] = W([POST.l, POST.a, 0]);
  for (let z = PLINTH.h; z < LIFT + 40; z += 0.05) if (HEART.value([x, y, z]) < 0) return z;
  throw new Error("the post never reaches the heart");
}
export const POST_TOP = postTop() + 5;


const CUT_N = G.unit3([0.45, 0.6, 0.62]);
export const CUT = { o: W(G.mul3(CUT_N, 3.4)), n: Wd(CUT_N) };
const valve = { mat: "valve" };
const onCut = (c) => G.sub3(c, G.mul3(CUT_N, G.dot3(c, CUT_N) - 3.4));
const LV_AXES = along(BASE_C, APEX, [1, 0, 0]);
const RV_AXES = along([-14, 16, 14], [18, 26, -36], [1, -0.4, 0]);
const LV_CAVITY = B.ellipsoid(W(onCut([17, 2, -6])), [30, 16, 13], { axes: LV_AXES });
const RV_CAVITY = B.carve(B.ellipsoid(W(onCut([-8, 19, -1])), [29, 20, 10], { axes: RV_AXES }), B.ellipsoid(W([16, 0, -10]), [41, 26.5, 24.5], { axes: LV_AXES }), 2);
const RA_CAVITY = B.ellipsoid(W(onCut([-34, 0, 24])), [14, 13, 19], { axes: AXES });
const LA_CAVITY = B.ellipsoid(W(onCut([6, -24, 30])), [21, 11, 11], { axes: AXES });
const MITRAL = [onCut([10, -12, 21]), onCut([13, -4, 13])];
const TRICUSPID = [onCut([-26, 7, 15]), onCut([-17, 13, 8])];
const CAVITIES = B.blend(2.5, LV_CAVITY, RV_CAVITY, RA_CAVITY, LA_CAVITY, B.capsule(W(MITRAL[0]), W(MITRAL[1]), 8, 8), B.capsule(W(TRICUSPID[0]), W(TRICUSPID[1]), 7, 7));
const leaflet = (root, tip) => {
  const axes = along(root, tip, CUT_N);
  return B.ellipsoid(W(G.lerp3(root, tip, 0.5)), [G.len3(G.sub3(tip, root)) / 2 + 1.2, 6, 1.7], { axes: [axes[0], axes[1]], ...valve });
};
const valveSet = (ring, axis, width, length, reach) => {
  const d = G.unit3(axis);
  const u = G.unit3(G.cross3(CUT_N, d));
  const leaves = [];
  const parts = [];
  for (const side of [-1, 1]) {
    const root = onCut(G.add3(ring, G.mul3(u, side * width)));
    const tip = onCut(G.add3(G.add3(root, G.mul3(d, length)), G.mul3(u, -side * width * 0.35)));
    const papillaTip = onCut(G.add3(G.add3(ring, G.mul3(d, reach)), G.mul3(u, side * width * 0.9)));
    const papillaBase = onCut(G.add3(G.add3(ring, G.mul3(d, reach + 12)), G.mul3(u, side * width * 1.35)));
    leaves.push(leaflet(root, tip));
    parts.push(B.capsule(W(tip), W(papillaTip), 0.45, 0.45, valve), B.capsule(W(papillaTip), W(papillaBase), 1.6, 4.2, muscle));
  }
  return { leaves, parts };
};
const MITRAL_SET = valveSet(MITRAL[1], G.sub3(APEX, BASE_C), 8, 15, 30);
const TRICUSPID_SET = valveSet(TRICUSPID[1], [32, 10, -50], 7, 12, 24);
const LEAFLETS = [...MITRAL_SET.leaves, ...TRICUSPID_SET.leaves];
const VALVES = [...LEAFLETS, ...MITRAL_SET.parts, ...TRICUSPID_SET.parts];
const ENDO = B.blend(2, ...[LV_CAVITY, RA_CAVITY, LA_CAVITY].map((node) => ({ ...node, r: node.r.map((v) => v + 2.2) })), B.ellipsoid(W(onCut([-8, 19, -1])), [31.2, 22.2, 12.2], { axes: RV_AXES }));
ENDO.mat = "endo";
const SHELL = B.blend(3, B.blend(2.5, B.carve(BODY, CAVITIES, 1.5), ...AURICLES), ...VESSELS);
export const CUT_TOP = LIFT + 54;
const REMOVE = B.intersect(3, B.halfspace(CUT.o, G.mul3(CUT.n, -1)), B.halfspace([0, 0, CUT_TOP], [0, 0, 1]));
export const HEART_CUT = B.field(B.carve(B.blend(1.2, SHELL, ...VALVES), REMOVE, 0.25, { mat: "cut" }), { name: "heart.cut", mix: MIX, cores: [{ ...B.union(...LEAFLETS), mat: "valve" }, ENDO] });

export const VEIL_OPACITY = 0.32;
export const PERICARDIUM = B.field(B.clip(B.grow(B.blend(6, BODY, ...AURICLES), 3.5), [0, 0, LIFT + 46], [0, 0, 1], 1.5), { name: "pericardium" });
export const HEART_PARTS = { body: BODY, auricles: AURICLES, coronaries: CORONARIES };
