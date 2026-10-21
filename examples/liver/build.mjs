import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { tissueCss, run } from "../shared/specimen.mjs";
import { LIVER_FIELD, W } from "./model.mjs";

export { LIVER_FIELD };

const palettes = {
  liver: { light: ["#b97a6a", "#c18576", "#c99183", "#d19e91", "#d9ab9f"], dark: ["#4b2820", "#532d24", "#5b3228", "#63372c", "#6c3d31"] },
  bile: { light: ["#7f9a5a", "#8aa466", "#95ae73", "#a1b881", "#adc290"], dark: ["#2f3d21", "#344425", "#3a4b29", "#40522d", "#465932"] },
  portal: { light: ["#a6a3c4", "#b2afcd", "#bebcd6", "#cac9df", "#d7d6e8"], dark: ["#2c2a3d", "#322f44", "#38354c", "#3e3b54", "#45425c"] },
  oxy: { light: ["#c96f66", "#d17d74", "#d98b83", "#e09a93", "#e7aaa4"], dark: ["#5a2622", "#632a26", "#6c2f2a", "#75342e", "#7e3933"] },
  deoxy: { light: ["#aeb8c6", "#bcc5d1", "#cad2dc", "#d8dee6", "#e8ecf1"], dark: ["#232a33", "#29313b", "#303843", "#37404c", "#404a57"] },
  ligament: { light: ["#c4a27c", "#cbab87", "#d2b592", "#d9bf9e", "#e0c9aa"], dark: ["#54452f", "#5b4b34", "#625139", "#69573e", "#705d43"] },
};
const POST_AT = W([-40, 4, 0]);

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
  paint: { base: "liver", banded: ["bile", "oxy", "ligament"], quiet: ["bile", "oxy", "ligament"] },
  css: tissueCss(palettes),
  keys: [
    { mark: "lit", label: "Gallbladder and bile duct" },
    { mark: "raised", label: "Portal vein, hepatic artery and bile duct at the porta; the inferior vena cava behind" },
  ],
  caption: "A classroom model of a liver. Seen from the front, the falciform ligament divides the large right lobe from the tapering left lobe, and the fundus of the gallbladder shows below the sharp inferior border. Turned, the porta hepatis shows the portal vein, the hepatic artery and the bile duct, and the inferior vena cava runs up through the back of the liver.",
  views: [
    { key: "front", name: "Front", azimuth: 55, field: LIVER_FIELD, say: "liver · front", label: "Model of a liver on a turned plinth, seen from the front: the large right lobe, the left lobe tapering to the left, the falciform ligament between them running down to the notch in the sharp inferior border, and the fundus of the gallbladder just below the border." },
    { key: "right", name: "From the right", azimuth: 100, field: LIVER_FIELD, say: "liver · from the right", label: "The same liver model turned to show the rounded right lobe, the fundus of the gallbladder under its inferior border and the inferior vena cava at the back." },
    { key: "back", name: "From behind", azimuth: -120, field: LIVER_FIELD, say: "liver · from behind", label: "The same liver model seen from behind: the inferior vena cava in its groove, and below it the portal vein at the porta hepatis, with the hepatic artery and the bile duct in front of it." },
  ],
});
