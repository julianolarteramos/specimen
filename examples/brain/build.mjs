import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import * as G from "../../kit/lathe.mjs";
import * as B from "../../kit/blob.mjs";
import { frame, groove, tissueCss, run } from "../shared/specimen.mjs";

const { L, A } = frame(45);
const LIFT = 110;
const W = ([x, y, z]) => [-x * L[0] + y * A[0], -x * L[1] + y * A[1], z + LIFT];
const Wd = ([x, y, z]) => [-x * L[0] + y * A[0], -x * L[1] + y * A[1], z];
const AX = [Wd([1, 0, 0]), Wd([0, 1, 0])];
const grey = { mat: "cortex" };

const MAIN = B.ellipsoid(W([0, 30, 10]), [78, 33, 52], { axes: AX, ...grey });
const FRONTAL = B.ellipsoid(W([44, 30, 6]), [40, 31, 46], { axes: AX, ...grey });
const OCCIPITAL = B.ellipsoid(W([-58, 28, 4]), [28, 26, 34], { axes: AX, ...grey });
const TEMPORAL = B.ellipsoid(W([12, 32, -28]), [46, 27, 20], { axes: [Wd([1, 0, 0.12]), Wd([0, 1, 0])], ...grey });
const HEMISPHERE = B.clip(B.blend(14, MAIN, FRONTAL, OCCIPITAL, TEMPORAL), W([0, -1, 0]), Wd([0, -1, 0]), 3);
const BASE = B.field(HEMISPHERE);

const sulcus = (points, r, depth = 0.25) => groove(BASE, points.map(([x, z]) => W([x, 80, z])), r, { depth });
const NAMED = [
  sulcus([[44, -16], [24, -9], [4, -2], [-14, 4], [-30, 14]], 4.2, 0.45),
  sulcus([[-6, 60], [-3, 46], [3, 30], [9, 14], [13, 2]], 2.4, 0.2),
];
let seed = 11;
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const WAVES = Array.from({ length: 7 }, () => {
  const z = random() * 2 - 1;
  const t = random() * Math.PI * 2;
  const k = 0.2 + random() * 0.06;
  return [Math.sqrt(1 - z * z) * Math.cos(t) * k, Math.sqrt(1 - z * z) * Math.sin(t) * k, z * k, random() * Math.PI * 2];
});
const gyri = (p) => {
  let n = 0;
  for (const [a, b, c, phase] of WAVES) n += Math.sin(a * p[0] + b * p[1] + c * p[2] + phase);
  n /= Math.sqrt(WAVES.length);
  return Math.max(Math.abs(n) - 0.2, -(BASE.value(p) + 3.4));
};
const FOLDS = B.custom(gyri, { bounds: BASE.bounds, L: 1 });
const CEREBELLUM_BODY = B.ellipsoid(W([-46, 24, -50]), [30, 30, 18], { axes: AX, mat: "cerebellum" });
const CEREBELLUM_FIELD = B.field(CEREBELLUM_BODY);
const ZC = LIFT - 50;
const folia = (p) => Math.max(Math.abs(Math.sin(0.62 * (p[2] - ZC) + 0.08 * (p[0] + p[1]))) * 1.4 - 0.32, -(CEREBELLUM_FIELD.value(p) + 2.2));
const CEREBELLUM = B.carve(CEREBELLUM_BODY, B.custom(folia, { bounds: CEREBELLUM_FIELD.bounds, L: 1 }), 0.5);
const STEM = B.clip(B.capsule(W([-6, 10, -22]), W([-14, 8, -80]), 11, 9, { mat: "stem" }), W([-14, 8, -78]), Wd([-0.14, -0.03, -1]), 0.4);
const BRAIN = B.blend(4, B.carve(B.carve(HEMISPHERE, FOLDS, 1.2), B.union(...NAMED), 1), CEREBELLUM, STEM);
export const BRAIN_FIELD = B.field(BRAIN, { name: "brain", mix: { pairs: [["cortex", "stem"], ["cortex", "cerebellum", { steps: 0, width: 1, bias: 0 }]], width: 6, steps: 2, bias: 0 } });

const palettes = {
  cortex: { light: ["#cdb3a8", "#d6bfb5", "#dfccc3", "#e8d9d1", "#f1e7e1"], dark: ["#40322d", "#473833", "#4f3e39", "#57453f", "#604c46"] },
  cerebellum: { light: ["#c7a59a", "#d0b1a7", "#d9beb4", "#e2cbc2", "#ebd8d0"], dark: ["#3d2d29", "#44332e", "#4b3833", "#533e38", "#5b443e"] },
  stem: { light: ["#d9c9b9", "#e0d2c4", "#e7dbcf", "#eee4da", "#f5ede5"], dark: ["#46403a", "#4d4640", "#544c46", "#5b534c", "#635a52"] },
};
const POST_AT = W([-14, 8, 0]);

run({
  self: fileURLToPath(import.meta.url),
  here: dirname(fileURLToPath(import.meta.url)),
  name: "brain",
  prefix: "brain",
  fig: "Fig 3",
  title: "Brain",
  aria: "Model of the left half of a brain: left and right arrows change the view",
  width: 600,
  height: 540,
  plinth: { r: 40, h: 9 },
  post: { at: [POST_AT[0], POST_AT[1]], r: 3.2, sink: 6 },
  mountOn: BRAIN_FIELD,
  tissue: Object.fromEntries(Object.keys(palettes).map((name) => [name, name])),
  paint: { base: "cortex", jump: 5, toneSmooth: 2.5, lineSmooth: 0.2 },
  css: tissueCss(palettes),
  keys: [
    { mark: "lit", label: "The central sulcus, between the motor and the sensory strip" },
    { mark: "raised", label: "Lateral fissure above the temporal lobe; cerebellum and brainstem below" },
  ],
  caption: "A classroom model of the left half of a brain, seen from the left. Its cortex is folded into gyri between sulci: the lateral fissure divides the temporal lobe from the frontal and parietal lobes, and the central sulcus runs down from the top between the precentral (motor) and postcentral (sensory) gyri. The cerebellum, with its fine folia, and the brainstem sit below the occipital lobe.",
  views: [
    { key: "lateral", name: "Lateral", azimuth: 45, field: BRAIN_FIELD, say: "left hemisphere · lateral", label: "Model of the left half of a brain on a turned plinth, seen from the left: frontal, parietal, occipital and temporal lobes with their gyri and sulci, the lateral fissure and the central sulcus, the cerebellum and the brainstem." },
    { key: "front", name: "From the front", azimuth: 15, field: BRAIN_FIELD, say: "left hemisphere · from the front", label: "The same brain model turned toward its frontal pole." },
    { key: "back", name: "From behind", azimuth: 75, field: BRAIN_FIELD, say: "left hemisphere · from behind", label: "The same brain model turned toward its occipital pole and the cerebellum." },
  ],
});
