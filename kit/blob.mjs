import { cameraOf, fadeLineSvg } from "./iso-kit.mjs";
import { lightOf, add3, sub3, mul3, dot3, len3, unit3, cross3 } from "./lathe.mjs";

export const BANDS = [0, 0.2, 0.42, 0.62];
const BIG = 1e9;

export function basisOf(P) {
  const { sinA, cosA, sinE, cosE, k } = cameraOf(P);
  return { R: [sinA, -cosA, 0], D: [cosA * sinE, sinA * sinE, -cosE], V: [cosA * cosE, sinA * cosE, sinE], k, origin: P.origin };
}

export function axesOf(axes) {
  if (!axes) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const u = unit3(axes[0]);
  const helper = axes[1] ?? (Math.abs(u[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1]);
  const v = unit3(sub3(helper, mul3(u, dot3(helper, u))));
  return [u, v, cross3(u, v)];
}

export const ball = (c, r, meta = {}) => ({ op: "ball", c, r, ...meta });

export const ellipsoid = (c, r, { axes, ...meta } = {}) => ({ op: "ellipsoid", c, r, axes: axesOf(axes), ...meta });

export const capsule = (a, b, ra, rb = ra, meta = {}) => ({ op: "cone", a, b, ra, rb, ...meta });

export function vessel(points, radius, { k = 0, ...meta } = {}) {
  if (points.length < 2) throw new Error("blob.vessel: a vessel needs two points");
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + len3(sub3(points[i], points[i - 1])));
  const total = lengths[lengths.length - 1] || 1;
  const radiusAt = (i) => (Array.isArray(radius) ? radius[i] : typeof radius === "function" ? radius(lengths[i] / total) : radius);
  const cones = [];
  for (let i = 0; i < points.length - 1; i++) cones.push(capsule(points[i], points[i + 1], radiusAt(i), radiusAt(i + 1), meta));
  const group = (list) => (list.length <= 6 ? (k > 0 ? blend(k, ...list) : union(...list)) : k > 0 ? blend(k, ...chunks(list).map(group)) : union(...chunks(list).map(group)));
  return group(cones);
}

const chunks = (list) => {
  const size = Math.ceil(list.length / Math.min(6, Math.ceil(list.length / 6)));
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export const blend = (k, ...of) => ({ op: "blend", k, of: of.flat(Infinity).filter(Boolean) });

export const union = (...of) => ({ op: "union", of: of.flat(Infinity).filter(Boolean) });

export const carve = (base, cutter, k = 0, meta = {}) => ({ op: "carve", k, of: [base, cutter], ...meta });

export const grow = (base, by) => ({ op: "grow", by, of: [base] });

export const intersect = (k, ...of) => ({ op: "intersect", k, of: of.flat(Infinity).filter(Boolean) });

export const halfspace = (o, n, meta = {}) => ({ op: "half", o, n: unit3(n), ...meta });

export const clip = (base, o, n, k = 0, meta = {}) => ({ op: "clip", k, o, n: unit3(n), of: [base], ...meta });

export const custom = (f, { bounds, L = 1, ...meta } = {}) => ({ op: "custom", f, bounds, L, ...meta });

const smin = (a, b, k) => {
  if (k <= 0) return a < b ? a : b;
  const h = k - Math.abs(a - b);
  const m = a < b ? a : b;
  return h > 0 ? m - (h * h * 0.25) / k : m;
};

function leafOf(node) {
  if (node.op === "ball") {
    const [cx, cy, cz] = node.c;
    const r = node.r;
    return { fn: (x, y, z) => Math.hypot(x - cx, y - cy, z - cz) - r, box: [node.c.map((v) => v - r), node.c.map((v) => v + r)], sphere: [node.c, r] };
  }
  if (node.op === "ellipsoid") {
    const [cx, cy, cz] = node.c;
    const [[ux, uy, uz], [vx, vy, vz], [wx, wy, wz]] = node.axes;
    const [ra, rb, rc] = node.r;
    const least = Math.min(ra, rb, rc);
    const extent = [0, 1, 2].map((i) => Math.hypot(node.axes[0][i] * ra, node.axes[1][i] * rb, node.axes[2][i] * rc));
    return {
      fn: (x, y, z) => {
        const px = x - cx;
        const py = y - cy;
        const pz = z - cz;
        return (Math.hypot((px * ux + py * uy + pz * uz) / ra, (px * vx + py * vy + pz * vz) / rb, (px * wx + py * wy + pz * wz) / rc) - 1) * least;
      },
      box: [node.c.map((v, i) => v - extent[i]), node.c.map((v, i) => v + extent[i])],
      sphere: [node.c, Math.max(ra, rb, rc)],
    };
  }
  if (node.op === "cone") {
    const [ax, ay, az] = node.a;
    const bax = node.b[0] - ax;
    const bay = node.b[1] - ay;
    const baz = node.b[2] - az;
    const r1 = node.ra;
    const r2 = node.rb;
    const l2 = bax * bax + bay * bay + baz * baz || 1e-12;
    const rr = r1 - r2;
    const a2 = l2 - rr * rr;
    const il2 = 1 / l2;
    const sr = Math.sign(rr);
    const mid = mul3(add3(node.a, node.b), 0.5);
    const big = Math.max(r1, r2);
    return {
      fn: (x, y, z) => {
        const pax = x - ax;
        const pay = y - ay;
        const paz = z - az;
        const yy = pax * bax + pay * bay + paz * baz;
        const zz = yy - l2;
        const qx = pax * l2 - bax * yy;
        const qy = pay * l2 - bay * yy;
        const qz = paz * l2 - baz * yy;
        const x2 = qx * qx + qy * qy + qz * qz;
        const y2 = yy * yy * l2;
        const z2 = zz * zz * l2;
        const k = sr * rr * rr * x2;
        if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
        if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
        return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
      },
      box: [[0, 1, 2].map((i) => Math.min(node.a[i] - r1, node.b[i] - r2)), [0, 1, 2].map((i) => Math.max(node.a[i] + r1, node.b[i] + r2))],
      sphere: [mid, Math.sqrt(l2) / 2 + big],
    };
  }
  if (node.op === "half") {
    const [ox, oy, oz] = node.o;
    const [nx, ny, nz] = node.n;
    return { fn: (x, y, z) => (x - ox) * nx + (y - oy) * ny + (z - oz) * nz, box: [[-BIG, -BIG, -BIG], [BIG, BIG, BIG]], sphere: [node.o, BIG] };
  }
  if (node.op === "custom") {
    const { min, max } = node.bounds ?? { min: [-BIG, -BIG, -BIG], max: [BIG, BIG, BIG] };
    const centre = mul3(add3(min, max), 0.5);
    return { fn: (x, y, z) => node.f([x, y, z]), box: [min, max], sphere: [centre, len3(sub3(max, min)) / 2] };
  }
  throw new Error(`blob: unknown primitive ${node.op}`);
}

function enclose(spheres, grow = 0) {
  const min = [0, 1, 2].map((i) => Math.min(...spheres.map(([c, r]) => c[i] - r)));
  const max = [0, 1, 2].map((i) => Math.max(...spheres.map(([c, r]) => c[i] + r)));
  const centre = mul3(add3(min, max), 0.5);
  return [centre, Math.max(...spheres.map(([c, r]) => len3(sub3(c, centre)) + r)) + grow];
}

function compile(node, ctx, reach, cutter, parent) {
  const index = ctx.nodes.length;
  const entry = { parent, reach, cutter, sphere: null, leaf: null };
  ctx.nodes.push(entry);
  const bits = ctx.bits;
  const done = (full, masked, sphere) => {
    entry.sphere = sphere;
    return { full, masked, sphere, index };
  };
  if (node.op === "clip" || node.op === "carve") {
    const k = node.k;
    const base = compile(node.of[0], ctx, reach + k, cutter, index);
    if (node.op === "clip") {
      const [ox, oy, oz] = node.o;
      const [nx, ny, nz] = node.n;
      const plane = (x, y, z) => (x - ox) * nx + (y - oy) * ny + (z - oz) * nz;
      if (node.mat) ctx.planes.push({ plane, mat: node.mat, index });
      return done((x, y, z) => -smin(-base.full(x, y, z), -plane(x, y, z), k), (x, y, z) => -smin(-base.masked(x, y, z), -plane(x, y, z), k), base.sphere);
    }
    const cut = compile(node.of[1], ctx, reach + k, true, index);
    const ci = cut.index;
    if (node.mat) ctx.planes.push({ plane: cut.full, mat: node.mat, index });
    return done((x, y, z) => -smin(-base.full(x, y, z), cut.full(x, y, z), k), (x, y, z) => (bits.v[ci] ? -smin(-base.masked(x, y, z), cut.masked(x, y, z), k) : base.masked(x, y, z)), base.sphere);
  }
  if (node.op === "grow") {
    const by = node.by;
    const base = compile(node.of[0], ctx, reach + Math.max(0, by), cutter, index);
    const [c, r] = base.sphere;
    return done((x, y, z) => base.full(x, y, z) - by, (x, y, z) => base.masked(x, y, z) - by, [c, r + Math.max(0, by)]);
  }
  if (node.op === "intersect") {
    const k = node.k;
    const kids = node.of.map((child) => compile(child, ctx, reach + k, cutter, index));
    const full = kids.map((kid) => kid.full);
    const masked = kids.map((kid) => kid.masked);
    const fold = (list) => (x, y, z) => {
      let d = -list[0](x, y, z);
      for (let i = 1; i < list.length; i++) d = smin(d, -list[i](x, y, z), k);
      return -d;
    };
    return done(fold(full), fold(masked), kids[0].sphere);
  }
  if (node.op === "blend" || node.op === "union") {
    const k = node.op === "union" ? 0 : node.k;
    const kids = node.of.map((child) => compile(child, ctx, reach + k, cutter, index));
    if (!kids.length) return done(() => BIG, () => BIG, [[0, 0, 0], 0]);
    const full = kids.map((kid) => kid.full);
    const masked = kids.map((kid) => kid.masked);
    const ids = Int32Array.from(kids.map((kid) => kid.index));
    const n = kids.length;
    const fullFold =
      n === 1
        ? full[0]
        : (x, y, z) => {
            let d = full[0](x, y, z);
            for (let i = 1; i < n; i++) d = smin(d, full[i](x, y, z), k);
            return d;
          };
    const maskedFold = (x, y, z) => {
      const on = bits.v;
      let d = BIG;
      for (let i = 0; i < n; i++) {
        if (!on[ids[i]]) continue;
        const v = masked[i](x, y, z);
        d = d === BIG ? v : smin(d, v, k);
      }
      return d;
    };
    return done(fullFold, maskedFold, enclose(kids.map((kid) => kid.sphere), k * 0.25));
  }
  const leaf = leafOf(node);
  if (node.seam) ctx.seams.push(leaf.fn);
  entry.leaf = { ...leaf, node, mat: node.mat ?? ctx.mat, L: node.L ?? 1 };
  if (node.op === "half") entry.cutter = true;
  ctx.leaves.push({ ...entry.leaf, index, reach, cutter: cutter || node.op === "half" });
  return done(leaf.fn, leaf.fn, leaf.sphere);
}

export function field(root, { L, steps = 600, mat = "tissue", name, mix = null, cores = [] } = {}) {
  const node = typeof root === "function" ? custom(root, {}) : root;
  const bits = { v: null };
  const ctx = { leaves: [], nodes: [], bits, mat, planes: [], seams: [] };
  const compiled = compile(node, ctx, 0, false, -1);
  const { leaves, nodes } = ctx;
  bits.v = new Uint8Array(nodes.length).fill(1);
  const solid = leaves.filter((leaf) => !leaf.cutter);
  const swell = Math.max(0, ...leaves.map((leaf) => leaf.reach)) * 0.25 + 1e-3;
  const bounds = solid.length
    ? { min: [0, 1, 2].map((i) => Math.min(...solid.map((leaf) => leaf.box[0][i])) - swell), max: [0, 1, 2].map((i) => Math.max(...solid.map((leaf) => leaf.box[1][i])) + swell) }
    : null;
  const materials = [...new Set(solid.map((leaf) => leaf.mat))];
  const base = materials.length;
  const faces = ctx.planes.map((face) => {
    if (!materials.includes(face.mat)) materials.push(face.mat);
    return { ...face, m: materials.indexOf(face.mat) };
  });
  const inner = cores.map((core) => {
    const fn = compile(core, { leaves: [], nodes: [], bits: { v: new Uint8Array(4096).fill(1) }, mat, planes: [], seams: [] }, 0, false, -1).full;
    if (!materials.includes(core.mat)) materials.push(core.mat);
    return { fn, m: materials.indexOf(core.mat) };
  });
  const matOf = leaves.map((leaf) => Math.max(0, materials.indexOf(leaf.mat)));
  const blends = new Map();
  if (mix)
    for (const [a, b, own = {}] of mix.pairs ?? []) {
      const ia = materials.indexOf(a);
      const ib = materials.indexOf(b);
      if (ia < 0 || ib < 0) continue;
      const steps = own.steps ?? mix.steps ?? 3;
      const ids = [];
      for (let step = 1; step <= steps; step++) {
        ids.push(materials.length);
        materials.push(`${a}~${b}~${step}~${steps}`);
      }
      const pair = { a: ia, b: ib, ids, width: own.width ?? mix.width ?? 3, bias: own.bias ?? mix.bias ?? 0 };
      blends.set(ia * 256 + ib, pair);
      blends.set(ib * 256 + ia, pair);
    }
  const lipschitz = L ?? Math.max(1, ...leaves.map((leaf) => leaf.L));
  const F = {
    kind: "blob",
    name,
    root: node,
    leaves,
    materials,
    L: lipschitz,
    steps,
    bounds,
    v: compiled.full,
    vm: (x, y, z) => (bits.v[compiled.index] ? compiled.masked(x, y, z) : BIG),
    value: (p) => compiled.full(p[0], p[1], p[2]),
  };
  F.unmask = () => bits.v.fill(1);
  const seams = ctx.seams;
  F.seamAt = (x, y, z, eps = 0.06) => seams.some((fn) => Math.abs(fn(x, y, z)) < eps);
  F.seamed = seams.length > 0;
  const spheres = nodes.map((entry) => entry.sphere);
  F.rayMask = (c, V) => {
    let t0 = BIG;
    let t1 = -BIG;
    const on = bits.v;
    for (let i = 0; i < nodes.length; i++) {
      const entry = nodes[i];
      if (entry.parent >= 0 && !on[entry.parent]) {
        on[i] = 0;
        continue;
      }
      const [[sx, sy, sz], sr] = spheres[i];
      const wx = sx - c[0];
      const wy = sy - c[1];
      const wz = sz - c[2];
      const along = wx * V[0] + wy * V[1] + wz * V[2];
      const perp = wx * wx + wy * wy + wz * wz - along * along;
      const reach = sr + entry.reach + 0.05;
      const hit = perp <= reach * reach;
      on[i] = hit ? 1 : 0;
      if (hit && entry.leaf && !entry.cutter) {
        const half = Math.sqrt(Math.max(0, reach * reach - perp)) + 0.05;
        t0 = Math.min(t0, along - half);
        t1 = Math.max(t1, along + half);
      }
    }
    return t1 > t0 ? [t0, t1] : null;
  };
  F.march = (c, V, eps = 0.005, span = null, track = null) => {
    const own = F.rayMask(c, V);
    if (!own) return null;
    const lo = span ? Math.max(own[0], span[0]) : own[0];
    let t = span ? Math.min(own[1], span[1]) : own[1];
    const step = 1 / lipschitz;
    for (let i = 0; i < steps; i++) {
      const d = F.vm(c[0] + V[0] * t, c[1] + V[1] * t, c[2] + V[2] * t);
      if (track && d < track.least) track.least = d;
      if (d < eps) return t;
      t -= Math.max(d * step, eps * 0.5);
      if (t < lo - eps) return null;
    }
    return null;
  };
  F.gradient = (x, y, z, h = 0.01, masked = false) => {
    const f = masked ? F.vm : compiled.full;
    return [(f(x + h, y, z) - f(x - h, y, z)) / (2 * h), (f(x, y + h, z) - f(x, y - h, z)) / (2 * h), (f(x, y, z + h) - f(x, y, z - h)) / (2 * h)];
  };
  F.normal = (x, y, z, masked = false) => unit3(F.gradient(x, y, z, 0.01, masked));
  const nearest = new Float64Array(base);
  F.material = (x, y, z, masked = false) => {
    let best = BIG;
    let index = 0;
    const on = bits.v;
    for (const face of faces)
      if ((!masked || on[face.index]) && Math.abs(face.plane(x, y, z)) < 0.08) {
        for (const core of inner) if (core.fn(x, y, z) < 0) return core.m;
        return face.m;
      }
    if (blends.size) nearest.fill(BIG);
    for (let i = 0; i < leaves.length; i++) {
      if (leaves[i].cutter || (masked && !on[leaves[i].index])) continue;
      const d = leaves[i].fn(x, y, z);
      if (d < best) (best = d), (index = i);
      if (blends.size && d < nearest[matOf[i]]) nearest[matOf[i]] = d;
    }
    const first = matOf[index];
    if (!blends.size) return first;
    let second = -1;
    for (let m = 0; m < base; m++) if (m !== first && (second < 0 || nearest[m] < nearest[second])) second = m;
    const pair = second >= 0 && blends.get(first * 256 + second);
    if (!pair) return first;
    const share = Math.max(0, Math.min(1, 0.5 + (nearest[pair.a] - nearest[pair.b] - pair.bias) / pair.width));
    const step = Math.round(share * (pair.ids.length + 1));
    return step <= 0 ? pair.a : step > pair.ids.length ? pair.b : pair.ids[step - 1];
  };
  return F;
}

function screenBoxOf(F, cam) {
  const { min, max } = F.bounds;
  let box = [BIG, BIG, -BIG, -BIG];
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]])
      for (const z of [min[2], max[2]]) {
        const sx = cam.origin[0] + (x * cam.R[0] + y * cam.R[1] + z * cam.R[2]) * cam.k;
        const sy = cam.origin[1] + (x * cam.D[0] + y * cam.D[1] + z * cam.D[2]) * cam.k;
        box = [Math.min(box[0], sx), Math.min(box[1], sy), Math.max(box[2], sx), Math.max(box[3], sy)];
      }
  return box;
}

const CASES = { 1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[0, 1]], 6: [[0, 2]], 7: [[3, 0]], 8: [[3, 0]], 9: [[0, 2]], 11: [[0, 1]], 12: [[3, 1]], 13: [[2, 1]], 14: [[3, 2]] };

function chain(links, points) {
  const seen = new Set();
  const out = [];
  const walk = (start) => {
    const line = [];
    let previous = -1;
    let current = start;
    while (current !== undefined && !seen.has(current)) {
      seen.add(current);
      line.push(current);
      const next = (links.get(current) ?? []).find((id) => id !== previous && !seen.has(id));
      previous = current;
      current = next;
    }
    const last = line[line.length - 1];
    const closed = line.length > 2 && (links.get(last) ?? []).includes(start);
    return { ids: line, points: line.map((id) => points.get(id)), closed };
  };
  for (const [id, list] of links) if (list.length === 1 && !seen.has(id)) out.push(walk(id));
  for (const id of links.keys()) if (!seen.has(id)) out.push(walk(id));
  return out;
}

function areaOf(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

function insidePolygon(points, [x, y]) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy) || 1e-9;
    let worst = -1;
    let index = -1;
    for (let i = a + 1; i < b; i++) {
      const off = Math.abs((points[i][0] - ax) * dy - (points[i][1] - ay) * dx) / length;
      if (off > worst) (worst = off), (index = i);
    }
    if (worst > tolerance) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function keepIndices(points, tolerance) {
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy) || 1e-9;
    let worst = -1;
    let index = -1;
    for (let i = a + 1; i < b; i++) {
      const off = Math.abs((points[i][0] - ax) * dy - (points[i][1] - ay) * dx) / length;
      if (off > worst) (worst = off), (index = i);
    }
    if (worst > tolerance) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return keep;
}

export function fitRing(ring, tolerance) {
  const n = ring.length;
  if (n < 4) return curvePath(ring, true);
  const loop = [...ring, ring[0]];
  const keep = keepIndices(loop, tolerance / 3);
  const index = [];
  for (let i = 0; i < n; i++) if (keep[i]) index.push(i);
  if (index.length < 3) return curvePath(simplifyRing(ring, tolerance), true);
  const tangent = (i) => {
    const a = ring[(i - 2 + n) % n];
    const b = ring[(i + 2) % n];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  };
  let cx = tenth(ring[index[0]][0]);
  let cy = tenth(ring[index[0]][1]);
  const parts = [`M${joinNumbers([numOf(cx), numOf(cy)])}c`];
  const segs = [];
  for (let k = 0; k < index.length; k++) {
    const i = index[k];
    const j = index[(k + 1) % index.length];
    const p1 = ring[i];
    const p2 = ring[j];
    let span = 0;
    for (let m = i; m !== j; m = (m + 1) % n) span += Math.hypot(ring[(m + 1) % n][0] - ring[m][0], ring[(m + 1) % n][1] - ring[m][1]);
    const t1 = tangent(i);
    const t2 = tangent(j);
    const h = span / 3;
    const values = [p1[0] + t1[0] * h, p1[1] + t1[1] * h, p2[0] - t2[0] * h, p2[1] - t2[1] * h, p2[0], p2[1]];
    const out = [];
    for (let v = 0; v < 6; v += 2) out.push(numOf(tenth(values[v]) - cx), numOf(tenth(values[v + 1]) - cy));
    segs.push(joinNumbers(out));
    cx = tenth(p2[0]);
    cy = tenth(p2[1]);
  }
  return parts[0] + segs.join(" ") + "z";
}

function simplifyRing(ring, tolerance) {
  let far = 0;
  let best = -1;
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]);
    if (d > best) (best = d), (far = i);
  }
  const one = simplify(ring.slice(0, far + 1), tolerance);
  const two = simplify([...ring.slice(far), ring[0]], tolerance);
  return [...one.slice(0, -1), ...two.slice(0, -1)];
}

const tenth = (v) => Math.round(v * 10);

const numOf = (tenths) => {
  const text = (tenths / 10).toFixed(1).replace(/\.0$/, "").replace(/^(-?)0\./, "$1.");
  return text === "-0" ? "0" : text;
};

const joinNumbers = (values) => values.reduce((out, value, index) => out + (index && !value.startsWith("-") ? " " : "") + value, "");

export function curvePath(points, closed) {
  const n = points.length;
  if (n < 2) return "";
  let cx = tenth(points[0][0]);
  let cy = tenth(points[0][1]);
  const start = [cx, cy];
  const parts = [`M${joinNumbers([numOf(cx), numOf(cy)])}`];
  const rel = (list) => {
    const out = [];
    for (let i = 0; i < list.length; i += 2) out.push(numOf(tenth(list[i]) - cx), numOf(tenth(list[i + 1]) - cy));
    return out;
  };
  if (n === 2 && !closed) {
    parts.push(`l${joinNumbers(rel(points[1]))}`);
    return parts.join("");
  }
  const at = (i) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
  const count = closed ? n : n - 1;
  const segments = [];
  for (let i = 0; i < count; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const d01 = !closed && i === 0 ? 0 : dist(p0, p1);
    const d12 = dist(p1, p2);
    const d23 = !closed && i === count - 1 ? 0 : dist(p2, p3);
    const t1 = d01 ? [(p2[0] - p0[0]) / (d01 + d12), (p2[1] - p0[1]) / (d01 + d12)] : [(p2[0] - p1[0]) / d12, (p2[1] - p1[1]) / d12];
    const t2 = d23 ? [(p3[0] - p1[0]) / (d12 + d23), (p3[1] - p1[1]) / (d12 + d23)] : [(p2[0] - p1[0]) / d12, (p2[1] - p1[1]) / d12];
    const values = rel([p1[0] + (t1[0] * d12) / 3, p1[1] + (t1[1] * d12) / 3, p2[0] - (t2[0] * d12) / 3, p2[1] - (t2[1] * d12) / 3, p2[0], p2[1]]);
    segments.push(joinNumbers(values));
    cx = tenth(p2[0]);
    cy = tenth(p2[1]);
  }
  parts.push(`c${segments.join(" ")}`);
  if (closed) {
    cx = start[0];
    cy = start[1];
  }
  return parts.join("") + (closed ? "z" : "");
}

function nearestOn(lines, p) {
  let best = { d: BIG, at: null };
  for (const line of lines) {
    const pts = line.points;
    const count = line.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < count; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const span = dx * dx + dy * dy;
      const t = span > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / span)) : 0;
      const q = [a[0] + dx * t, a[1] + dy * t];
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < best.d) best = { d, at: q, line };
    }
  }
  return best;
}

export function paint(F, P, { cell = 0.4, coarse = 3, pad = 3, eps = 0.004, light, jump = 1.2, crease = 55, refine = 7, smooth = 0.2, fade = 7, least = 0.15, seams: withSeams = true, edge = 0.2, tones = "layers", toneSmooth, base = null, banded = [], quiet = banded } = {}) {
  if (!F.bounds) throw new Error("blob.paint: the field has no bounds");
  const started = Date.now();
  const cam = basisOf(P);
  const L = unit3(light ?? lightOf(P));
  const [R, D, V] = [cam.R, cam.D, cam.V];
  const [ox, oy] = cam.origin;
  const box = screenBoxOf(F, cam);
  const x0 = Math.floor((box[0] - pad) / cell) * cell;
  const y0 = Math.floor((box[1] - pad) / cell) * cell;
  const C = Math.max(1, Math.round(coarse));
  const nx = Math.ceil((box[2] + pad - x0) / cell / C) * C + 1;
  const ny = Math.ceil((box[3] + pad - y0) / cell / C) * C + 1;
  let probes = 0;
  const probe = (x, y) => {
    probes++;
    const u = (x - ox) / cam.k;
    const v = (y - oy) / cam.k;
    const c = [R[0] * u + D[0] * v, R[1] * u + D[1] * v, R[2] * u + D[2] * v];
    const t = F.march(c, V, eps);
    if (t === null) return { hit: false };
    const p = [c[0] + V[0] * t, c[1] + V[1] * t, c[2] + V[2] * t];
    const n = F.normal(p[0], p[1], p[2], true);
    return { hit: true, t, n, p, score: dot3(n, L), mat: F.materials.length > 1 ? F.material(p[0], p[1], p[2], true) : 0 };
  };
  const grid = new Array(nx * ny).fill(null);
  const real = (i, j) => grid[j * nx + i] ?? (grid[j * nx + i] = probe(x0 + i * cell, y0 + j * cell));
  const cx = (nx - 1) / C;
  const cy = (ny - 1) / C;
  for (let J = 0; J <= cy; J++) for (let I = 0; I <= cx; I++) real(I * C, J * C);
  const coarseHit = (I, J) => I >= 0 && J >= 0 && I <= cx && J <= cy && grid[J * C * nx + I * C].hit;
  const near = (I, J) => {
    for (let b = J - 1; b <= J + 2; b++) for (let a = I - 1; a <= I + 2; a++) if (coarseHit(a, b)) return true;
    return false;
  };
  const MISS = { hit: false };
  const level = (r) => {
    let band = 0;
    while (band < BANDS.length && r.score >= BANDS[band]) band++;
    return band;
  };
  const turnOf = (a, b) => (Math.acos(Math.max(-1, Math.min(1, dot3(a.n, b.n)))) * 180) / Math.PI;
  const plan = [];
  for (let J = 0; J < cy; J++)
    for (let I = 0; I < cx; I++) {
      const corners = [[I, J], [I + 1, J], [I + 1, J + 1], [I, J + 1]].map(([a, b]) => grid[b * C * nx + a * C]);
      const [a] = corners;
      if (!near(I, J)) plan.push([I, J, "miss"]);
      else if (corners.every((r) => r.hit && r.mat === a.mat && level(r) === level(a) && Math.abs(r.t - a.t) < jump * 0.6 && turnOf(r, a) < 14)) plan.push([I, J, "fill", corners]);
      else plan.push([I, J, "probe"]);
    }
  for (const [I, J, kind] of plan) if (kind === "probe") for (let b = J * C; b <= J * C + C; b++) for (let a = I * C; a <= I * C + C; a++) real(a, b);
  for (const [I, J, kind, corners] of plan) {
    if (kind === "probe") continue;
    for (let b = J * C; b <= J * C + C; b++)
      for (let a = I * C; a <= I * C + C; a++) {
        const id = b * nx + a;
        if (grid[id]) continue;
        if (kind === "miss") {
          grid[id] = MISS;
          continue;
        }
        const u = (a - I * C) / C;
        const v = (b - J * C) / C;
        const w = [(1 - u) * (1 - v), u * (1 - v), u * v, (1 - u) * v];
        const mix = (key) => corners.reduce((sum, r, n) => sum + r[key] * w[n], 0);
        grid[id] = { hit: true, t: mix("t"), score: mix("score"), mat: corners[0].mat, n: corners[0].n };
      }
  }
  F.unmask();
  const pos = (i, j) => [x0 + i * cell, y0 + j * cell];
  const centres = new Map();
  const centreOf = (i, j) => {
    const id = j * nx + i;
    if (!centres.has(id)) centres.set(id, probe(x0 + (i + 0.5) * cell, y0 + (j + 0.5) * cell));
    return centres.get(id);
  };
  const edgeEnds = (id) => {
    const cellId = id >> 1;
    const i = cellId % nx;
    const j = (cellId - i) / nx;
    return id & 1 ? [[i, j], [i, j + 1]] : [[i, j], [i + 1, j]];
  };
  const bisect = (a, b, ra, rb, test) => {
    let pa = a;
    let pb = b;
    let qa = ra;
    let qb = rb;
    for (let step = 0; step < refine; step++) {
      const m = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
      const rm = probe(m[0], m[1]);
      if (test(rm, qa, qb)) (pa = m), (qa = rm);
      else (pb = m), (qb = rm);
    }
    return { at: [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2], a: qa, b: qb };
  };
  const region = (inside) => {
    const flags = new Uint8Array(nx * ny);
    let any = false;
    for (let n = 0; n < nx * ny; n++) if (inside(grid[n])) (flags[n] = 1), (any = true);
    if (!any) return [];
    const points = new Map();
    const kinds = new Map();
    const links = new Map();
    const crossing = (id) => {
      if (points.has(id)) return;
      const [[i0, j0], [i1, j1]] = edgeEnds(id);
      const [first, second] = flags[j0 * nx + i0] ? [[i0, j0], [i1, j1]] : [[i1, j1], [i0, j0]];
      const hit = bisect(pos(...first), pos(...second), grid[first[1] * nx + first[0]], grid[second[1] * nx + second[0]], (r) => inside(r));
      points.set(id, hit.at);
      const near = F.seamed && (hit.a.p ? hit.a : probe(hit.at[0], hit.at[1]));
      kinds.set(id, near && near.p && F.seamAt(...near.p) ? "split" : !hit.b.hit ? "outline" : Math.abs(hit.a.t - hit.b.t) > jump ? "contour" : "seam");
    };
    const link = (a, b) => {
      crossing(a);
      crossing(b);
      (links.get(a) ?? links.set(a, []).get(a)).push(b);
      (links.get(b) ?? links.set(b, []).get(b)).push(a);
    };
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const tl = flags[j * nx + i];
        const tr = flags[j * nx + i + 1];
        const br = flags[(j + 1) * nx + i + 1];
        const bl = flags[(j + 1) * nx + i];
        const code = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
        if (code === 0 || code === 15) continue;
        const edges = [(j * nx + i) * 2, ((j * nx + i + 1) * 2) | 1, ((j + 1) * nx + i) * 2, ((j * nx + i) * 2) | 1];
        let pairs = CASES[code];
        if (!pairs) {
          const centre = inside(centreOf(i, j));
          pairs = code === 5 ? (centre ? [[3, 0], [2, 1]] : [[0, 1], [3, 2]]) : centre ? [[0, 1], [3, 2]] : [[3, 0], [2, 1]];
        }
        for (const [a, b] of pairs) link(edges[a], edges[b]);
      }
    const rings = chain(links, points).filter((ring) => ring.closed && ring.points.length > 3);
    for (const ring of rings) ring.kinds = ring.ids.map((id) => kinds.get(id));
    const kept = rings.filter((ring) => Math.abs(areaOf(ring.points)) >= least);
    for (const ring of kept) {
      const depth = kept.filter((other) => other !== ring && insidePolygon(other.points, ring.points[0])).length;
      const area = areaOf(ring.points);
      if ((depth % 2 === 0) !== area > 0) {
        ring.points.reverse();
        ring.kinds.reverse();
      }
    }
    return kept;
  };
  const ringsPath = (rings, tolerance = smooth) => rings.map((ring) => fitRing(ring.points, tolerance)).join("");
  const outlineRings = region((r) => r.hit);
  const splitRun = (ring) => {
    const n = ring.points.length;
    const start = ring.kinds.findIndex((kind, i) => kind === "split" && ring.kinds[(i + 1) % n] !== "split");
    const out = [];
    let run = [];
    for (let s = 1; s <= n; s++) {
      const i = (start + s) % n;
      if (ring.kinds[i] === "split") {
        if (run.length > 1) out.push(run);
        run = [];
      } else run.push(ring.points[i]);
    }
    if (run.length > 1) out.push(run);
    return out.map((pts) => curvePath(simplify(pts, Math.min(smooth, edge)), false)).join("");
  };
  const outline = outlineRings.map((ring) => (ring.kinds.includes("split") ? splitRun(ring) : fitRing(ring.points, Math.min(smooth, edge)))).join("");
  const coverage = ringsPath(outlineRings, Math.min(smooth, edge));
  const ground = base === null ? -1 : F.materials.indexOf(base);
  const layers = F.materials.map((mat, m) => {
    const own = m === ground ? outlineRings : region((r) => r.hit && r.mat === m);
    if (!own.length) return null;
    const cover = m === ground ? coverage : ringsPath(own);
    const bands = tones === "overlay" && !banded.includes(mat) ? ["", "", "", ""] : BANDS.map((level) => ringsPath(region((r) => r.hit && r.mat === m && r.score >= level)));
    const seams = [];
    for (const ring of m === ground ? [] : own) {
      const n = ring.points.length;
      const start = ring.kinds.findIndex((kind, i) => kind !== "seam" && ring.kinds[(i + 1) % n] === "seam");
      if (start < 0) {
        if (ring.kinds.every((kind) => kind === "seam")) seams.push({ points: [...ring.points, ring.points[0]], closed: true });
        continue;
      }
      let run = null;
      for (let s = 1; s <= n; s++) {
        const i = (start + s) % n;
        if (ring.kinds[i] === "seam") {
          if (!run) run = [ring.points[(i + n - 1) % n]];
          run.push(ring.points[i]);
        } else if (run) {
          run.push(ring.points[i]);
          seams.push({ points: run, closed: false });
          run = null;
        }
      }
    }
    return { mat, paths: { fill: cover, outline: "", crease: "", top: bands[3], shades: [cover, bands[0], bands[1], bands[2]], seamless: true }, seams: m === 0 ? [] : seams };
  });
  const angle = (a, b) => (Math.acos(Math.max(-1, Math.min(1, dot3(a.n, b.n)))) * 180) / Math.PI;
  const flagged = new Map();
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++)
      for (const dir of [0, 1]) {
        const i1 = dir ? i : i + 1;
        const j1 = dir ? j + 1 : j;
        if (i1 >= nx || j1 >= ny) continue;
        const a = grid[j * nx + i];
        const b = grid[j1 * nx + i1];
        if (!a.hit || !b.hit) continue;
        if (Math.abs(a.t - b.t) < jump * 0.5 && angle(a, b) < crease * 0.5) continue;
        const near = (rm, qa, qb) => rm.hit && (!qb.hit || Math.abs(rm.t - qa.t) + angle(rm, qa) * 0.05 < Math.abs(rm.t - qb.t) + angle(rm, qb) * 0.05);
        const hit = bisect(pos(i, j), pos(i1, j1), a, b, near);
        if (!hit.b.hit || !hit.a.hit) continue;
        if (F.seamed && ((hit.a.p && F.seamAt(...hit.a.p)) || (hit.b.p && F.seamAt(...hit.b.p)))) continue;
        const gap = Math.abs(hit.a.t - hit.b.t);
        const turn = angle(hit.a, hit.b);
        if (gap <= jump && turn <= crease) continue;
        if (gap <= jump && quiet.some((mat) => F.materials.indexOf(mat) === hit.a.mat || F.materials.indexOf(mat) === hit.b.mat)) continue;
        flagged.set(((j * nx + i) * 2) | dir, { at: hit.at, kind: gap > jump ? "contour" : "crease" });
      }
  const links = new Map();
  const points = new Map();
  for (const [id, entry] of flagged) points.set(id, entry.at);
  const link = (a, b) => {
    (links.get(a) ?? links.set(a, []).get(a)).push(b);
    (links.get(b) ?? links.set(b, []).get(b)).push(a);
  };
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const edges = [(j * nx + i) * 2, ((j * nx + i + 1) * 2) | 1, ((j + 1) * nx + i) * 2, ((j * nx + i) * 2) | 1].filter((id) => flagged.has(id));
      if (edges.length < 2) continue;
      const rest = [...edges];
      while (rest.length >= 2) {
        let best = null;
        for (let a = 0; a < rest.length; a++)
          for (let b = a + 1; b < rest.length; b++) {
            const pa = points.get(rest[a]);
            const pb = points.get(rest[b]);
            const d = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
            if (!best || d < best.d) best = { a, b, d };
          }
        link(rest[best.a], rest[best.b]);
        rest.splice(best.b, 1);
        rest.splice(best.a, 1);
      }
    }
  const lines = chain(links, points)
    .map((line) => ({ ...line, kinds: line.ids.map((id) => flagged.get(id).kind) }))
    .filter((line) => line.points.length > 1);
  const snap = cell * 3;
  const inner = [];
  const lengthOf = (pts) => pts.reduce((sum, p, i) => (i ? sum + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
  for (const line of lines) {
    let pts = line.points;
    const kinds = line.kinds;
    if (!line.closed) {
      const ends = [0, pts.length - 1].map((index) => {
        const p = pts[index];
        const others = [...outlineRings, ...lines.filter((other) => other !== line && lengthOf(other.points) >= 1.2)];
        const hit = nearestOn(others, p);
        return hit.d <= snap ? hit.at : null;
      });
      pts = [...(ends[0] ? [ends[0]] : []), ...pts, ...(ends[1] ? [ends[1]] : [])];
      const total = lengthOf(pts);
      if (total < 1.2) continue;
      const ramp = Math.min(fade, total * 0.4);
      const tone = kinds.filter((kind) => kind === "contour").length >= kinds.length / 2 ? "hi" : "lo";
      inner.push({ points: simplify(pts, 0.04), fade: [ends[0] ? 0 : ramp, ends[1] ? 0 : ramp], tone });
    } else {
      const tone = kinds.filter((kind) => kind === "contour").length >= kinds.length / 2 ? "hi" : "lo";
      inner.push({ points: [...simplifyRing(pts, 0.04), pts[0]], fade: [0, 0], tone, closed: true });
    }
  }
  const seams = withSeams ? layers.filter(Boolean).flatMap((layer) => layer.seams).filter((s) => lengthOf(s.points) > 1) : [];
  const own = new Set(banded.map((mat) => F.materials.indexOf(mat)));
  const overlay = tones === "overlay" ? BANDS.map((level) => ringsPath(region((r) => r.hit && r.score >= level && !own.has(r.mat)).filter((ring) => Math.abs(areaOf(ring.points)) >= 2), toneSmooth ?? smooth)) : null;
  const kept = layers.filter(Boolean);
  if (ground >= 0) kept.sort((a, b) => (b.mat === base) - (a.mat === base));
  return { layers: kept, ground: ground >= 0, tones: overlay, outline, coverage, inner, seams, box, stats: { probes, grid: [nx, ny], ms: Date.now() - started } };
}

const attr = (name, value) => (value === undefined || value === null || value === false ? "" : value === true || value === "" ? ` ${name}` : ` ${name}="${value}"`);

export function fadedLine(points, [start, end], tone = "lo", { steps = 3 } = {}) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const total = lengths[lengths.length - 1];
  if (total < 1e-6) return "";
  if (start + end > total) {
    const share = total / (start + end);
    start *= share;
    end *= share;
  }
  const at = (length) => {
    let i = 1;
    while (i < points.length - 1 && lengths[i] < length) i++;
    const span = lengths[i] - lengths[i - 1] || 1;
    const t = Math.max(0, Math.min(1, (length - lengths[i - 1]) / span));
    return [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t];
  };
  const piece = (from, to) => [at(from), ...points.filter((_, i) => lengths[i] > from + 1e-6 && lengths[i] < to - 1e-6), at(to)];
  const out = [];
  const ramp = (from, to, rising) => {
    for (let k = 0; k < steps; k++) {
      const a = from + ((to - from) * k) / steps;
      const b = from + ((to - from) * (k + 1)) / steps;
      const x = (k + 0.5) / steps;
      const alpha = rising ? x * x * (3 - 2 * x) : 1 - x * x * (3 - 2 * x);
      const free = rising ? (k === 0 ? ' data-free="start"' : "") : k === steps - 1 ? ' data-free="end"' : "";
      out.push(`<path class="iso-line sp-fade" data-tone="${tone}" data-fade="${Math.max(1, Math.min(9, Math.round(alpha * 10)))}"${free} d="${curvePath(piece(a, b), false)}"/>`);
    }
  };
  if (start > 0) ramp(0, start, true);
  if (total - end > start) out.push(`<path class="iso-line" data-tone="${tone}" d="${curvePath(simplify(piece(start, total - end), 0.04), false)}"/>`);
  if (end > 0) ramp(total - end, total, false);
  return out.join("");
}

export function veilSvg(painted, { tissue = "veil", tone = "mid", className } = {}) {
  const shine = painted.tones ? painted.tones[3] : "";
  return `<g class="sp-veil${className ? ` ${className}` : ""}"${attr("data-tissue", tissue)}><path class="sp-veil-fill" d="${painted.coverage}"/>${shine ? `<path class="sp-veil-shine" d="${shine}"/>` : ""}<g class="iso-solid"><path class="iso-line iso-edge" data-tone="${tone}" d="${painted.outline}"/></g></g>`;
}

const TOKENS = ["--anatomy-shade-0", "--anatomy-shade-1", "--anatomy-shade-2", "--anatomy-shade-3", "--anatomy-top"];

export function mixStyle(a, b, share) {
  const pct = Math.round((1 - share) * 100);
  return TOKENS.map((token, n) => `${token}:color-mix(in srgb,var(--tissue-${a}-${n}) ${pct}%,var(--tissue-${b}-${n}))`).join(";");
}

export function fieldSvg(painted, { tone = "hi", tissue = {}, className, seamTone = "lo" } = {}) {
  const layers = painted.layers
    .map(({ mat, paths }) => {
      const shades = paths.shades.map((d, shade) => (d ? `<path class="iso-shade" data-shade="${shade}" d="${d}"/>` : "")).join("");
      const mixed = mat.match(/^(.+)~(.+)~(\d+)~(\d+)$/);
      const look = mixed ? `${attr("data-tissue", `${tissue[mixed[1]] ?? mixed[1]}-${tissue[mixed[2]] ?? mixed[2]}`)} style="${mixStyle(tissue[mixed[1]] ?? mixed[1], tissue[mixed[2]] ?? mixed[2], Number(mixed[3]) / (Number(mixed[4]) + 1))}"` : attr("data-tissue", tissue[mat] ?? mat);
      return `<g class="iso-solid"${attr("data-seamless", true)}${look}>${shades}${paths.top ? `<path class="iso-top" d="${paths.top}"/>` : ""}</g>`;
    })
    .join("");
  const lines = painted.inner
    .map((line) => (line.fade[0] || line.fade[1] ? fadedLine(line.points, line.fade, line.tone) : `<path class="iso-line" data-tone="${line.tone}" d="${curvePath(line.points, false)}"/>`))
    .join("");
  const seams = painted.seams.map((seam) => `<path class="iso-line" data-tone="${seamTone}" d="${curvePath(simplify(seam.points, 0.05), false)}"/>`).join("");
  const veils = painted.tones ? `<g class="sp-tones">${painted.tones.map((d, i) => (d ? `<path class="sp-tone" data-tone="${i + 1}" d="${d}"/>` : "")).join("")}</g>` : "";
  const first = painted.layers[0];
  const under = !painted.ground && painted.layers.length > 1 && first ? `<g class="iso-solid"${attr("data-tissue", tissue[first.mat] ?? first.mat)}><path class="iso-shade" data-shade="1" d="${painted.coverage}"/></g>` : "";
  return `<g class="sp-field${className ? ` ${className}` : ""}">${under}${layers}${veils}<g class="iso-solid">${seams}${lines}<path class="iso-line iso-edge" data-tone="${tone}" d="${painted.outline}"/></g></g>`;
}

export function surfaceSamples(F, spacing = 0.6, { offset = [0, 0, 0] } = {}) {
  if (!F.bounds) return [];
  const { min, max } = F.bounds;
  const coarse = spacing * 4;
  const out = [];
  const f = F.v;
  const nx = Math.max(1, Math.ceil((max[0] - min[0]) / coarse));
  const ny = Math.max(1, Math.ceil((max[1] - min[1]) / coarse));
  const nz = Math.max(1, Math.ceil((max[2] - min[2]) / coarse));
  const reach = (coarse * Math.sqrt(3)) / 2 + spacing;
  const fine = Math.round(coarse / spacing);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++)
      for (let k = 0; k < nz; k++) {
        const cx = min[0] + (i + 0.5) * coarse;
        const cy = min[1] + (j + 0.5) * coarse;
        const cz = min[2] + (k + 0.5) * coarse;
        if (Math.abs(f(cx, cy, cz)) > reach * F.L) continue;
        for (let a = 0; a < fine; a++)
          for (let b = 0; b < fine; b++)
            for (let c = 0; c < fine; c++) {
              let x = cx - coarse / 2 + (a + 0.5) * spacing;
              let y = cy - coarse / 2 + (b + 0.5) * spacing;
              let z = cz - coarse / 2 + (c + 0.5) * spacing;
              let d = f(x, y, z);
              if (Math.abs(d) > spacing * 0.5 * F.L) continue;
              for (let step = 0; step < 4 && Math.abs(d) > 1e-4; step++) {
                const g = F.gradient(x, y, z, 1e-3);
                const g2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2] || 1;
                x -= (d * g[0]) / g2;
                y -= (d * g[1]) / g2;
                z -= (d * g[2]) / g2;
                d = f(x, y, z);
              }
              if (Math.abs(d) < 0.02) out.push([x + offset[0], y + offset[1], z + offset[2]]);
            }
      }
  return out;
}

function polylinesOf(d) {
  if (/[^MLZ\d\s.,eE+-]/.test(d)) return null;
  const out = [];
  for (const [, kind, body] of d.matchAll(/([MLZ])([^MLZ]*)/g)) {
    const v = (body.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []).map(Number);
    if (kind === "M") out.push({ points: [[v[0], v[1]]], closed: false });
    if (kind === "L") for (let i = 0; i + 1 < v.length; i += 2) out[out.length - 1].points.push([v[i], v[i + 1]]);
    if (kind === "Z" && out.length) out[out.length - 1].closed = true;
  }
  return out;
}

export function compactPath(d, { tolerance = 0.15, corner = 28 } = {}) {
  const lines = polylinesOf(d);
  if (!lines) return d;
  const cos = Math.cos((corner * Math.PI) / 180);
  return lines
    .map(({ points, closed }) => {
      const pts = points.filter((p, i) => i === 0 || Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 1e-6);
      if (closed && pts.length > 1 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-6) pts.pop();
      if (pts.length < 3) return curvePath(pts, closed && pts.length > 2);
      const n = pts.length;
      const sharp = pts.map((p, i) => {
        if (!closed && (i === 0 || i === n - 1)) return true;
        const a = pts[(i - 1 + n) % n];
        const b = pts[(i + 1) % n];
        const u = [p[0] - a[0], p[1] - a[1]];
        const w = [b[0] - p[0], b[1] - p[1]];
        return (u[0] * w[0] + u[1] * w[1]) / (Math.hypot(...u) * Math.hypot(...w) || 1) < cos;
      });
      const corners = sharp.map((flag, i) => (flag ? i : -1)).filter((i) => i >= 0);
      if (!corners.length) return curvePath(simplifyRing(pts, tolerance), true);
      const runs = [];
      for (let c = 0; c < corners.length - (closed ? 0 : 1); c++) {
        const from = corners[c];
        const to = corners[(c + 1) % corners.length];
        const run = [];
        for (let i = from; ; i = (i + 1) % n) {
          run.push(pts[i]);
          if (i === to && run.length > 1) break;
          if (run.length > n + 1) break;
        }
        runs.push(simplify(run, tolerance));
      }
      let out = curvePath(runs[0], false);
      for (const run of runs.slice(1)) out += curvePath(run, false).replace(/^M[^lc]*/, "");
      return closed ? out.replace(/^M/, "M") + "z" : out;
    })
    .join("");
}

export const compactSvg = (svg, options) => svg.replace(/ d="([^"]*)"/g, (all, d) => ` d="${compactPath(d, options)}"`);

export const FIELD_CSS = `.sp-tone{stroke:none;fill:var(--sp-glow,#fff)}
.sp-veil-fill{stroke:none;fill:var(--anatomy-shade-2);fill-opacity:var(--sp-veil,.32)}
.sp-veil-shine{stroke:none;fill:var(--sp-glow,#fff);fill-opacity:var(--sp-veil-shine,.22)}
.sp-fade{stroke-linecap:butt}
${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `.sp-fade[data-fade="${n}"]{stroke-opacity:${n / 10}}`).join("\n")}
.sp-tone[data-tone="1"]{fill-opacity:var(--sp-tone-1,.07)}
.sp-tone[data-tone="2"]{fill-opacity:var(--sp-tone-2,.08)}
.sp-tone[data-tone="3"]{fill-opacity:var(--sp-tone-3,.09)}
.sp-tone[data-tone="4"]{fill-opacity:var(--sp-tone-4,.1)}
.iso[data-theme="light"] .sp-tone[data-tone="1"]{fill-opacity:var(--sp-tone-1,.25)}
.iso[data-theme="light"] .sp-tone[data-tone="2"]{fill-opacity:var(--sp-tone-2,.33)}
.iso[data-theme="light"] .sp-tone[data-tone="3"]{fill-opacity:var(--sp-tone-3,.5)}
.iso[data-theme="light"] .sp-tone[data-tone="4"]{fill-opacity:var(--sp-tone-4,.45)}
`;

export function split(root, seeds, { seam = true } = {}) {
  return seeds.map((seed, i) => {
    const walls = [];
    seeds.forEach((other, j) => {
      if (i === j) return;
      const n = unit3(sub3(other, seed));
      walls.push(halfspace(mul3(add3(seed, other), 0.5), n, { seam }));
    });
    return intersect(0, root, ...walls);
  });
}

export function place(node, { scale = 1, basis = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], move = [0, 0, 0] } = {}) {
  const [ex, ey, ez] = basis;
  const rot = (v) => [ex[0] * v[0] + ey[0] * v[1] + ez[0] * v[2], ex[1] * v[0] + ey[1] * v[1] + ez[1] * v[2], ex[2] * v[0] + ey[2] * v[1] + ez[2] * v[2]];
  const back = (v) => [ex[0] * v[0] + ex[1] * v[1] + ex[2] * v[2], ey[0] * v[0] + ey[1] * v[1] + ey[2] * v[2], ez[0] * v[0] + ez[1] * v[1] + ez[2] * v[2]];
  const at = (p) => add3(move, mul3(rot(p), scale));
  const walk = (n) => {
    if (!n || typeof n !== "object") return n;
    switch (n.op) {
      case "ball":
        return { ...n, c: at(n.c), r: n.r * scale };
      case "ellipsoid":
        return { ...n, c: at(n.c), r: n.r.map((v) => v * scale), axes: n.axes.map(rot) };
      case "cone":
        return { ...n, a: at(n.a), b: at(n.b), ra: n.ra * scale, rb: n.rb * scale };
      case "half":
        return { ...n, o: at(n.o), n: rot(n.n) };
      case "clip":
        return { ...n, o: at(n.o), n: rot(n.n), k: n.k * scale, of: n.of.map(walk) };
      case "grow":
        return { ...n, by: n.by * scale, of: n.of.map(walk) };
      case "custom": {
        const f = n.f;
        const corners = [];
        if (n.bounds) for (const x of [n.bounds.min[0], n.bounds.max[0]]) for (const y of [n.bounds.min[1], n.bounds.max[1]]) for (const z of [n.bounds.min[2], n.bounds.max[2]]) corners.push(at([x, y, z]));
        const bounds = corners.length ? { min: [0, 1, 2].map((i) => Math.min(...corners.map((c) => c[i]))), max: [0, 1, 2].map((i) => Math.max(...corners.map((c) => c[i]))) } : undefined;
        return { ...n, bounds, f: (p) => scale * f(back(mul3(sub3(p, move), 1 / scale))) };
      }
      default:
        return { ...n, k: n.k === undefined ? n.k : n.k * scale, of: n.of ? n.of.map(walk) : n.of };
    }
  };
  return walk(node);
}
