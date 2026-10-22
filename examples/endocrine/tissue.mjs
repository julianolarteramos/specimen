import { tissueCss } from "../shared/specimen.mjs";

const LIGHT = {
  neural: ["#b9a9a3", "#c5b6b0", "#d0c2bc", "#dacdc8", "#e6dcd8"],
  callosum: ["#cfc6b4", "#d9d1c0", "#e2dbcc", "#eae4d7", "#f2ede3"],
  gland: ["#c2a37d", "#cdb08b", "#d7bd9a", "#e0c9a9", "#ead7bc"],
  cortex: ["#c9962a", "#d4a23a", "#ddaf4c", "#e5bc60", "#edca78"],
  medulla: ["#6e4128", "#7a4c31", "#86573b", "#916246", "#9c6e52"],
  vessel: ["#c2959a", "#cca2a6", "#d5afb3", "#debcbf", "#e8cdd0"],
  heart: ["#b0848a", "#bb9096", "#c59ca1", "#cfa9ad", "#dbb9bc"],
  coronary: ["#ad3a34", "#bd4841", "#cb5a52", "#d76e66", "#e3877f"],
  kidney: ["#b39a90", "#bea69c", "#c8b2a9", "#d2beb5", "#ddcbc3"],
  pale: ["#c9c9c6", "#d3d3d0", "#dcdcd9", "#e5e5e2", "#f0f0ee"],
  thymus: ["#bf978c", "#c9a398", "#d3b0a5", "#dcbdb3", "#e6ccc3"],
  gut: ["#b39a98", "#bea7a5", "#c8b3b1", "#d2bfbd", "#dccdcb"],
};

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v * t + hex(b)[i] * (1 - t)));
const dark = (tones) => tones.map((_, i) => mix(tones[2], "#0f0f0f", 0.3 + 0.06 * i));

const ALL = Object.fromEntries(Object.entries(LIGHT).map(([name, light]) => [name, { light, dark: dark(light) }]));

export const TISSUE = {
  brain: "neural",
  callosum: "callosum",
  hypothalamus: "gland",
  stalk: "gland",
  "pituitary-p": "gland",
  "pituitary-a": "gland",
  pineal: "gland",
  thyroid: "gland",
  parathyroid: "gland",
  pancreas: "gland",
  gonad: "gland",
  cortex: "cortex",
  medulla: "medulla",
  portal: "vessel",
  "jugular-root": "vessel",
  vessel: "vessel",
  muscle: "heart",
  oxy: "heart",
  deoxy: "heart",
  tissue: "heart",
  coronary: "coronary",
  kidney: "kidney",
  trachea: "pale",
  pelvis: "pale",
  ureter: "pale",
  ear: "pale",
  nerve: "pale",
  thymus: "thymus",
  duodenum: "gut",
};

export const PALETTES = Object.fromEntries([...new Set(Object.values(TISSUE))].map((name) => [name, ALL[name]]));

export const paletteCss = (palettes) => tissueCss(palettes);
