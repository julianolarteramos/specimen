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
import { HEART_PARTS, W as HEART_W } from "../heart/geometry.mjs";
import * as M from "./model.mjs";
import { TEXT } from "./text.mjs";
import { PALETTES, TISSUE, paletteCss } from "./tissue.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const argv = process.argv.slice(2);
const theme = argv.includes("--light") ? "light" : "dark";
const quick = argv.includes("--quick");
const auditing = argv.includes("--audit");
const child = argv.find((arg) => arg.startsWith("--child="));
const only = argv.find((arg) => arg.startsWith("--view="));
const started = Date.now();

export const VIEWS = [32, 47, 62, 77, 92];
const DEFAULT = VIEWS.indexOf(62);
const WIDTH = 540;
const HEIGHT = 720;
const CELL = quick ? 0.7 : 0.45;
const SMOOTH = 0.9;
const PAINT = { cell: CELL, coarse: quick ? 3 : 2, seams: false, smooth: SMOOTH, jump: 1.2, lineSmooth: 0.3, tones: "overlay", toneSmooth: 4, edge: 0.4 };

const PED = { r: 52, z0: 24, z1: 34 };
const PELVIS = { x: -46, y: -26, w: 92, d: 50, r: 10 };
const PELVIS_Z = [34, 40];
const SHELL_Y = [-12, 0];
const HEAD = { c: [0, 268], rx: 31, rz: 35 };

function decimate(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const dx = points[b][0] - ax;
    const dy = points[b][1] - ay;
    const len = Math.hypot(dx, dy);
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = len > 1e-9 ? Math.abs((points[i][0] - ax) * dy - (points[i][1] - ay) * dx) / len : Math.hypot(points[i][0] - ax, points[i][1] - ay);
      if (d > worst) (worst = d), (at = i);
    }
    if (worst > tolerance) (keep[at] = 1), stack.push([a, at], [at, b]);
  }
  return points.filter((_, i) => keep[i]);
}

function figure(azimuth) {
  const t0 = Date.now();
  const P = k.fitProjection(
    [[-46, 24, PELVIS_Z[0] - 4], [46, 24, PELVIS_Z[0] - 4], [-46, -26, PELVIS_Z[0]], [46, -26, PELVIS_Z[0]], [-53, SHELL_Y[0], 304], [53, SHELL_Y[0], 304], [53, 36, 200], [-53, 36, 200], [46, 0, 262]],
    WIDTH,
    HEIGHT,
    { pad: 6, azimuth, elevation: 30 },
  );
  const V = G.viewOf(P);
  const KS = G.scaleOf(P);
  const at = (p) => k.iso(p, P);
  const path3 = (points, closed = false) => k.pathOf(points.map(at), closed);
  const f2 = (v) => Math.round(v * 100) / 100;
  const screenLen = (pts) => {
    let sum = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = at(pts[i - 1]);
      const b = at(pts[i]);
      sum += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    return sum;
  };
  const R = A.recorder(P);
  const record = R.solid;
  const put = (name, ref, svg, shapes = [], { bias = 0, g = "", group } = {}) => R.put({ name, at: ref, bias, svg, shapes, piece: "body", group, g });

  function landOn(shape, from, dir) {
    const d = G.unit3(dir);
    let lo = 0;
    let hi = 1;
    while (A.sdf(shape, G.add3(from, G.mul3(d, hi))) < 0) hi *= 1.6;
    for (let i = 0; i < 48; i++) {
      const mid = (lo + hi) / 2;
      if (A.sdf(shape, G.add3(from, G.mul3(d, mid))) < 0) lo = mid;
      else hi = mid;
    }
    const p = G.add3(from, G.mul3(d, (lo + hi) / 2));
    const e = 1e-3;
    const n = G.unit3([0, 1, 2].map((i) => {
      const a = [...p];
      const b = [...p];
      a[i] += e;
      b[i] -= e;
      return A.sdf(shape, a) - A.sdf(shape, b);
    }));
    return { p, n, out: (len) => G.add3(p, G.mul3(n, len)) };
  }

  const signed = (poly) => poly.reduce((acc, [x, y], i) => {
    const [x2, y2] = poly[(i + 1) % poly.length];
    return acc + x * y2 - x2 * y;
  }, 0);
  const screenOriented = (pts) => (signed(pts) < 0 ? [...pts].reverse() : pts);
  function runsOfFlags(flags, want) {
    const count = flags.length;
    const runs = [];
    const start = flags.findIndex((flag, index) => flag !== flags[(index + count - 1) % count]);
    if (start < 0) return flags[0] === want ? [Array.from({ length: count + 1 }, (_, index) => index % count)] : [];
    let run = null;
    for (let s = 0; s < count; s++) {
      const index = (start + s) % count;
      if (flags[index] === want) {
        if (!run) run = [index];
        run.push((index + 1) % count);
      } else if (run) {
        runs.push(run);
        run = null;
      }
    }
    if (run) runs.push(run);
    return runs;
  }
  function prismPaths(F, poly, s0, s1) {
    const ring = signed(poly) > 0 ? poly : [...poly].reverse();
    const n = ring.length;
    const W3 = (s, [x, y]) => [F.o[0] + F.a[0] * s + F.u[0] * x + F.v[0] * y, F.o[1] + F.a[1] * s + F.u[1] * x + F.v[1] * y, F.o[2] + F.a[2] * s + F.u[2] * x + F.v[2] * y];
    const capNear = G.dot3(F.a, V) > 0;
    const [nearS, farS] = capNear ? [s1, s0] : [s0, s1];
    const near = ring.map((p) => at(W3(nearS, p)));
    const far = ring.map((p) => at(W3(farS, p)));
    const normals = ring.map(([x0, y0], i) => {
      const [x1, y1] = ring[(i + 1) % n];
      return G.unit3(G.add3(G.mul3(F.u, y1 - y0), G.mul3(F.v, -(x1 - x0))));
    });
    const facing = normals.map((m) => G.dot3(m, V) > 1e-9);
    const outline = [];
    const crease = [];
    for (const run of runsOfFlags(facing, false)) outline.push(k.pathOf(run.map((i) => near[i])));
    for (const run of runsOfFlags(facing, true)) {
      crease.push(k.pathOf(run.map((i) => near[i])));
      outline.push(k.pathOf(run.map((i) => far[i])));
    }
    for (let i = 0; i < n; i++) if (facing[(i + n - 1) % n] !== facing[i]) outline.push(k.pathOf([near[i], far[i]]));
    const strip = (run) => k.pathOf(screenOriented([...run.map((i) => near[i]), ...[...run].reverse().map((i) => far[i])]), true);
    const parts = [k.pathOf(screenOriented(near), true), k.pathOf(screenOriented(far), true), ...runsOfFlags(facing, true).map(strip)];
    const buckets = [[], [], [], [], []];
    const tones = normals.map((m, i) => (facing[i] ? G.toneOf(m, P) : -1));
    for (let tone = 0; tone < 4; tone++) for (const run of runsOfFlags(tones.map((t) => t === tone), true)) buckets[tone].push(strip(run));
    buckets[4].push(k.pathOf(screenOriented(near), true));
    return { fill: parts.join(""), outline: outline.join(""), crease: crease.join(""), top: buckets[4].join(""), shades: buckets.slice(0, 4).map((b) => b.join("")) };
  }

  function flowPath(points, offset, ch, dir = 1) {
    const sign = dir > 0 ? "-" : "+";
    return `<path class="en-flow" data-ch="${ch}" style="stroke-dashoffset:calc(${f2(offset)}px ${sign} var(--ph-${ch})*1px)" d="${path3(points)}"/>`;
  }

  const back = [];
  {
    const F = G.frameOf([0, 0, PED.z0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    back.push(`<path class="iso-halo" d="${k.haloOf({ x: -PED.r, y: -PED.r, w: 2 * PED.r, d: 2 * PED.r, r: PED.r }, PED.z0, PED.z1 - PED.z0, P)}"/>`);
    const prof = [[0, PED.r], [2.5, PED.r], [3.4, PED.r - 1.2], [PED.z1 - PED.z0, PED.r - 4]];
    back.push(k.solidSvg(G.solidOf(prof, F, P, { bevel: 0.6, steps: 48 }), { tone: "mid", inner: k.lineSvg(G.arcOf(F, 2.5, PED.r, P), { tone: "faint" }) }));
    record(A.solid(F, prof, { name: "stand.pedestal", ground: true }));
    const screws = [0, 1, 2, 3].map((i) => G.pointOf(F, PED.z1 - PED.z0, PED.r - 10, Math.PI / 4 + (i * Math.PI) / 2));
    back.push(k.dotsSvg(screws.map(at), { size: 0.5 }));
  }

  function chaikin(points, rounds = 2) {
    let pts = points;
    for (let r = 0; r < rounds; r++) {
      const next = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      pts = next;
    }
    return pts;
  }
  const headArc = [];
  for (let deg = 90; deg >= -58; deg -= 8) {
    const a = (deg * Math.PI) / 180;
    headArc.push([HEAD.rx * Math.cos(a), HEAD.c[1] + HEAD.rz * Math.sin(a)]);
  }
  const RIGHT = [...headArc, [13, 236], [12, 229], [27, 224], [41, 218], [49, 208], [52, 193], [52, 180], [46, 177], [43, 160], [39, 138], [36, 120], [39, 100], [42, 80], [41, 58], [39, 44], [37, PELVIS_Z[1]]];
  const ROUND = chaikin([...RIGHT, ...[...RIGHT].reverse().map(([x, z]) => [-x, z]).slice(1, -1)].filter((p, i, all) => i === 0 || Math.hypot(p[0] - all[i - 1][0], p[1] - all[i - 1][1]) > 0.01), 2).map(([x, z]) => [x, Math.max(PELVIS_Z[1], z)]);
  const SIL = decimate([...ROUND, ROUND[0]], 0.3).slice(0, -1);
  const SHELL_F = G.frameOf([0, 0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  record(A.prism(SHELL_F, SIL, SHELL_Y[0], SHELL_Y[1], { name: "stand.torso", ground: true, piece: "body" }));
  {
    const n = ROUND.length;
    const inset = ROUND.map((p, i) => {
      const a = ROUND[(i + n - 1) % n];
      const b = ROUND[(i + 1) % n];
      const t = G.unit3([b[0] - a[0], b[1] - a[1], 0]);
      const s = signed(ROUND) > 0 ? 1 : -1;
      return [p[0] - s * t[1] * 4, p[1] + s * t[0] * 4];
    });
    const inside = (x, z) => {
      let c = false;
      for (let i = 0, j = inset.length - 1; i < inset.length; j = i++) {
        const [xi, zi] = inset[i];
        const [xj, zj] = inset[j];
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
      }
      return c;
    };
    const toWall = (f) => {
      const pts = [];
      for (let u = 0; u <= 1.0001; u += 0.01) {
        const [x, z] = f(u);
        if (!inside(x, z)) {
          const prev = pts[pts.length - 1];
          let lo = 0;
          let hi = 1;
          for (let i = 0; i < 30; i++) {
            const m = (lo + hi) / 2;
            if (inside(prev[0] + (x - prev[0]) * m, prev[1] + (z - prev[1]) * m)) lo = m;
            else hi = m;
          }
          pts.push([prev[0] + (x - prev[0]) * lo, prev[1] + (z - prev[1]) * lo]);
          break;
        }
        pts.push([x, z]);
      }
      return pts;
    };
    const Y0 = 0.02;
    const SPINE = 3.6;
    const spineZ = [70, 238];
    const lines = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const z0 = 196 - i * 9.5;
        lines.push(toWall((u) => [side * (SPINE + u * 80), z0 + 6 * Math.sin(Math.min(1, u * 1.6) * Math.PI * 0.5) - u * u * 30]));
      }
      lines.push(toWall((u) => [side * (SPINE + u * 70), 226 + 6 * u - 10 * u * u]));
      lines.push(toWall((u) => [side * (SPINE + u * 70), 150 + 14 * Math.sin(u * Math.PI * 0.55)]));
      lines.push(toWall((u) => [side * (SPINE + u * 70), 76 + 26 * Math.sin(u * Math.PI * 0.5) - 16 * u * u]));
    }
    const wall = path3(inset.map(([x, z]) => [x, Y0, z]), true) + path3([[-SPINE, Y0, spineZ[0]], [SPINE, Y0, spineZ[0]], [SPINE, Y0, spineZ[1]], [-SPINE, Y0, spineZ[1]]], true);
    const vertebrae = Array.from({ length: 21 }, (_, i) => {
      const z = spineZ[0] + 1 + i * 8;
      return path3(k.roundedPlan({ x: -SPINE + 0.6, y: z, w: 2 * SPINE - 1.2, d: 6.4, r: 1.2 }, 3).map(([x, zz]) => [x, Y0, zz]), true);
    }).join("");
    const inlay = (pts) => path3(chaikin(pts, 3).map(([x, z]) => [x, Y0, z]), true);
    const lungR = [[-12, 214], [-22, 211], [-31, 200], [-36, 180], [-37, 162], [-32, 153], [-20, 156], [-13, 168], [-11, 196]];
    const lungL = lungR.map(([x, z]) => [-x, z]).reverse();
    const liver = [[-37, 149], [-20, 152], [-4, 151], [12, 147], [14, 141], [2, 133], [-18, 126], [-34, 128], [-39, 138]];
    const inlays = `<path class="en-inlay" data-o="lung" d="${inlay(lungR)}${inlay(lungL)}"/><path class="en-inlay" data-o="liver" d="${inlay(liver)}"/>`;
    const bones = lines.map((pts) => path3(decimate(pts, 0.2).map(([x, z]) => [x, Y0, z]))).join("");
    back.push(k.solidSvg(prismPaths(SHELL_F, SIL, SHELL_Y[0], SHELL_Y[1]), { tone: "mid", inner: "" }) + inlays + k.lineSvg(wall, { tone: "lo" }) + k.lineSvg(vertebrae + bones, { tone: "faint" }));
  }
  {
    record(A.slab(PELVIS, PELVIS_Z[0], PELVIS_Z[1] - PELVIS_Z[0], { name: "stand.pelvis", ground: true }, 8));
    back.push(k.solidSvg(k.slabOf(PELVIS, PELVIS_Z[0], PELVIS_Z[1] - PELVIS_Z[0], P, 8, 1), { tone: "mid", inner: k.lineSvg(k.sideSeam(PELVIS, PELVIS_Z[0] + 2.5, P, 8), { tone: "faint" }) }));
    const pins = [[-38, 18], [38, 18]];
    back.push(k.lineSvg(pins.map(([x, y]) => k.ring(x, y, 1.8, PELVIS_Z[1], P, 16)).join(""), { tone: "lo" }), k.dotsSvg(pins.map(([x, y]) => at([x, y, PELVIS_Z[1]])), { size: 0.5 }));
  }

  const arcNear = (route, near) => {
    let best = Infinity;
    let bestS = 0;
    const total = G.pathLength(route);
    for (let s = 0.2; s < total; s += 0.1) {
      const d = G.len3(G.sub3(G.pointAlong(route, s), near));
      if (d < best) (best = d), (bestS = s);
    }
    return bestS;
  };
  const centreOf = (F) => G.mul3(G.add3(F.bounds.min, F.bounds.max), 0.5);
  const fieldSvg = (painted, tone = "hi", keep = [1, 2, 3]) => B.fieldSvg(painted.tones ? { ...painted, tones: painted.tones.map((d, i) => (keep.includes(i) ? d : "")) } : painted, { tone, tissue: TISSUE });
  function organ(name, node, { g = "", mat, wrap, extra = "", blend = ["stand.torso"], paint = {} } = {}) {
    const F = B.field(node, { name, ...(mat ? { mat } : {}) });
    const painted = B.paint(F, P, { ...PAINT, base: mat ?? F.materials[0], ...paint });
    const shape = record(A.field(F, { name, blend }));
    const svg = fieldSvg(painted) + extra;
    put(name, centreOf(F), wrap ? wrap(svg) : svg, [shape], { g });
    return { F, shape, node };
  }
  const ell = (c, r, axes) => B.ellipsoid(c, r, axes ? { axes } : {});
  const arcAt = (cy, cz, ry, rz, a0, a1, x, n = 24) => Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    return [x, cy + ry * Math.cos(a), cz + rz * Math.sin(a)];
  });
  const groove = (points, r) => B.vessel(points, (t) => r * (0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)))));
  const withMat = (node, mat) => (["blend", "union", "carve", "clip", "intersect"].includes(node.op) ? { ...node, of: node.of.map((c, i) => (node.op === "carve" && i === 1 ? c : withMat(c, mat))) } : { ...node, mat });

  function complex(name, members, { blendK = 0.5, blend = [], paint = {} } = {}) {
    const solid = members.filter((m) => !m.core);
    const root = B.blend(blendK, ...solid.map((m) => withMat(m.node, m.mat)));
    const F = B.field(root, { name, cores: members.filter((m) => m.core).map((m) => ({ ...m.node, mat: m.mat })) });
    const base = members[0];
    const painted = B.paint(F, P, { ...PAINT, base: base.mat, banded: [...new Set(members.map((m) => m.mat))].filter((mat) => mat !== base.mat), ...paint });
    const out = {};
    for (const m of members) {
      const layer = painted.layers.find((l) => l.mat === m.mat);
      const mine = m === base || m.mat !== base.mat;
      const own = B.field(m.shape ?? withMat(m.node, m.mat), { name: m.name });
      const piece = m === base ? F : B.field(B.intersect(0, F.root, B.grow(m.shape ?? m.node, m.core ? 0.4 : 1.4)), { name: m.name });
      const shape = record(A.field(piece, { name: m.name, blend: ["stand.torso", ...blend, ...members.map((x) => x.name)] }));
      out[m.key] = { shape, node: m.node };
      if (!layer || !mine) continue;
      const one = { ...painted, layers: [layer], tones: m === base ? painted.tones : null, inner: m === base ? painted.inner : [], outline: m === base ? painted.outline : "", seams: [] };
      let svg = fieldSvg(one);
      if (m !== base) svg = svg.replace(/<path class="iso-line iso-edge"[^>]*\/>/, "");
      put(m.name, centreOf(own), svg + (m.extra ?? ""), [shape], { g: m.g ?? "", bias: m === base ? -0.01 : 0.01, group: name });
    }
    out.F = F;
    return out;
  }

  const HEMI = B.blend(8, ell([-8.5, 14, 270], [19, 23, 17]), ell([-8, 23, 256], [15, 12, 8]), ell([-8, -4, 266], [13, 11, 12]));
  const HEMI_CUT = B.clip(HEMI, [-0.5, 0, 0], [1, 0, 0], 1.2);
  const HEMI_F = B.field(HEMI_CUT);
  let seed = 11;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const WAVES = Array.from({ length: 7 }, () => {
    const z = random() * 2 - 1;
    const t = random() * Math.PI * 2;
    const kk = 0.68 + random() * 0.2;
    return [Math.sqrt(1 - z * z) * Math.cos(t) * kk, Math.sqrt(1 - z * z) * Math.sin(t) * kk, z * kk, random() * Math.PI * 2];
  });
  const gyri = (p) => {
    let n = 0;
    for (const [a, b, c, phase] of WAVES) n += Math.sin(a * p[0] + b * p[1] + c * p[2] + phase);
    n /= Math.sqrt(WAVES.length);
    return Math.max((Math.abs(n) - 0.2) / 2, -(HEMI_F.value(p) + 1.1), p[0] + 2.4);
  };
  const MEDIAL = B.carve(B.carve(HEMI_CUT, B.custom(gyri, { bounds: HEMI_F.bounds, L: 1 }), 0.35), B.union(groove(arcAt(14, 266, 12.8, 8.2, 205, -15, -0.5), 1), groove(arcAt(14, 266, 16.5, 12, 215, -5, -0.5), 0.8)), 0.5);
  const CEREBELLUM_F = B.field(ell([-9, -1, 250], [11, 8.5, 7]));
  const folia = (p) => Math.max(Math.abs(Math.sin(1.3 * (p[2] - 250) + 0.2 * p[1])) * 1.2 - 0.3, -(CEREBELLUM_F.value(p) + 1.2));
  const HYP = { c: [0.2, 18.4, 257.4], r: 2 };
  const POST = { c: [0.3, 19.3, 251.6], r: 1.2 };
  const ANT = { c: [0.3, 21.4, 251.4], r: 1.5 };
  const AMYG = { c: [0.1, 23.6, 254.2], r: 1.6 };
  const flat = G.unit3([V[0], V[1], 0]);
  const CORD_FRONT = [flat[0] * 2.6, 2.6 + flat[1] * 2.6];
  const PORTA = [[0.8, 20.8, 255.6], [1.1, 21.4, 254.2], [0.9, 21.5, 252.8]];
  const JUGULAR_ROOT = G.fillet([[ANT.c[0], ANT.c[1], ANT.c[2] - 1.4], [ANT.c[0] - 0.4, ANT.c[1] + 0.2, ANT.c[2] - 4.5], [-6, 19, 243]], 1.6, 8);
  const CNS = complex("brain", [
    { key: "brain", name: "cns.cerebrum", mat: "brain", g: "cns", node: MEDIAL },
    { key: "callosum", name: "cns.callosum", mat: "callosum", g: "cns", node: B.clip(B.vessel(arcAt(14, 266, 10.5, 6.2, 200, -20, -0.4, 28), (t) => 1.25 + 0.55 * Math.max(0, 1 - 6 * Math.min(t, 1 - t)) ** 2), [-0.1, 0, 0], [1, 0, 0], 0.3) },
    { key: "thalamus", name: "cns.thalamus", mat: "brain", g: "cns", node: ell([-0.6, 13, 261.5], [1.3, 4.6, 3]) },
    { key: "cerebellum", name: "cns.cerebellum", mat: "brain", g: "cns", node: B.carve(ell([-9, -1, 250], [11, 8.5, 7]), B.custom(folia, { bounds: CEREBELLUM_F.bounds, L: 1.6 }), 0.4) },
    { key: "stem", name: "cns.stem", mat: "brain", g: "cns", node: B.capsule([-1.5, 8.5, 258], [0, 2.8, 240.5], 3, 2.6) },
    { key: "hyp", name: "hypothalamus", mat: "hypothalamus", g: "hypothalamus", node: ell(HYP.c, [1.5, 2.6, 1.9]) },
    { key: "stalk", name: "pituitary.stalk", mat: "stalk", g: "pituitary-p", node: B.capsule([0.3, 19.6, 255.6], [0.3, 19.4, 252.4], 0.6, 0.5), extra: flowPath([[0.95, 19.6, 255.4], [0.95, 19.4, 252.6]], 0, "neu") },
    { key: "post", name: "pituitary.posterior", mat: "pituitary-p", g: "pituitary-p", node: B.ball(POST.c, POST.r) },
    { key: "ant", name: "pituitary.anterior", mat: "pituitary-a", g: "pituitary-a", node: ell(ANT.c, [1.4, 1.6, 1.4]) },
    { key: "porta", name: "portal", mat: "portal", g: "hypothalamus", node: B.vessel(PORTA, 0.4), extra: flowPath(PORTA, 0, "crh") },
    { key: "jug", name: "jugular.root", mat: "jugular-root", g: "blood", node: B.vessel(G.resample(G.fillet([[ANT.c[0], ANT.c[1], ANT.c[2] - 1], [ANT.c[0] - 0.4, ANT.c[1] + 0.2, ANT.c[2] - 4.5], [-6, 19, 243]], 1.6, 8), 0.5), 1), extra: flowPath(JUGULAR_ROOT, 0, "acth") },
    { key: "pineal", name: "pineal", mat: "pineal", g: "pineal", node: ell([0.2, 5.6, 263.5], [1, 1.7, 1.1], [[0, -1, 0.35], [1, 0, 0]]) },
    { key: "amyg", name: "cns.amygdala", mat: "brain", g: "cns", node: B.ball(AMYG.c, AMYG.r) },
    { key: "cord", name: "cns.cord", mat: "brain", g: "cns", node: B.capsule([0, 2.6, 241], [0, 2.6, 106], 2.6, 2.4), shape: B.capsule([0, 2.6, 237.5], [0, 2.6, 106], 2.55, 2.4), extra: flowPath([[CORD_FRONT[0], CORD_FRONT[1], 238], [CORD_FRONT[0], CORD_FRONT[1], 112]], 0, "cns") },
  ], { blend: ["jugular*", "carotid*", "afferent*", "vagus*", "sympathetic*"], paint: { jump: 2.6, crease: 80 } });
  const STEM = CNS.stem;
  const CNS_NODE = CNS.F.root;
  const CORD = { x: 0, y: 2.6 };
  const CORD_O = CNS.cord;

  const TRACH = { r: 2.8, z: [199, 233] };
  const RINGS = Array.from({ length: 9 }, (_, i) => {
    const z = TRACH.z[0] + 3 + i * 3.5;
    return B.vessel(Array.from({ length: 21 }, (_, j) => [(TRACH.r + 0.15) * Math.cos((j / 20) * Math.PI * 2), 8 + (TRACH.r + 0.15) * Math.sin((j / 20) * Math.PI * 2), z]), 0.45);
  });
  const THY = { x: 5.4, y: 10.8 };
  complex("neck", [
    { key: "trachea", name: "trachea", mat: "trachea", node: B.carve(B.capsule([0, 8, TRACH.z[0]], [0, 8, TRACH.z[1]], TRACH.r, TRACH.r), B.union(...RINGS), 0.3) },
    { key: "thyroid", name: "thyroid", mat: "thyroid", g: "thyroid", node: B.blend(1.6, B.capsule([-THY.x, THY.y, 208], [-THY.x + 0.6, THY.y, 221], 3.3, 2.2), B.capsule([THY.x, THY.y, 208], [THY.x - 0.6, THY.y, 221], 3.3, 2.2), B.capsule([-THY.x + 1, 11.6, 210.5], [THY.x - 1, 11.6, 210.5], 1.5, 1.5)) },
    { key: "parathyroid", name: "parathyroid", mat: "parathyroid", g: "parathyroid", node: B.union(...[-1, 1].flatMap((side) => [210, 218].map((z) => B.ball([side * (THY.x + 1.2), THY.y - 2.6, z], 0.95)))) },
  ], { blendK: 0.4, blend: ["carotid*", "jugular*", "vagus*", "thymus", "aorta*"] });

  const HEART_C = [6, 22.5, 168];
  const AORTA_ROOT_SKIP = 8;
  const HEART_SCALE = 0.235;
  const HEART_BASIS = [[Math.SQRT1_2, Math.SQRT1_2, 0], [-Math.SQRT1_2, Math.SQRT1_2, 0], [0, 0, 1]];
  const REF = HEART_W([8, 2, -8]);
  const HEART_MOVE = G.sub3(HEART_C, G.mul3([HEART_BASIS[0][0] * REF[0] + HEART_BASIS[1][0] * REF[1], HEART_BASIS[0][1] * REF[0] + HEART_BASIS[1][1] * REF[1], REF[2]], HEART_SCALE));
  const heartPart = (node) => B.place(node, { scale: HEART_SCALE, basis: HEART_BASIS, move: HEART_MOVE });
  const AO = { x: 4.6, y: 7.6, r: 2.4 };
  const AORTA_FULL = G.fillet([[3.5, 21.5, 176], [4.2, 21, 184], [5.5, 19.5, 197.5], [13, 8.6, 197.5], [13, 7.6, 186], [AO.x, AO.y, 172], [AO.x, AO.y, PELVIS_Z[1] + 0.5]], 3, 10, { P, tube: AO.r });
  const HEART_O = organ("heart", B.blend(0.2, B.blend(1.2, heartPart(B.blend(2.5, HEART_PARTS.body, ...HEART_PARTS.auricles)), B.vessel(G.resample(G.cut(AORTA_FULL, 0, AORTA_ROOT_SKIP + 1), 0.4), AO.r, { mat: "oxy" })), ...HEART_PARTS.coronaries.map(heartPart)), { g: "heart", wrap: (svg) => `<g data-part="heart">${svg}</g>`, blend: ["stand.torso", "thymus", "aorta*", "cava*", "jugular*"], paint: { base: "muscle", banded: ["coronary"], quiet: ["coronary"] } });
  const HEART_S = HEART_O.shape;

  const KID = { x: 24, y: 5.8, z: [99, 121] };
  const ADR = {};
  const URETERS = [];
  {
    const AXIS = G.unit3([-0.22, 0.05, 1]);
    const SIDEV = G.unit3(G.cross3([0, 1, 0], AXIS));
    const KAX = [AXIS, SIDEV];
    const kat = (t, l = 0, a = 0) => G.add3(G.add3(G.mul3(AXIS, t), G.mul3(SIDEV, l)), [0, a, 0]);
    const KIDNEY_L = B.carve(B.blend(14, B.ellipsoid(kat(24, 2), [30, 25, 15], { axes: KAX }), B.ellipsoid(kat(-22, 3), [30, 24, 14.5], { axes: KAX }), B.ellipsoid(kat(0, 4), [26, 27, 15.5], { axes: KAX })), B.ellipsoid(kat(0, -27, 2), [17, 13, 12], { axes: KAX }), 7);
    const PELVIS_L = B.union(B.capsule(kat(0, -12, 1), kat(-10, -30, 0), 8, 3.4), B.capsule(kat(-10, -30, 0), kat(-30, -36, 0), 3.4, 3.4));
    const GLAND_L = B.blend(5, B.ellipsoid(kat(61, -7), [22, 11.5, 7.5], { axes: [[0.8, 0, 0.55], [0, 0, 1]] }), B.ellipsoid(kat(56, 8), [15.5, 9, 7], { axes: [[0.9, 0, -0.35], [0, 0, 1]] }));
    const CORE_L = B.ellipsoid(kat(60, -5), [15.5, 6, 5.2], { axes: [[0.8, 0, 0.55], [0, 0, 1]] });
    const SCALE = 0.2;
    for (const side of [-1, 1]) {
      const c = [side * KID.x, KID.y, (KID.z[0] + KID.z[1]) / 2 + (side === -1 ? -7 : 0)];
      const basis = [[side, 0, 0], [0, 1, 0], [0, 0, 1]];
      const put3 = (node) => B.place(node, { scale: SCALE, basis, move: c });
      const at3 = (p) => [c[0] + side * p[0] * SCALE, c[1] + p[1] * SCALE, c[2] + p[2] * SCALE];
      const CUT = [at3(kat(60, -5)), [0, 1, 0]];
      const kid = complex(`kidney${side}`, [
        { key: "kidney", name: `kidney${side}`, mat: "kidney", node: put3(KIDNEY_L) },
        { key: "pelvis", name: `pelvis${side}`, mat: "pelvis", node: put3(PELVIS_L) },
        { key: "cortex", name: `cortex${side}`, mat: "cortex", g: "adrenal-cortex", node: B.clip(put3(GLAND_L), CUT[0], CUT[1], 0.25, { mat: "cortex" }) },
        { key: "medulla", name: `medulla${side}`, mat: "medulla", g: "adrenal-medulla", node: put3(CORE_L), core: true, shape: B.clip(put3(CORE_L), CUT[0], CUT[1], 0.25) },
      ], { blendK: 0.6, blend: ["sympathetic*", "adrenal.artery*", "adrenal.vein*", "ureter*"] });
      ADR[side] = { node: kid.F.root, medial: at3(kat(56, -14))[0], b: at3(kat(49, -6))[2], c: at3(kat(56, 0)) };
      URETERS.push({ side, start: at3(kat(-26, -35, 0)), node: kid.F.root });
    }
  }

  const PANC = { x0: -20, y: 15.6, z: 140 };
  const pancR = (u) => (4.6 - 1.8 * u + 0.4 * Math.sin(u * Math.PI * 3) * (1 - u)) * Math.pow(Math.max(0, 1 - Math.pow(u, 8)), 1 / 8) * (0.55 + 0.45 * Math.pow(Math.max(0, 1 - Math.pow(1 - u, 10)), 1 / 10));
  const PANC_PTS = Array.from({ length: 37 }, (_, i) => [PANC.x0 + i, PANC.y + 1.2 * Math.sin((i / 36) * Math.PI), PANC.z + 2.2 * Math.sin((i / 36) * Math.PI * 1.2) - 1]);
  const PANC_F0 = B.field(B.blend(2.5, B.vessel(PANC_PTS, (t) => Math.max(1.2, pancR(t))), B.ellipsoid([-18.5, 16, 137.5], [4.6, 3.6, 5], {})));
  const lobules = (p) => PANC_F0.value(p) + 0.16 * (Math.sin(1.3 * p[0] + 0.6 * p[2]) * Math.sin(1.2 * p[2] - 0.7 * p[1]) + 0.6 * Math.sin(1.6 * p[1] + 0.9 * p[0]));
  const GUT = complex("pancreas.duodenum", [
    { key: "pancreas", name: "pancreas", mat: "pancreas", g: "pancreas", node: B.custom(lobules, { bounds: { min: PANC_F0.bounds.min.map((v) => v - 1), max: PANC_F0.bounds.max.map((v) => v + 1) }, L: 1.6, mat: "pancreas" }) },
    { key: "duodenum", name: "duodenum", mat: "duodenum", node: B.vessel(G.resample(G.fillet([[-12, 19, 149], [-22, 19, 147], [-26, 17.5, 140], [-25.5, 17, 131], [-17, 16.5, 129], [-8, 16.5, 132]], 4, 10), 0.6), 2.3) },
  ], { blendK: 0.8, blend: ["splenic*", "vagus*"] });
  const PANC_O = GUT.pancreas;

  for (const side of [-1, 1]) organ(`gonad${side}`, ell([side * 16.5, 1.8, 78], [3.4, 3, 4.2], [[side * 0.3, 0, 1], [1, 0, 0]]), { g: "gonads", mat: "gonad", blend: ["stand.torso", "ureter*"] });

  const EAR = { c: [30.2, 2.5, 262] };
  const EAR_O = organ("alarm.ear", B.carve(ell(EAR.c, [1.4, 2.6, 3.4]), B.ball([31.4, 3.2, 261.5], 1.1), 0.5), { g: "alarm", mat: "ear", blend: ["stand.torso", "afferent*"] });

  const NODES = {};
  const ROUTES = {};
  function vessel(name, pts, r, { g = "blood", mat = "vessel", flows = [], bend, segment = 30, into = [], blend = [], route: given, cable = false } = {}) {
    const route = given ?? G.fillet(pts, bend ?? Math.max(2.4, r * 2.6), 10, { P, tube: r });
    const total = G.pathLength(route);
    const whole = B.vessel(G.resample(route, Math.min(0.7, r * 0.5)), r);
    ROUTES[name] = { route };
    NODES[name] = whole;
    const count = Math.max(1, Math.round(total / segment));
    const cuts = Array.from({ length: count + 1 }, (_, i) => (i * total) / count);
    const cutter = into.length ? B.union(...into) : null;
    const inside = cutter ? B.field(cutter) : null;
    let f0 = 0;
    let f1 = total;
    if (inside) {
      while (f0 < total && inside.value(G.pointAlong(route, f0)) < 0) f0 += 0.1;
      while (f1 > f0 && inside.value(G.pointAlong(route, f1)) < 0) f1 -= 0.1;
    }
    for (let i = 0; i < count; i++) {
      const s0 = cuts[i];
      const s1 = cuts[i + 1];
      let node = B.vessel(G.resample(G.cut(route, Math.max(0, s0 - r - 1), Math.min(total, s1 + r + 1)), Math.min(0.7, r * 0.5)), r);
      const walls = [];
      if (i > 0) walls.push(B.halfspace(G.pointAlong(route, s0), G.mul3(G.tangentAlong(route, s0), -1), { seam: true }));
      if (i < count - 1) walls.push(B.halfspace(G.pointAlong(route, s1), G.tangentAlong(route, s1), { seam: true }));
      if (walls.length) node = B.intersect(0, node, ...walls);
      if (cutter && (i === 0 || i === count - 1)) node = B.carve(node, cutter, 0.25);
      const F = B.field(node, { name: `${name}:${i}`, mat });
      const painted = B.paint(F, P, { ...PAINT, base: mat });
      const a0 = Math.max(s0, f0);
      const a1 = Math.min(s1, f1);
      const overlay = a1 - a0 > 0.3 ? flows.map(({ ch, dir = 1 }) => flowPath(G.cut(route, a0, a1), screenLen(G.cut(route, 0, a0)), ch, dir)).join("") : "";
      const shape = record(A.field(F, { name: `${name}:${i}`, blend: [`${name}:${i - 1}`, `${name}:${i + 1}`, ...blend] }));
      put(`${name}:${i}`, G.pointAlong(route, (s0 + s1) / 2), fieldSvg(painted, cable ? "mid" : "hi", cable ? [] : r < 1.2 ? [2] : [1, 2, 3]) + overlay, [shape], { g });
    }
    return route;
  }

  const CAVA = { x: -4.8, y: 7.6, r: 2.4 };
  const VESSEL_BLEND = ["stand.torso", "heart", "thymus"];
  const ADR_Z = { artery: ADR[1].b + 2.2, vein: ADR[-1].b + 3.6 };
  const AORTA_ROUTE = vessel("aorta", null, AO.r, { route: G.cut(AORTA_FULL, AORTA_ROOT_SKIP, G.pathLength(AORTA_FULL)), into: [HEART_O.node], blend: [...VESSEL_BLEND, "carotid*", "adrenal.artery*", "splenic*", "stand.pelvis"], flows: [{ ch: "adr" }, { ch: "acth" }, { ch: "cor" }] });
  const onAorta = (p) => G.pointAlong(AORTA_ROUTE, arcNear(AORTA_ROUTE, p));
  {
    const e = landOn(HEART_S, HEART_C, [-0.75, -0.55, -0.4]);
    vessel("cava", [[CAVA.x, CAVA.y, PELVIS_Z[1] + 0.5], [CAVA.x, CAVA.y, 150], e.out(6), e.p], CAVA.r, { bend: 5, into: [HEART_O.node], blend: [...VESSEL_BLEND, "adrenal.vein*", "stand.pelvis"], flows: [{ ch: "adr" }, { ch: "cor" }] });
  }
  {
    const top = onAorta(G.lerp3([4.2, 21, 184], [5.5, 19.5, 197.5], 0.62));
    const e = landOn(A.field(B.field(B.ball(HYP.c, 1.9))), HYP.c, [1, 0.2, 0.05]);
    vessel("carotid", [top, G.add3(top, [1.6, 1.4, 1.8]), [9, 24.5, 197], [10.5, 18, 207], [10, 17, 236], [8, 18, 254], e.out(2.5), e.p], 0.9, { bend: 3, into: [NODES.aorta, CNS_NODE], blend: ["aorta*", "hypothalamus", "stand.torso", "thyroid", "cns.cerebrum"], flows: [{ ch: "cor" }, { ch: "adr" }] });
  }
  {
    const e = landOn(HEART_S, HEART_C, [-0.8, -0.2, 0.55]);
    vessel("jugular", [[-6, 19, 243], [-11, 16, 234], [-11, 16, 186], e.out(5), e.p], 1, { bend: 3.4, into: [CNS_NODE, HEART_O.node], blend: ["pituitary.anterior", "heart", "stand.torso", "cns.cerebrum", "thymus"], flows: [{ ch: "acth" }] });
  }
  {
    const s = onAorta([AO.x, AO.y, ADR_Z.artery]);
    const art = ADR[1].c;
    vessel("adrenal.artery", [s, [ADR[1].medial, AO.y, ADR_Z.artery + 1.5], [art[0] - 1, 6.8, art[2] + 1]], 0.8, { segment: 20, into: [NODES.aorta, ADR[1].node], blend: ["aorta*", "cortex1", "medulla1", "kidney1", "stand.torso"], flows: [{ ch: "acth" }] });
    const v = ADR[-1].c;
    const cavaRoute = ROUTES.cava.route;
    const onCava = G.pointAlong(cavaRoute, arcNear(cavaRoute, [CAVA.x, CAVA.y, ADR_Z.vein]));
    vessel("adrenal.vein", [[v[0] + 1, v[1], v[2] - 0.5], [ADR[-1].medial, CAVA.y, ADR_Z.vein], onCava], 0.8, { segment: 20, into: [NODES.cava, ADR[-1].node], blend: ["cava*", "cortex-1", "medulla-1", "kidney-1", "stand.torso"], flows: [{ ch: "cor" }, { ch: "adr" }] });
    const a = onAorta([AO.x, AO.y, 131]);
    const b = landOn(PANC_O.shape, [9, PANC.y, PANC.z], [0, 0, -1]);
    vessel("splenic", [a, G.add3(a, [1.2, 2.4, 0]), b.out(2.5), b.p], 0.8, { bend: 2, into: [NODES.aorta, PANC_O.node], blend: ["aorta*", "pancreas", "stand.torso"], flows: [] });
  }
  for (const u of URETERS) vessel(`ureter${u.side}`, [u.start, G.add3(u.start, [-u.side * 1.5, 0.5, -8]), [u.side * 12, 8, 70], [u.side * 9, 9, PELVIS_Z[1] + 9]], 0.75, { g: "", mat: "ureter", segment: 30, bend: 4, into: [u.node], blend: [`kidney${u.side}`, `pelvis${u.side}`, "stand.torso", "aorta*", "cava*", "gonad*"] });

  const GANG = [196, 184, 172, 160, 148, 136, 124, 112];
  const CHAIN = { x: 6.2, y: 1.7 };
  for (const side of [-1, 1]) {
    const at3 = (z) => [side * CHAIN.x, CHAIN.y, z];
    const flowSide = [side * CHAIN.x + flat[0] * 1.2, CHAIN.y + flat[1] * 1.2];
    const chain = organ(`sympathetic.chain${side}`, B.blend(0.6, ...GANG.map((z) => ell(at3(z), [1.3, 1.1, 1.7])), B.capsule(at3(GANG[0]), at3(GANG[GANG.length - 1]), 0.42, 0.42)), { g: "sympathetic", mat: "nerve", blend: ["stand.torso", `sympathetic${side}*`], extra: flowPath([[flowSide[0], flowSide[1], GANG[0]], [flowSide[0], flowSide[1], GANG[GANG.length - 1]]], 0, "nerve") });
    const balls = GANG.map((z) => ({ c: at3(z), o: chain }));
    const g = balls.find((x) => x.c[2] === 124);
    const endZ = ADR[side].b + 4.4;
    const end = ADR[side].c;
    vessel(`sympathetic${side}`, [g.c, G.add3(g.c, [side * 2.5, 0.5, 0]), [ADR[side].medial - side * 3, 3.5, endZ - 2.5], [end[0] - side * 0.5, 4.8, end[2] - 1.8]], 0.5, { g: "sympathetic", mat: "nerve", cable: true, bend: 2, segment: 14, into: [g.o.node, ADR[side].node], blend: [`sympathetic.chain${side}`, `cortex${side}`, `medulla${side}`, "stand.torso", `kidney${side}`], flows: [{ ch: "nerve" }] });
  }
  {
    const e = landOn(PANC_O.shape, [-9, PANC.y, PANC.z], [0, 0, 1]);
    vessel("vagus", [[CORD.x - 1, CORD.y, 232], [-3, CORD.y + 1, 232], [-10, 10.4, 226], [-10, 10.4, 156], e.out(4), e.p], 0.55, { g: "vagus", mat: "nerve", cable: true, bend: 3, segment: 11, into: [CORD_O.node, PANC_O.node], blend: ["cns.cord", "pancreas", "stand.torso", "jugular*", "cava*"], flows: [{ ch: "vag" }] });
  }
  {
    const s = landOn(EAR_O.shape, EAR.c, [-1, 0.4, -0.5]);
    const e = landOn(STEM.shape, [-0.47, 4.6, 246], [1, 0.1, 0]);
    vessel("afferent", [s.p, s.out(2), [20, 6, 247], [8, 5.5, 245.5], e.out(2), e.p], 0.5, { g: "alarm", mat: "nerve", cable: true, bend: 3, segment: 14, into: [EAR_O.node, CNS_NODE], blend: ["alarm.ear", "cns.stem", "cns.cerebrum", "cns.cerebellum", "stand.torso"], flows: [{ ch: "aff" }] });
  }

  const lobe = (side, w) => B.blend(2.4,
    ell([side * 3.1, 27, 186.5], [6.5, 2.6 * w, 1.5], [[side * -0.1, 0, 1], [1, 0, 0]]),
    ell([side * 2.3, 26.4, 195.5], [5.5, 1.8 * w, 1.3], [[side * -0.12, 0, 1], [1, 0, 0]]),
    ell([side * 1.7, 25.4, 203], [3.6, 1.0 * w, 1.0], [[side * -0.1, 0, 1], [1, 0, 0]]),
  );
  const THYMUS_F0 = B.field(B.blend(0.9, lobe(-1, 1), lobe(1, 1.08)));
  const thymusLobules = (p) => THYMUS_F0.value(p) + 0.1 * Math.sin(1.1 * p[0] + 0.5 * p[2]) * Math.sin(0.9 * p[2] + 0.4 * p[1]);
  organ("thymus", B.carve(B.custom(thymusLobules, { bounds: { min: THYMUS_F0.bounds.min.map((v) => v - 1), max: THYMUS_F0.bounds.max.map((v) => v + 1) }, L: 1.2 }), B.union(NODES.aorta, NODES.cava), 0.4), { mat: "thymus", blend: ["heart", "stand.torso", "aorta*", "cava*", "neck", "trachea", "thyroid"] });

  A.settle(R, P, { skip: (a, b) => A.sameRun(a, b) || (Boolean(a.group) && a.group === b.group) });
  R.items.sort((a, b) => a.key - b.key);
  const body = R.items.map((item) => (item.g ? `<g data-g="${item.g}">${item.svg}</g>` : item.svg)).join("");
  const ring = (c, r) => {
    const [x, y] = at(c);
    return `<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(r * KS + 3.2)}"/>`;
  };
  const minus = (c, r) => {
    const [x, y] = at(c);
    const rr = r * KS + 3.2;
    return `<text x="${f2(x + rr + 1.5)}" y="${f2(y - rr + 3)}">−</text>`;
  };
  const brake = `<g data-part="brake" class="en-brake" aria-hidden="true">${ring(HYP.c, HYP.r)}${ring(ANT.c, ANT.r)}${minus(HYP.c, HYP.r)}${minus(ANT.c, ANT.r)}</g>`;
  const waves = `<g data-part="waves" class="en-waves" aria-hidden="true">${[5, 8.5, 12].map((r) => k.fadeLineSvg(Array.from({ length: 41 }, (_, i) => {
    const a = ((-55 + (110 * i) / 40) * Math.PI) / 180;
    return at([EAR.c[0] + 1.5 + r * Math.cos(a), EAR.c[1], EAR.c[2] + r * Math.sin(a)]);
  }), { fade: [6, 6], tone: "hi" })).join("")}</g>`;
  return { azimuth, P, R, body: back.join("") + body + brake + waves, heart: at(HEART_C), items: R.items.length, ms: Date.now() - t0 };
}

function pageFor(lang, views) {
  const T = TEXT[lang];
  const first = only ? 0 : DEFAULT;
  const stack = views.map((v, index) => v.svg.replace("__LABEL__", T.label(v.azimuth - VIEWS[DEFAULT])).replace("<svg ", `<svg data-view="${index}"${index === first ? " data-on" : ""} aria-hidden="${index === first ? "false" : "true"}" `)).join("");
  const dots = views.map((v, index) => `<button type="button" class="en-dot" data-go="${index}"${index === first ? ' aria-current="true"' : ""} aria-label="${T.viewName(v.azimuth - VIEWS[DEFAULT])}"></button>`).join("");
  const data = { views: views.map((v) => ({ azimuth: v.azimuth, heart: v.heart })), first, rows: M.table(), text: T.live };
  const model = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
  const live = readFileSync(join(HERE, "live.js"), "utf8").replace("__MODEL__", model).replace("__DATA__", JSON.stringify(data));
  const css = paletteCss(PALETTES) + readFileSync(join(HERE, "endocrine.css"), "utf8");
  const body = `<style>${B.FIELD_CSS}${css}</style>` + k.plateHtml({
    fig: "Fig 5",
    title: T.title,
    hint: T.hint,
    readout: T.live.rest,
    keys: T.keys,
    caption: T.caption,
    body: `<div class="iso-stage en-stage" tabindex="0" role="group" aria-roledescription="specimen" aria-label="${T.aria}">${stack}</div><div class="en-turn"><button type="button" class="en-step" data-step="-1" aria-label="${T.previous}">‹</button>${dots}<button type="button" class="en-step" data-step="1" aria-label="${T.next}">›</button></div><div class="en-levels">${T.levels.map((name, i) => `<span class="en-level" data-level="${i}"><span>${name}</span><i><b></b></i><output>0${T.live.decimal}00</output></span>`).join("")}</div>`,
  });
  return k.pageHtml({ title: T.title, theme, body, script: kitScript() + live, width: WIDTH + 60 }).replace('<html lang="en">', `<html lang="${lang}">`);
}

if (child) {
  const [azimuth, out] = child.slice(8).split(",");
  const v = figure(Number(azimuth));
  let report = "";
  let failed = 0;
  if (auditing) {
    const result = A.audit(v.R, v.P, { organic: true });
    failed = A.failures(result);
    report = A.report(result);
  }
  const svg = B.compactSvg(k.figureSvg({ width: WIDTH, height: HEIGHT, label: "__LABEL__", body: v.body, className: "en-view" }), { tolerance: 0.3 });
  writeFileSync(out, JSON.stringify({ azimuth: v.azimuth, svg, heart: v.heart, items: v.items, ms: v.ms, report, failed }));
} else {
  await main();
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), "endocrine-"));
  const chosen = only ? [Number(only.split("=")[1])] : VIEWS;
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
    console.log(`view ${v.azimuth}: ${v.items} items · ${(v.svg.length / 1024).toFixed(1)} KB · ${(v.ms / 1000).toFixed(1)} s`);
    if (auditing) {
      console.log(`--- view ${v.azimuth}\n${v.report}\n${v.failed ? `view failed: ${v.failed}` : "view passed"}`);
      failed += v.failed;
    }
  }
  if (auditing) {
    console.log(failed ? `audit failed: ${failed} problem${failed === 1 ? "" : "s"}` : "audit passed");
    if (failed) process.exitCode = 1;
  }
  for (const lang of ["en", "es"]) {
    const page = pageFor(lang, views);
    const name = `endocrine${lang === "es" ? "-es" : ""}${only ? "-view" : ""}${theme === "light" ? "-light" : ""}.html`;
    writeFileSync(join(HERE, name), page);
    console.log(`wrote ${name} · ${(page.length / 1024).toFixed(0)} KB · ${views.length} views · ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
}
