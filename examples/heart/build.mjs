import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import * as B from "../../kit/blob.mjs";
import * as A from "../../kit/audit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";
import * as M from "./model.mjs";
import { HEART, HEART_CUT, W, PLINTH, POST, POST_TOP } from "./geometry.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const argv = process.argv.slice(2);
const theme = argv.includes("--light") ? "light" : "dark";
const quick = argv.includes("--quick");
const auditing = argv.includes("--audit");
const child = argv.find((arg) => arg.startsWith("--child="));
const only = argv.find((arg) => arg.startsWith("--view="));
const started = Date.now();

const WIDTH = 560;
const HEIGHT = 620;
export const VIEWS = ["15", "45", "75", "105", "cut"];
const DEFAULT = VIEWS.indexOf("15");
const CELL = quick ? 0.7 : 0.4;
const TISSUE = { muscle: "muscle", oxy: "oxy", deoxy: "deoxy", coronary: "coronary", cut: "cut", valve: "valve" };

function view(spec) {
  const cut = spec === "cut";
  const azimuth = cut ? 15 : Number(spec);
  const FIELD = cut ? HEART_CUT : HEART;
  const t0 = Date.now();
  const box = [...k.boxCorners({ x: -PLINTH.r, y: -PLINTH.r, w: 2 * PLINTH.r, d: 2 * PLINTH.r, r: 0 }, 0, PLINTH.h), HEART.bounds.min, HEART.bounds.max, [HEART.bounds.min[0], HEART.bounds.max[1], HEART.bounds.max[2]], [HEART.bounds.max[0], HEART.bounds.min[1], HEART.bounds.max[2]]];
  const P = k.fitProjection(box, WIDTH, HEIGHT, { pad: 26, azimuth, elevation: 24 });
  const R = A.recorder(P);
  const at = (p) => k.iso(p, P);
  const F = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const plinth = [[0, PLINTH.r], [1.6, PLINTH.r], [2.8, PLINTH.r - 1.4], [8.4, PLINTH.r - 2.6], [PLINTH.h, PLINTH.r - 4.4]];
  const seams = "";
  const top = PLINTH.h;
  const ringR = PLINTH.r - 9;
  const screws = [0, 1, 2, 3].map((i) => G.pointOf(F, top, ringR, Math.PI / 4 + (i * Math.PI) / 2));
  const engraving = k.lineSvg(G.circleOf(F, top, ringR - 3, P, 96), { tone: "faint" }) + screws.map((p) => k.lineSvg(k.ring(p[0], p[1], 1.6, top, P, 18), { tone: "lo" })).join("") + k.dotsSvg(screws.map(at), { size: 0.5 });
  R.put({ name: "stand.plinth", at: [0, 0, top / 2], svg: `<path class="iso-halo" d="${k.haloOf({ x: -PLINTH.r, y: -PLINTH.r, w: 2 * PLINTH.r, d: 2 * PLINTH.r, r: PLINTH.r }, 0, top, P)}"/>` + k.solidSvg(G.solidOf(plinth, F, P, { bevel: 0.6, steps: 72 }), { tone: "mid", inner: seams }) + engraving, shapes: [R.solid(A.solid(F, plinth, { name: "stand.plinth", ground: true }))] });
  const [px, py] = W([POST.l, POST.a, 0]);
  const collar = G.frameOf([px, py, top], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const collarProfile = [[0, 7.5], [2.2, 7.5], [3, 6.6], [3.6, 5.2]];
  R.put({ name: "stand.collar", at: [px, py, top + 1.8], svg: k.solidSvg(G.solidOf(collarProfile, collar, P), { tone: "mid", inner: k.lineSvg(G.arcOf(collar, 2.2, 7.5, P), { tone: "faint" }) }), shapes: [R.solid(A.solid(collar, collarProfile, { name: "stand.collar" }))] });
  const postFrame = G.frameOf([px, py, top + 3.6], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const length = POST_TOP - top - 3.6;
  R.put({ name: "stand.post", at: [px, py, top + 3.6 + length / 3], svg: k.solidSvg(G.disc(0, length, POST.r, postFrame, P), { tone: "mid" }), shapes: [R.solid(A.disc(postFrame, 0, length, POST.r, { name: "stand.post", blend: ["heart"] }))] });
  const painted = B.paint(FIELD, P, { cell: CELL, coarse: quick ? 3 : 2, seams: false, smooth: 0.5, toneSmooth: 0.5, jump: 3.5, tones: "overlay", base: "muscle", banded: ["coronary", "cut", "valve"] });
  const centre = at(W([6, 0, 0]));
  R.put({ name: "heart", at: W([4, 0, 10]), svg: `<g data-part="heart" data-cx="${centre[0].toFixed(2)}" data-cy="${centre[1].toFixed(2)}">${B.fieldSvg(painted, { tone: "hi", tissue: TISSUE })}</g>`, shapes: [R.solid(A.field(FIELD, { name: "heart" }))] });
  A.settle(R, P);
  R.items.sort((a, b) => a.key - b.key);
  const body = R.items.map((item) => item.svg).join("");
  const svg = B.compactSvg(k.figureSvg({ width: WIDTH, height: HEIGHT, label: cut ? "The same heart model opened along the four-chamber plane: the cut face shows the walls of both atria and both ventricles, the septum between them, the mitral and tricuspid valve leaflets with their papillary muscles, and the lumens of the cut great vessels." : `Classroom model of a human heart on a turned plinth, seen from the front, turned ${azimuth - 15} degrees: ventricles with the apex to the model's left, both atria and auricles, the aortic arch with its three branches, the pulmonary trunk splitting in two, the venae cavae and the coronary arteries on the surface.`, body, className: "hr-view" }), { tolerance: 0.3 });
  return { spec, azimuth, cut, P, R, svg, centre, painted, ms: Date.now() - t0 };
}


if (child) {
  const [azimuth, out] = child.slice(8).split(",");
  const v = view(azimuth);
  let report = "";
  let failed = 0;
  if (auditing) {
    const result = A.audit(v.R, v.P, { organic: true });
    failed = A.failures(result);
    report = A.report(result);
  }
  writeFileSync(out, JSON.stringify({ spec: v.spec, cut: v.cut, azimuth: v.azimuth, svg: v.svg, centre: v.centre, items: v.R.items.length, rays: v.painted.stats.probes, ms: v.ms, report, failed }));
} else {
  await main();
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), "heart-"));
  const chosen = only ? [only.split("=")[1]] : VIEWS;
  const views = await Promise.all(
    chosen.map(
      (azimuth) =>
        new Promise((done, fail) => {
          const out = join(dir, `${azimuth}.json`);
          const run = spawn(process.execPath, [SELF, `--child=${azimuth},${out}`, ...argv.filter((arg) => arg === "--quick" || arg === "--audit")], { stdio: ["ignore", "inherit", "inherit"] });
          run.on("exit", (code) => (code ? fail(new Error(`view ${azimuth} exited ${code}`)) : done(JSON.parse(readFileSync(out, "utf8")))));
        }),
    ),
  );
  rmSync(dir, { recursive: true, force: true });
  let failed = 0;
  for (const v of views) {
    console.log(`view ${v.spec}: ${v.items} items · ${v.rays} rays · ${(v.svg.length / 1024).toFixed(1)} KB · ${(v.ms / 1000).toFixed(1)} s`);
    if (auditing) {
      console.log(`--- view ${v.spec}\n${v.report}\n${v.failed ? `view failed: ${v.failed}` : "view passed"}`);
      failed += v.failed;
    }
  }
  if (auditing) {
    console.log(failed ? `audit failed: ${failed} problem${failed === 1 ? "" : "s"}` : "audit passed");
    if (failed) process.exitCode = 1;
  }
  const live = readFileSync(join(HERE, "live.js"), "utf8")
    .replace("__MODEL__", readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, ""))
    .replace("__VIEWS__", JSON.stringify(views.map((v) => ({ azimuth: v.azimuth, cut: v.cut, centre: v.centre }))))
    .replace("__DEFAULT__", String(only ? 0 : DEFAULT));
  const css = readFileSync(join(HERE, "heart.css"), "utf8");
  const first = only ? 0 : DEFAULT;
  const stack = views.map((v, index) => v.svg.replace("<svg ", `<svg data-view="${index}"${index === first ? " data-on" : ""} aria-hidden="${index === first ? "false" : "true"}" `)).join("");
  const dots = views.map((v, index) => `<button type="button" class="hr-dot" data-go="${index}"${index === first ? ' aria-current="true"' : ""} ${v.cut ? " data-cut" : ""} aria-label="${v.cut ? "Four-chamber cut" : `View from ${v.azimuth}°`}"></button>`).join("");
  const body = `<style>${B.FIELD_CSS}${css}</style>` + k.plateHtml({
    fig: "Fig 1",
    title: "Heart",
    hint: "← → turn · ↑ ↓ rate",
    readout: `${M.REST_BPM} bpm · diastole`,
    keys: [
      { mark: "lit", label: "Coronary arteries: the heart's own blood supply" },
      { mark: "flat", label: "Last view: the model opened along the four-chamber plane, with the septum, the mitral and tricuspid leaflets and their papillary muscles" },
      { mark: "raised", label: "Aorta and pulmonary veins carry oxygenated blood; the venae cavae and pulmonary trunk carry it back" },
    ],
    caption: "A classroom heart model on a turned plinth. The apex points down and to the model's left; the aorta arches back over the split of the pulmonary trunk and gives off the brachiocephalic trunk, the left common carotid and the left subclavian arteries. It beats at the rate in the readout: the ventricles squeeze for about a third of each cycle (systole) and the atria add a small kick just before.",
    body: `<div class="iso-stage hr-stage" tabindex="0" role="group" aria-roledescription="specimen" aria-label="Heart model: left and right arrows turn it, up and down change the heart rate">${stack}</div><div class="hr-turn"><button type="button" class="hr-step" data-step="-1" aria-label="Turn right">‹</button>${dots}<button type="button" class="hr-step" data-step="1" aria-label="Turn left">›</button></div>`,
  });
  const page = k.pageHtml({ title: "Heart", theme, body, script: kitScript() + live, width: 620 });
  const name = only ? `heart-view${theme === "light" ? "-light" : ""}.html` : theme === "light" ? "heart-light.html" : "heart.html";
  writeFileSync(join(HERE, name), page);
  console.log(`wrote ${name} · ${(page.length / 1024).toFixed(0)} KB · ${views.length} views · ${((Date.now() - started) / 1000).toFixed(1)} s`);
}
