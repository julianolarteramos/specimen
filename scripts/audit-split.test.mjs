import assert from "node:assert/strict";
import test from "node:test";
import * as k from "../kit/iso-kit.mjs";
import * as B from "../kit/blob.mjs";
import * as A from "../kit/audit.mjs";

const P = k.fitProjection(k.boxCorners({ x: -30, y: -12, w: 60, d: 24, r: 0 }, 0, 20), 300, 180, { pad: 10 });
const ROUTE = [[-22, 7, 12], [-6, 7, 12], [0, 0, 16], [6, -7, 10], [22, -7, 8]];
const VESSEL = B.vessel(ROUTE, 3);

function scene(roots) {
  const R = A.recorder(P);
  R.put({ name: "bar", at: [0, 0, 10], shapes: [R.solid(A.box([-30, -1, 9], [30, 1, 11], { name: "bar" }))] });
  roots.forEach((root, index) => {
    const F = B.field(root, { name: `vessel#${index}` });
    R.put({ name: `vessel#${index}`, at: F.bounds ? [0, 0, 13] : [0, 0, 13], shapes: [R.solid(A.field(F, { name: `vessel#${index}` }))] });
  });
  const settled = A.settle(R, P);
  return A.depthOrder(R.items, P, { overlaps: settled.overlaps, solved: settled.solved });
}

test("a vessel that runs in front of a bar and then behind it interlocks as one field", () => {
  const order = scene([VESSEL]);
  assert.ok(order.problems.some((p) => p.cycle), JSON.stringify(order.problems));
});

test("split into two pieces at the crossing, each piece orders cleanly", () => {
  const pieces = B.split(VESSEL, [[-6, 8, 30], [6, -8, -10]]);
  assert.equal(pieces.length, 2);
  const order = scene(pieces);
  assert.equal(order.problems.length, 0, JSON.stringify(order.problems));
});

test("a split piece draws no outline along its cut and its seam faces stay inside the field", () => {
  const [left, right] = B.split(VESSEL, [[-6, 8, 30], [6, -8, -10]]).map((root) => B.field(root));
  const whole = B.field(VESSEL);
  for (const p of [[-18, 7, 16], [18, -7, 10], [0, 0, 13]]) assert.ok(Math.abs(Math.min(left.value(p), right.value(p)) - whole.value(p)) < 1e-9);
  const painted = B.paint(left, P, { cell: 0.5 });
  assert.ok(!/z/.test(painted.outline), "the outline of a cut piece is open where it meets the cut");
  assert.ok(/z/.test(painted.coverage));
});
