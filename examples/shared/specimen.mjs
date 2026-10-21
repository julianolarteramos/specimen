import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import * as B from "../../kit/blob.mjs";
import * as A from "../../kit/audit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";

const SHARED = dirname(fileURLToPath(import.meta.url));

export const frame = (azimuth = 45) => {
  const rad = (azimuth * Math.PI) / 180;
  const L = [Math.sin(rad), -Math.cos(rad), 0];
  const Aw = [Math.cos(rad), Math.sin(rad), 0];
  const lift = (h) => ([l, a, s]) => [l * L[0] + a * Aw[0], l * L[1] + a * Aw[1], s + h];
  const dir = ([l, a, s]) => [l * L[0] + a * Aw[0], l * L[1] + a * Aw[1], s];
  return { L, A: Aw, lift, dir };
};

export function along(dir, from, to, side) {
  const d = G.unit3(G.sub3(to, from));
  const u = G.unit3(G.sub3(side, G.mul3(d, G.dot3(side, d))));
  return [dir(d), dir(u)];
}

export function spline(points, step = 2) {
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

export function cutVessel(points, r0, r1, mat, { lumen = 0.6, depth = 12, k = 0.5, step = r0 >= 6 ? 0.4 : 0.7 } = {}) {
  const path = spline(points, step);
  const last = path[path.length - 1];
  const tangent = G.unit3(G.sub3(last, path[path.length - 2]));
  const tube = B.vessel(path, (t) => r0 + (r1 - r0) * t, { mat });
  const bore = B.capsule(G.add3(last, G.mul3(tangent, -depth)), G.add3(last, G.mul3(tangent, 4)), r1 * lumen, r1 * lumen);
  return B.clip(B.carve(tube, bore, k), last, tangent, k);
}

export function onSurface(F, p) {
  let q = p;
  for (let i = 0; i < 40; i++) {
    const d = F.value(q);
    const g = F.gradient(q[0], q[1], q[2], 1e-3);
    const g2 = G.dot3(g, g) || 1;
    q = G.sub3(q, G.mul3(g, d / g2));
    if (Math.abs(d) < 1e-4) break;
  }
  return { p: q, n: F.normal(q[0], q[1], q[2]) };
}

export const smooth01 = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function surfaceTube(F, points, r0, r1, { mat, lift = 1, step = 1.2, rise = [0, 0.15], dive = [0.85, 1], sink = 1.6, taper = true } = {}) {
  const guide = spline(points, 2).map((p) => onSurface(F, p).p);
  const path = spline(guide.filter((_, i) => i % 2 === 0 || i === guide.length - 1), step);
  const total = path.length - 1;
  const centres = path.map((p, i) => {
    const t = i / total;
    const r = (r0 + (r1 - r0) * t - (taper ? r1 * 0.6 * smooth01(0.7, 1, t) : 0)) * (taper ? 0.7 + 0.3 * smooth01(rise[0], rise[1], t) : 1);
    const offset = r * (lift - sink * (1 - smooth01(rise[0], rise[1], t)) - (taper ? 0.5 : sink) * smooth01(dive[0], dive[1], t));
    const { p: q, n } = onSurface(F, p);
    return { c: G.add3(q, G.mul3(n, offset)), r };
  });
  return B.vessel(centres.map((x) => x.c), centres.map((x) => x.r), { mat });
}

export function groove(F, points, r, { depth = 0.5, step = 1 } = {}) {
  const path = spline(spline(points, 2).map((p) => onSurface(F, p).p), step);
  return B.vessel(path.map((p) => {
    const { p: q, n } = onSurface(F, p);
    return G.sub3(q, G.mul3(n, r * depth));
  }), (t) => r * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)))));
}

export function tissueCss(palettes) {
  const names = ["--anatomy-shade-0", "--anatomy-shade-1", "--anatomy-shade-2", "--anatomy-shade-3", "--anatomy-top"];
  const tokens = (theme) => Object.entries(palettes).map(([name, p]) => p[theme].map((c, i) => `--tissue-${name}-${i}:${c}`).join(";")).join(";");
  return `.iso{${tokens("dark")}}\n.iso[data-theme="light"]{${tokens("light")}}\n` + Object.keys(palettes).map((name) => `.iso [data-tissue="${name}"]{${names.map((n, i) => `${n}:var(--tissue-${name}-${i})`).join(";")}}`).join("\n") + "\n";
}

export function run(spec) {
  const argv = process.argv.slice(2);
  const theme = argv.includes("--light") ? "light" : "dark";
  const quick = argv.includes("--quick");
  const auditing = argv.includes("--audit");
  const child = argv.find((arg) => arg.startsWith("--child="));
  const only = argv.find((arg) => arg.startsWith("--view="));
  const started = Date.now();
  const { width = 560, height = 560, plinth, post, views, paint = {}, tissue = {}, prefix } = spec;
  const cell = quick ? 0.7 : 0.4;

  function view(key) {
    const t0 = Date.now();
    const v = views.find((entry) => entry.key === key);
    const F = v.field;
    const b = spec.bounds ?? F.bounds;
    const box = [...k.boxCorners({ x: -plinth.r, y: -plinth.r, w: 2 * plinth.r, d: 2 * plinth.r, r: 0 }, 0, plinth.h), ...k.boxCorners({ x: b.min[0], y: b.min[1], w: b.max[0] - b.min[0], d: b.max[1] - b.min[1], r: 0 }, b.min[2], b.max[2])];
    const P = k.fitProjection(box, width, height, { pad: 26, azimuth: v.azimuth, elevation: v.elevation ?? 24 });
    const R = A.recorder(P);
    const at = (p) => k.iso(p, P);
    const Fz = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const top = plinth.h;
    const profile = [[0, plinth.r], [1.6, plinth.r], [2.8, plinth.r - 1.4], [top - 1.6, plinth.r - 2.6], [top, plinth.r - 4.4]];
    const ringR = plinth.r - 9;
    const screws = [0, 1, 2, 3].map((i) => G.pointOf(Fz, top, ringR, Math.PI / 4 + (i * Math.PI) / 2));
    const engraving = k.lineSvg(G.circleOf(Fz, top, ringR - 3, P, 96), { tone: "faint" }) + screws.map((p) => k.lineSvg(k.ring(p[0], p[1], 1.6, top, P, 18), { tone: "lo" })).join("") + k.dotsSvg(screws.map(at), { size: 0.5 });
    R.put({ name: "stand.plinth", at: [0, 0, top / 2], svg: `<path class="iso-halo" d="${k.haloOf({ x: -plinth.r, y: -plinth.r, w: 2 * plinth.r, d: 2 * plinth.r, r: plinth.r }, 0, top, P)}"/>` + k.solidSvg(G.solidOf(profile, Fz, P, { bevel: 0.6, steps: 72 }), { tone: "mid" }) + engraving, shapes: [R.solid(A.solid(Fz, profile, { name: "stand.plinth", ground: true }))] });
    const [px, py] = post.at;
    const collar = G.frameOf([px, py, top], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const collarProfile = [[0, post.r + 4.3], [2.2, post.r + 4.3], [3, post.r + 3.4], [3.6, post.r + 2]];
    R.put({ name: "stand.collar", at: [px, py, top + 1.8], svg: k.solidSvg(G.solidOf(collarProfile, collar, P), { tone: "mid", inner: k.lineSvg(G.arcOf(collar, 2.2, post.r + 4.3, P), { tone: "faint" }) }), shapes: [R.solid(A.solid(collar, collarProfile, { name: "stand.collar" }))] });
    let z = top;
    while (spec.mountOn.value([px, py, z]) >= 0 && z < 400) z += 0.05;
    const length = z + (post.sink ?? 5) - top - 3.6;
    const postFrame = G.frameOf([px, py, top + 3.6], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    R.put({ name: "stand.post", at: [px, py, top + 3.6 + length / 3], svg: k.solidSvg(G.disc(0, length, post.r, postFrame, P), { tone: "mid" }), shapes: [R.solid(A.disc(postFrame, 0, length, post.r, { name: "stand.post", blend: [spec.name] }))] });
    const painted = B.paint(F, P, { cell, coarse: quick ? 3 : 2, seams: false, smooth: 0.5, toneSmooth: 0.5, jump: 3.5, tones: "overlay", ...paint, ...(v.paint ?? {}) });
    const centre = at(spec.centre ?? G.mul3(G.add3(F.bounds.min, F.bounds.max), 0.5));
    R.put({ name: spec.name, at: spec.centre ?? G.mul3(G.add3(F.bounds.min, F.bounds.max), 0.5), svg: `<g data-part="${spec.name}">${B.fieldSvg(painted, { tone: "hi", tissue })}</g>`, shapes: [R.solid(A.field(F, { name: spec.name }))] });
    for (const extra of v.extras ?? []) {
      const p2 = B.paint(extra.field, P, { cell, coarse: quick ? 3 : 2, seams: false, smooth: 0.5, toneSmooth: 0.5, jump: 3.5, tones: "overlay", ...paint, ...(extra.paint ?? {}) });
      R.put({ name: extra.name, at: extra.at, bias: extra.veil ? 1e4 : 0, veil: extra.veil, svg: extra.veil ? B.veilSvg(p2, { tissue: extra.tissue }) : B.fieldSvg(p2, { tone: "hi", tissue }), shapes: [R.solid(A.field(extra.field, { name: extra.name }))] });
    }
    A.settle(R, P);
    R.items.sort((a, b2) => a.key - b2.key);
    const svg = B.compactSvg(k.figureSvg({ width, height, label: v.label, body: R.items.map((item) => item.svg).join(""), className: `${prefix}-view` }), { tolerance: 0.3 });
    return { key, P, R, svg, centre, painted, ms: Date.now() - t0 };
  }

  if (child) {
    const [key, out] = child.slice(8).split(",");
    const v = view(key);
    let report = "";
    let failed = 0;
    if (auditing) {
      const result = A.audit(v.R, v.P, { organic: true });
      failed = A.failures(result);
      report = A.report(result);
    }
    writeFileSync(out, JSON.stringify({ key, svg: v.svg, centre: v.centre, items: v.R.items.length, rays: v.painted.stats.probes, ms: v.ms, report, failed }));
    return Promise.resolve();
  }
  return (async () => {
    const dir = mkdtempSync(join(tmpdir(), `${prefix}-`));
    const chosen = only ? [only.split("=")[1]] : views.map((v) => v.key);
    const done = await Promise.all(
      chosen.map(
        (key) =>
          new Promise((ok, fail) => {
            const out = join(dir, `${key}.json`);
            const runChild = spawn(process.execPath, [spec.self, `--child=${key},${out}`, ...argv.filter((arg) => arg === "--quick" || arg === "--audit")], { stdio: ["ignore", "inherit", "inherit"] });
            runChild.on("exit", (code) => (code ? fail(new Error(`view ${key} exited ${code}`)) : ok(JSON.parse(readFileSync(out, "utf8")))));
          }),
      ),
    );
    rmSync(dir, { recursive: true, force: true });
    let failed = 0;
    for (const v of done) {
      console.log(`view ${v.key}: ${v.items} items · ${v.rays} rays · ${(v.svg.length / 1024).toFixed(1)} KB · ${(v.ms / 1000).toFixed(1)} s`);
      if (auditing) {
        console.log(`--- view ${v.key}\n${v.report}\n${v.failed ? `view failed: ${v.failed}` : "view passed"}`);
        failed += v.failed;
      }
    }
    if (auditing) {
      console.log(failed ? `audit failed: ${failed} problem${failed === 1 ? "" : "s"}` : "audit passed");
      if (failed) process.exitCode = 1;
    }
    const meta = done.map((v) => views.find((entry) => entry.key === v.key));
    const live = readFileSync(join(SHARED, "live.js"), "utf8").replace("__VIEWS__", JSON.stringify(meta.map((m) => ({ key: m.key, say: m.say })))).replace("__PREFIX__", JSON.stringify(prefix));
    const stack = done.map((v, i) => v.svg.replace("<svg ", `<svg data-view="${i}"${i === 0 ? " data-on" : ""} aria-hidden="${i === 0 ? "false" : "true"}" `)).join("");
    const dots = meta.map((m, i) => `<button type="button" class="sp-dot" data-go="${i}"${i === 0 ? ' aria-current="true"' : ""}${m.square ? " data-square" : ""} aria-label="${m.name}"></button>`).join("");
    const body = `<style>${B.FIELD_CSS}${readFileSync(join(SHARED, "specimen.css"), "utf8")}${spec.css}</style>` + k.plateHtml({
      fig: spec.fig,
      title: spec.title,
      hint: "← → turn",
      readout: meta[0].say,
      keys: spec.keys,
      caption: spec.caption,
      body: `<div class="iso-stage sp-stage" tabindex="0" role="group" aria-roledescription="specimen" aria-label="${spec.aria}">${stack}</div><div class="sp-turn"><button type="button" class="sp-step" data-step="-1" aria-label="Previous view">‹</button>${dots}<button type="button" class="sp-step" data-step="1" aria-label="Next view">›</button></div>`,
    });
    const page = k.pageHtml({ title: spec.title, theme, body, script: kitScript() + live, width: width + 60 });
    const name = only ? `${prefix}-view${theme === "light" ? "-light" : ""}.html` : `${prefix}${theme === "light" ? "-light" : ""}.html`;
    writeFileSync(join(spec.here, name), page);
    console.log(`wrote ${name} · ${(page.length / 1024).toFixed(0)} KB · ${done.length} views · ${((Date.now() - started) / 1000).toFixed(1)} s`);
  })();
}
