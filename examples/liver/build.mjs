import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import * as G from "../../kit/lathe.mjs";
import * as B from "../../kit/blob.mjs";
import { frame, along, cutVessel, tissueCss, run } from "../shared/specimen.mjs";

const { lift, dir } = frame(45);
const LIFT = 100;
const W = lift(LIFT);
const AXES = [dir([1, 0, 0]), dir([0, 1, 0])];
const liver = { mat: "liver" };

const RIGHT = B.ellipsoid(W([-42, 0, 2]), [54, 50, 50], { axes: AXES, ...liver });
const DOME = B.ellipsoid(W([-14, -4, 18]), [58, 46, 32], { axes: AXES, ...liver });
const LEFT = [[22, 4, 16, 40, 36, 22], [58, 8, 24, 28, 26, 13], [86, 10, 28, 12, 12, 6]].map(([l, a, z, rl, ra, rs]) => B.ellipsoid(W([l, a, z]), [rl, ra, rs], { axes: AXES, ...liver }));
const CAUDATE = B.ellipsoid(W([-4, -30, -2]), [14, 10, 18], { axes: AXES, ...liver });
const BODY = B.blend(20, RIGHT, DOME, ...LEFT, CAUDATE);
const FRONT_EDGE = B.halfspace(W([0, 34, -22]), dir([0, 0.6, -0.8]));
const UNDER = B.halfspace(W([0, -10, -36]), dir([0.1, -0.25, -0.96]));
const SHAPED = B.intersect(9, BODY, FRONT_EDGE, UNDER);
const BASE = B.field(SHAPED);
const surfaceAt = (l, s0) => {
  let a = 0;
  while (BASE.value(W([l, a, s0])) < 0 && a < 200) a += 0.2;
  return a;
};
const NOTCH = B.capsule(W([10, surfaceAt(10, -10) + 4, -10]), W([10, surfaceAt(10, -10) - 10, -14]), 4.4, 2.6);
const FISSURE = B.vessel([[8, surfaceAt(8, 44) - 1, 44], [9, surfaceAt(9, 30) - 1, 30], [10, surfaceAt(10, 12) - 1, 12], [10, surfaceAt(10, -4) - 1, -4]].map(W), 2.2);
const LIVER = B.carve(B.carve(SHAPED, NOTCH, 2), FISSURE, 2);
const FALCIFORM = B.vessel([[8, surfaceAt(8, 48) + 2, 48], [9, surfaceAt(9, 32) + 2.5, 32], [10, surfaceAt(10, 14) + 2.5, 14], [10, surfaceAt(10, -2) + 1.5, -2]].map(W), [1.6, 1.9, 1.9, 1.2], { mat: "ligament" });
const GALL = B.blend(3, B.ellipsoid(W([-20, 28, -24]), [24, 10, 10], { axes: along(dir, [0, 0, 0], [0.1, 0.85, -0.5], [1, 0, 0]), mat: "bile" }), B.capsule(W([-18, 12, -20]), W([-12, 0, -20]), 4, 2.6, { mat: "bile" }));
const PORTAL = cutVessel([[-6, -6, -24], [-5, -8, -40], [-3, -9, -54]].map(W), 7, 6.6, "portal");
const ARTERY = cutVessel([[6, -2, -26], [8, -3, -40], [11, -2, -52]].map(W), 2.6, 2.4, "oxy");
const DUCT = cutVessel([[-14, 0, -26], [-13, 0, -40], [-11, 1, -52]].map(W), 3, 2.8, "bile");
const IVC = B.union(cutVessel([[-14, -40, 10], [-14, -42, 52], [-13, -42, 70]].map(W), 11, 10.5, "deoxy"), cutVessel([[-14, -40, 12], [-14, -40, -30], [-15, -38, -52]].map(W), 11, 10.5, "deoxy"));
const ORGAN = B.blend(3, B.blend(2, LIVER, FALCIFORM, GALL), PORTAL, ARTERY, DUCT, IVC);
export const LIVER_FIELD = B.field(ORGAN, { name: "liver", mix: { pairs: [["liver", "portal"], ["liver", "deoxy"], ["liver", "oxy"], ["liver", "bile", { steps: 2, width: 3, bias: 0 }], ["liver", "ligament", { steps: 1, width: 2, bias: 0 }]], width: 7, steps: 3, bias: 2 } });

const palettes = {
  liver: { light: ["#b97a6a", "#c18576", "#c99183", "#d19e91", "#d9ab9f"], dark: ["#4b2820", "#532d24", "#5b3228", "#63372c", "#6c3d31"] },
  bile: { light: ["#7f9a5a", "#8aa466", "#95ae73", "#a1b881", "#adc290"], dark: ["#2f3d21", "#344425", "#3a4b29", "#40522d", "#465932"] },
  portal: { light: ["#a6a3c4", "#b2afcd", "#bebcd6", "#cac9df", "#d7d6e8"], dark: ["#2c2a3d", "#322f44", "#38354c", "#3e3b54", "#45425c"] },
  oxy: { light: ["#c96f66", "#d17d74", "#d98b83", "#e09a93", "#e7aaa4"], dark: ["#5a2622", "#632a26", "#6c2f2a", "#75342e", "#7e3933"] },
  deoxy: { light: ["#aeb8c6", "#bcc5d1", "#cad2dc", "#d8dee6", "#e8ecf1"], dark: ["#232a33", "#29313b", "#303843", "#37404c", "#404a57"] },
  ligament: { light: ["#e6d9c6", "#ebe0cf", "#efe6d8", "#f3ece1", "#f7f2ea"], dark: ["#4a443b", "#514a41", "#585047", "#5f564d", "#665c53"] },
};
const POST_AT = W([-30, -12, 0]);

run({
  self: fileURLToPath(import.meta.url),
  here: dirname(fileURLToPath(import.meta.url)),
  name: "liver",
  prefix: "liver",
  fig: "Fig 4",
  title: "Liver",
  aria: "Model of a liver with its gallbladder and vessels: left and right arrows change the view",
  width: 600,
  height: 520,
  plinth: { r: 40, h: 9 },
  post: { at: [POST_AT[0], POST_AT[1]], r: 3.2, sink: 6 },
  mountOn: LIVER_FIELD,
  tissue: Object.fromEntries(Object.keys(palettes).map((name) => [name, name])),
  paint: { base: "liver", banded: ["bile", "oxy"], quiet: ["bile", "oxy"] },
  css: tissueCss(palettes),
  keys: [
    { mark: "lit", label: "Gallbladder and bile duct" },
    { mark: "raised", label: "Portal vein, hepatic artery and bile duct at the porta; the inferior vena cava behind" },
  ],
  caption: "A classroom model of a liver. Seen from the front, the falciform ligament divides the large right lobe from the tapering left lobe, and the fundus of the gallbladder shows below the sharp inferior border. Turned, the porta hepatis shows the portal vein, the hepatic artery and the bile duct, and the inferior vena cava runs up through the back of the liver.",
  views: [
    { key: "front", name: "Front", azimuth: 15, field: LIVER_FIELD, say: "liver · front", label: "Model of a liver on a turned plinth, seen from the front: the large right lobe, the tapering left lobe, the falciform ligament between them, the gallbladder below the inferior border, and the vessels at the porta." },
    { key: "right", name: "From the right", azimuth: -30, field: LIVER_FIELD, say: "liver · from the right", label: "The same liver model turned to show its right lobe, the gallbladder and the inferior vena cava behind." },
    { key: "left", name: "From the left", azimuth: 70, field: LIVER_FIELD, say: "liver · from the left", label: "The same liver model turned to show the left lobe and the porta hepatis with the portal vein, hepatic artery and bile duct." },
  ],
});
