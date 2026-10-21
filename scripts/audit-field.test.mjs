import assert from "node:assert/strict";
import test from "node:test";
import * as k from "../kit/iso-kit.mjs";
import * as B from "../kit/blob.mjs";
import * as A from "../kit/audit.mjs";
import { tubePieces, tubeSvg } from "../kit/tube.mjs";

const P = k.fitProjection(k.boxCorners({ x: -48, y: -20, w: 96, d: 40, r: 0 }, -4, 30), 320, 200, { pad: 12 });
const BLOCK = { x: -48, y: -6, w: 8, d: 12, r: 0 };
const BODY = B.blend(2, B.ball([0, 0, 12], 12), B.vessel([[4, 9, 14], [6, 12, 22], [6, 13, 30]], 2.2, { mat: "artery" }));

function figure({ tip = -11.5, through = false, standIn = false, organic = true } = {}) {
  const R = A.recorder(P);
  const plate = { x: -48, y: -20, w: 96, d: 40, r: 2 };
  R.put({ name: "stand.plate", at: [0, 0, -2], svg: k.solidSvg(k.slabOf(plate, -4, 4, P, 4), { tone: "mid" }), shapes: [R.solid(A.slab(plate, -4, 4, { name: "stand.plate", ground: true }, 4))] });
  R.put({ name: "stand.block", at: [-44, 0, 10], svg: k.solidSvg(k.slabOf(BLOCK, 0, 20, P, 2), { tone: "mid" }), shapes: [R.solid(A.slab(BLOCK, 0, 20, { name: "stand.block", ground: true }, 2))] });
  const F = B.field(BODY, { name: "heart" });
  const recorded = standIn ? A.field(B.field(B.ball([0, 0, 12], 2)), { name: "heart" }) : A.field(F, { name: "heart" });
  R.put({ name: "heart", at: [0, 0, 12], svg: B.fieldSvg(B.paint(F, P, { cell: 0.6 })), shapes: [R.solid(recorded)] });
  const end = through ? [40, 0, 14] : [tip, 0, 14];
  const route = [[-40, 0, 14], end];
  R.route("vein", route, 1.5, {});
  tubePieces(route, 1.5, P, { maxLength: 12 }).forEach((piece, index) => R.put({ name: `vein:${index}`, at: piece.mid, svg: tubeSvg(piece, { tone: "mid" }), route: "vein", chunk: index, shapes: [A.tube(piece.points, piece.radii)] }));
  A.settle(R, P);
  return { R, result: A.audit(R, P, { organic }) };
}

test("a vessel fused into a field and a tube sunk into its side pass in organic mode", () => {
  const { result } = figure();
  assert.equal(A.failures(result), 0, A.report(result));
});

test("the same sunk tube fails terminals without organic mode", () => {
  const { result } = figure({ organic: false });
  assert.equal(result.terminals.length, 1);
  assert.equal(result.terminals[0].tube, "vein");
});

test("a tube through a field is a pass-through", () => {
  const { result } = figure({ through: true });
  assert.ok(result.clearance.some((c) => c.kind === "through" && c.other === "heart"), A.report(result));
});

test("a tip that stops short of the field's surface is not mounted", () => {
  const { result } = figure({ tip: -13.2 });
  assert.equal(result.terminals.length, 1, A.report(result));
  assert.equal(result.terminals[0].nearest, "heart");
});

test("a solid sunk into a field without a declared blend is sunk, and passes with one", () => {
  const sunk = A.supports([A.slab({ x: -20, y: -20, w: 40, d: 40, r: 0 }, -4, 4, { name: "stand.plate" }), A.field(B.field(B.ball([0, 0, 12], 12)), { name: "heart" }), A.cylinder(0, 0, 2, 0, 4, { name: "post" })], []);
  assert.equal(sunk.sunk.length, 1);
  const declared = A.supports([A.slab({ x: -20, y: -20, w: 40, d: 40, r: 0 }, -4, 4, { name: "stand.plate" }), A.field(B.field(B.ball([0, 0, 12], 12)), { name: "heart" }), A.cylinder(0, 0, 2, 0, 4, { name: "post", blend: ["heart"] })], []);
  assert.equal(declared.sunk.length, 0);
});

test("a tiny field recorded for a drawn organ is caught as a stand-in", () => {
  const { result } = figure({ standIn: true });
  assert.ok(result.cover.some((c) => c.name === "heart"), A.report(result));
});

test("a field steeper than its declared Lipschitz bound is reported", () => {
  const bounds = { min: [-8, -8, -8], max: [8, 8, 8] };
  const steep = A.field(B.field(B.custom((p) => 3 * (Math.hypot(...p) - 5), { bounds })), { name: "steep" });
  const honest = A.field(B.field(B.custom((p) => 3 * (Math.hypot(...p) - 5), { bounds, L: 3 })), { name: "honest" });
  const found = A.lipschitz([steep, honest]);
  assert.deepEqual(found.map((c) => c.name), ["steep"]);
  assert.ok(found[0].slope > 2.9);
  assert.match(A.report({ steep: found }), /lipschitz: 1 field steeper than declared/);
});

test("a field with no bounds is reported", () => {
  const loose = A.field(B.field(B.custom((p) => Math.hypot(...p) - 5)), { name: "loose" });
  assert.deepEqual(A.fieldBounds([loose]).map((c) => c.name), ["loose"]);
  assert.equal(A.failures({ unbounded: A.fieldBounds([loose]) }), 1);
});

test("a moved field keeps its distances and depth", () => {
  const shape = A.field(B.field(B.ball([0, 0, 0], 5)), { name: "ball" });
  const there = A.moved(shape, [10, 0, 0]);
  assert.ok(Math.abs(A.sdf(there, [10, 0, 7]) - 2) < 1e-9);
  assert.deepEqual(A.boundsOf(there).min.map((v) => Math.round(v)), [5, -5, -5]);
});

test("a veil is left out of depth order and cover, and must declare a readable opacity", () => {
  const R = A.recorder(P);
  const heart = B.field(B.ball([0, 0, 12], 10));
  const sac = B.field(B.grow(B.ball([0, 0, 12], 10), 3));
  R.put({ name: "heart", at: [0, 0, 12], svg: B.fieldSvg(B.paint(heart, P, { cell: 0.8 })), shapes: [R.solid(A.field(heart, { name: "heart" }))] });
  R.put({ name: "sac", at: [0, 0, 12], bias: 1e4, veil: { opacity: 0.3 }, svg: B.veilSvg(B.paint(sac, P, { cell: 0.8, tones: "overlay" })), shapes: [R.solid(A.field(sac, { name: "sac" }))] });
  A.settle(R, P);
  const result = A.audit(R, P, { organic: true });
  assert.equal(result.depth.problems.length, 0);
  assert.equal(result.cover.length, 0);
  assert.equal(result.supports.sunk.length, 0);
  assert.equal(result.veiled.length, 0);
  R.items[1].veil = { opacity: 0.9 };
  assert.equal(A.veils(R.items).length, 1);
  R.items[1].veil = true;
  assert.match(A.report({ veiled: A.veils(R.items) }), /veils: 1 veil too opaque/);
});
