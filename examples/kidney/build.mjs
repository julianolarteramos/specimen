import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import * as G from "../../kit/lathe.mjs";
import * as B from "../../kit/blob.mjs";
import { frame, along, cutVessel, tissueCss, run } from "../shared/specimen.mjs";

const { lift, dir, A: ANTERIOR } = frame(45);
const LIFT = 92;
const W = lift(LIFT);
const AXIS = G.unit3([-0.22, 0.05, 1]);
const SIDE = [1, 0, 0.22];
const AXES = along(dir, [0, 0, 0], AXIS, SIDE);
const at = (t, l = 0, a = 0) => G.add3(G.add3(G.mul3(AXIS, t), G.mul3(G.unit3(G.cross3([0, 1, 0], AXIS)), l)), [0, a, 0]);

const cortex = { mat: "cortex" };
const POLE_UP = B.ellipsoid(W(at(24, 2)), [30, 25, 15], { axes: AXES, ...cortex });
const POLE_DOWN = B.ellipsoid(W(at(-22, 3)), [30, 24, 14.5], { axes: AXES, ...cortex });
const WAIST = B.ellipsoid(W(at(0, 4)), [26, 27, 15.5], { axes: AXES, ...cortex });
const HILUM = B.ellipsoid(W(at(0, -27, 2)), [17, 13, 12], { axes: AXES });
const KIDNEY = B.carve(B.blend(14, POLE_UP, POLE_DOWN, WAIST), HILUM, 7);

const HILUM_C = at(0, -16, 1);
const ARTERY = cutVessel([G.add3(HILUM_C, [0, 3, 6]), G.add3(HILUM_C, [-12, 4, 9]), G.add3(HILUM_C, [-30, 6, 10])].map(W), 3.4, 3.2, "oxy");
const VEIN = cutVessel([G.add3(HILUM_C, [0, 7, -1]), G.add3(HILUM_C, [-12, 9, 0]), G.add3(HILUM_C, [-30, 11, 1])].map(W), 4.6, 4.4, "deoxy");
const URETER = cutVessel([G.add3(HILUM_C, [1, -3, -8]), G.add3(HILUM_C, [-8, -2, -24]), G.add3(HILUM_C, [-9, -1, -48]), G.add3(HILUM_C, [-7, 0, -62])].map(W), 3.4, 2.2, "pelvis", { lumen: 0.5 });
const ADRENAL = B.blend(4,
  B.ellipsoid(W(G.add3(at(52, -6), [0, -1, 0])), [17, 9, 4.5], { axes: along(dir, [0, 0, 0], [0.8, 0, 0.55], [0, 0, 1]), mat: "gland" }),
  B.ellipsoid(W(G.add3(at(48, 6), [0, -2, 0])), [12, 7, 4], { axes: along(dir, [0, 0, 0], [0.9, 0, -0.35], [0, 0, 1]), mat: "gland" }),
);
const ORGAN = B.blend(2.5, B.blend(3, KIDNEY, ARTERY, VEIN, URETER), ADRENAL);
const MIX = { pairs: [["cortex", "oxy"], ["cortex", "deoxy"], ["cortex", "pelvis"], ["cortex", "gland", { steps: 2, width: 3, bias: 0 }]], width: 6, steps: 3, bias: 2 };

const PYRAMIDS = [-36, -22, -8, 8, 22, 36].map((t, i) => {
  const base = at(t * 1.05, 14 + 6 * Math.cos((t / 40) * 1.4), 0);
  const tip = at(t * 0.45, -2, 0);
  return B.capsule(W(base), W(tip), 7.5 - Math.abs(i - 2.5) * 0.4, 2.2);
});
const CALYCES = B.blend(3, B.ellipsoid(W(at(0, -9)), [26, 6, 9], { axes: AXES }), ...[-36, -22, -8, 8, 22, 36].map((t) => B.capsule(W(at(t * 0.45, -2.5, 0)), W(at(0, -8)), 2.8, 4)), B.capsule(W(at(0, -10)), W(HILUM_C), 6, 4));
const SINUS = B.ellipsoid(W(at(0, -6)), [32, 11, 11], { axes: AXES });
const MEDULLA_AD = B.ellipsoid(W(G.add3(at(51, -4), [0, -1, 0])), [12, 3.2, 1.6], { axes: along(dir, [0, 0, 0], [0.8, 0, 0.55], [0, 0, 1]) });
const cores = [
  { ...CALYCES, mat: "pelvis" },
  { ...B.union(...PYRAMIDS), mat: "medulla" },
  { ...SINUS, mat: "fat" },
  { ...MEDULLA_AD, mat: "medulla-ad" },
  { ...B.grow(ADRENAL, 0.3), mat: "gland" },
];
const CUT_O = W([0, 1, 0]);
const CUT_N = dir([0, 1, 0]);
const SECTION = B.carve(ORGAN, B.halfspace(CUT_O, G.mul3(CUT_N, -1)), 0.3, { mat: "cut" });

export const KIDNEY_FIELD = B.field(ORGAN, { name: "kidney", mix: MIX });
export const KIDNEY_CUT = B.field(SECTION, { name: "kidney", mix: MIX, cores });

const palettes = {
  cortex: { light: ["#c98a7e", "#d29589", "#daa196", "#e2aea4", "#eabdb4"], dark: ["#4a2a25", "#522f2a", "#5a342e", "#623932", "#6b3f38"] },
  oxy: { light: ["#d6aaa5", "#dfb8b3", "#e7c6c2", "#efd5d2", "#f7e6e4"], dark: ["#3d2524", "#472b29", "#51322f", "#5c3935", "#68423d"] },
  deoxy: { light: ["#aeb8c6", "#bcc5d1", "#cad2dc", "#d8dee6", "#e8ecf1"], dark: ["#232a33", "#29313b", "#303843", "#37404c", "#404a57"] },
  pelvis: { light: ["#e2d4a8", "#e7dbb5", "#ece2c2", "#f1e9cf", "#f6f0dd"], dark: ["#4f4834", "#57503a", "#5f5740", "#675f46", "#70674d"] },
  gland: { light: ["#d8b26a", "#dfbd7c", "#e5c78d", "#ebd29f", "#f1dcb1"], dark: ["#5a4524", "#634c28", "#6c532c", "#755a30", "#7e6134"] },
  cut: { light: ["#b86a5c", "#bf7466", "#c67e70", "#cd887b", "#d49386"], dark: ["#5e2d26", "#66322a", "#6e372e", "#763c32", "#7e4136"] },
  medulla: { light: ["#94473c", "#9c5045", "#a4594e", "#ac6257", "#b46b60"], dark: ["#451c17", "#4c201b", "#53241f", "#5a2823", "#612c27"] },
  fat: { light: ["#ecd88f", "#efde9e", "#f2e3ad", "#f5e9bc", "#f8eecb"], dark: ["#5c5126", "#645829", "#6c5f2d", "#746630", "#7c6d34"] },
  "medulla-ad": { light: ["#9e6a3a", "#a67343", "#ae7c4c", "#b68555", "#be8e5e"], dark: ["#48301a", "#50351d", "#583a20", "#603f23", "#684426"] },
};
const POST_AT = W(at(-46, 4, -6));

run({
  self: fileURLToPath(import.meta.url),
  here: dirname(fileURLToPath(import.meta.url)),
  name: "kidney",
  prefix: "kidney",
  fig: "Fig 2",
  title: "Kidney",
  aria: "Model of a left kidney with its adrenal gland: left and right arrows change the view",
  width: 520,
  height: 600,
  plinth: { r: 36, h: 9 },
  post: { at: [POST_AT[0], POST_AT[1]], r: 2.8, sink: 5 },
  mountOn: KIDNEY_FIELD,
  bounds: KIDNEY_FIELD.bounds,
  centre: W(at(0, 2)),
  tissue: Object.fromEntries(Object.keys(palettes).map((name) => [name, name])),
  paint: { base: "cortex", banded: ["cut", "medulla", "pelvis", "fat", "medulla-ad", "gland"], quiet: ["pelvis", "fat"] },
  css: tissueCss(palettes),
  keys: [
    { mark: "lit", label: "Medullary pyramids and the calyces they drain into" },
    { mark: "raised", label: "Renal artery, renal vein and ureter at the hilum; the adrenal gland on the upper pole" },
  ],
  caption: "A classroom model of a left kidney with its adrenal gland. Seen whole, the hilum faces the midline with the renal vein in front, the artery above it and the ureter leaving downward. Opened on its coronal plane, the cortex surrounds the dark medullary pyramids, whose tips empty into the calyces and the renal pelvis in its bed of sinus fat; the adrenal shows its yellow cortex around a darker medulla.",
  views: [
    { key: "front", name: "Front", azimuth: 20, field: KIDNEY_FIELD, say: "left kidney · front", label: "Model of a left kidney on a turned plinth, seen from the front: the bean-shaped organ with its hilum facing the midline, the renal artery, renal vein and ureter leaving it, and the adrenal gland capping the upper pole." },
    { key: "side", name: "Turned", azimuth: 70, field: KIDNEY_FIELD, say: "left kidney · turned 50°", label: "The same kidney model turned 50 degrees, showing its convex lateral border and the adrenal gland from the side." },
    { key: "cut", name: "Coronal section", azimuth: 20, field: KIDNEY_CUT, square: true, say: "coronal section", label: "The kidney model opened on its coronal plane: the cortex, the medullary pyramids, the calyces and renal pelvis in the sinus fat, the ureter, and the adrenal gland cut to show its cortex and medulla." },
  ],
});
