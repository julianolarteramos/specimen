import assert from "node:assert/strict";
import test from "node:test";
import * as k from "../kit/iso-kit.mjs";
import * as B from "../kit/blob.mjs";
import * as A from "../kit/audit.mjs";

const P = k.fitProjection(k.boxCorners({ x: -20, y: -20, w: 40, d: 40, r: 0 }, -20, 20), 240, 240, { pad: 10 });

test("balls and round cones are exact distances", () => {
  const F = B.field(B.capsule([0, 0, 0], [10, 0, 0], 3, 1));
  assert.ok(Math.abs(F.value([-5, 0, 0]) - 2) < 1e-9);
  assert.ok(Math.abs(F.value([15, 0, 0]) - 4) < 1e-9);
  const G = B.field(B.ball([1, 2, 3], 4));
  assert.ok(Math.abs(G.value([1, 2, 10]) - 3) < 1e-9);
});

test("an ellipsoid and a smooth blend stay below the true distance", () => {
  const E = B.field(B.ellipsoid([0, 0, 0], [12, 6, 4]));
  for (const p of [[20, 0, 0], [0, 15, 0], [0, 0, 9], [9, 5, 3]]) {
    const d = E.value(p);
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 60; i++) {
      const m = (lo + hi) / 2;
      const q = p.map((v) => v * m);
      if (Math.hypot(q[0] / 12, q[1] / 6, q[2] / 4) > 1) hi = m;
      else lo = m;
    }
    const radial = Math.hypot(...p) * (1 - lo);
    assert.ok(d <= radial + 1e-9, `${p}: ${d} > ${radial}`);
  }
  const a = B.ball([0, 0, 0], 5);
  const b = B.ball([8, 0, 0], 5);
  const smooth = B.field(B.blend(4, a, b));
  const hard = B.field(B.union(a, b));
  for (const p of [[4, 0, 6], [4, 5, 0], [-6, 0, 0], [4, 0, 0]]) assert.ok(smooth.value(p) <= hard.value(p) + 1e-12);
});

test("marching a ray finds the surface nearest the viewer", () => {
  const F = B.field(B.ball([0, 0, 0], 5));
  const cam = B.basisOf(P);
  const t = F.march([0, 0, 0], cam.V);
  assert.ok(Math.abs(t - 5) < 0.01);
  assert.equal(F.march(cam.R.map((v) => v * 50), cam.V), null);
});

test("paint gives nested seamless tone regions inside one outline", () => {
  const F = B.field(B.blend(3, B.ball([0, 0, 0], 8), B.ball([0, 0, 9], 5)));
  const painted = B.paint(F, P, { cell: 0.5 });
  assert.equal(painted.layers.length, 1);
  const { paths } = painted.layers[0];
  assert.ok(paths.seamless);
  assert.equal(paths.fill, paths.shades[0]);
  const box = (d) => A.markupBox(`<path d="${d}"/>`);
  const outer = box(painted.outline);
  for (const d of [...paths.shades.slice(1), paths.top].filter(Boolean)) {
    const inner = box(d);
    assert.ok(inner[0] >= outer[0] - 0.5 && inner[1] >= outer[1] - 0.5 && inner[2] <= outer[2] + 0.5 && inner[3] <= outer[3] + 0.5);
  }
  const svg = B.fieldSvg(painted);
  assert.match(svg, /data-seamless/);
  assert.match(svg, /iso-edge/);
});

test("a lobe in front of another draws an inner contour that fades or lands", () => {
  const cam = B.basisOf(P);
  const front = cam.V.map((v, i) => v * 9 + cam.R[i] * 3);
  const F = B.field(B.union(B.ball([0, 0, 0], 8), B.ball(front, 4)));
  const painted = B.paint(F, P, { cell: 0.5 });
  assert.ok(painted.inner.length >= 1);
  for (const line of painted.inner) assert.ok(line.closed || line.fade.length === 2);
});

test("materials split the surface into tissue layers with a seam", () => {
  const F = B.field(B.blend(1.5, B.ball([0, 0, 0], 8, { mat: "muscle" }), B.capsule([0, 0, 4], [0, 0, 16], 3, 3, { mat: "artery" })));
  const painted = B.paint(F, P, { cell: 0.5 });
  assert.deepEqual(painted.layers.map((layer) => layer.mat), ["muscle", "artery"]);
  assert.ok(painted.seams.length >= 1);
  assert.match(B.fieldSvg(painted, { tissue: { artery: "vessel" } }), /data-tissue="vessel"/);
});

test("fieldSvg draws lines that share a look as one path, and a faded line keeps its hook", () => {
  const hook = [[0, 0], [10, 0], [20, 0], [24, 1], [25, 3], [24, 5], [20, 6]];
  const pieces = B.fadedPieces(hook, [3, 3], "lo", { smooth: 0.2 });
  const middle = pieces.find((piece) => piece.attrs === 'class="iso-line" data-tone="lo"');
  assert.ok(middle && /c/.test(middle.d), "the hook is still a curve");
  const painted = { layers: [], ground: true, tones: null, outline: "M0 0l1 1", coverage: "", seams: [], lineSmooth: 0.2, inner: [
    { points: [[0, 0], [5, 5], [10, 0]], fade: [2, 2], tone: "lo" },
    { points: [[0, 20], [5, 25], [10, 20]], fade: [2, 2], tone: "lo" },
    { points: [[0, 40], [5, 45], [10, 40]], fade: [0, 0], tone: "lo" },
    { points: [[0, 60], [5, 65], [10, 60]], fade: [0, 0], tone: "lo" },
  ] };
  const svg = B.fieldSvg(painted);
  assert.equal((svg.match(/<path class="iso-line" data-tone="lo"/g) ?? []).length, 1);
  assert.equal((svg.match(/data-free="start"/g) ?? []).length, 1);
  assert.equal((svg.match(/<path class="iso-line" data-tone="lo" d="([^"]*)"/)[1].match(/M/g) ?? []).length, 4);
});

test("place moves, turns and scales a field without changing its distances' shape", () => {
  const node = B.place(B.capsule([0, 0, 0], [10, 0, 0], 1, 1), { scale: 0.5, basis: [[0, 1, 0], [-1, 0, 0], [0, 0, 1]], move: [3, 0, 0] });
  const F = B.field(node);
  assert.ok(Math.abs(F.value([3, 2.5, 0]) + 0.5) < 1e-9);
  assert.ok(Math.abs(F.value([3, 2.5, 2]) - 1.5) < 1e-9);
});
