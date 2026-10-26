# Assemblies: a model that comes apart

How to build a teaching model whose parts can be hidden, faded, isolated, pulled apart, peeled and cut, with every part painted as its own distance field. The worked example is the central nervous system (34 parts, 10 views): <https://github.com/julianolarteramos/sistema-nervioso-central>, live at <https://julianolarteramos.github.io/sistema-nervioso-central/>. Its engine is `lib/assembly.mjs` there; it is not part of this kit, and this page is what it taught.

Read [`craft.md`](craft.md) first (one field, four tones, tissue layers) and [`verify.md`](verify.md) (the audit). An assembly adds one new problem to all of that: **painter's order between parts that wrap each other**.

## 1. One field per part

A single field with many parts (the heart, the brain example) paints each part clipped by the ones that cover it, so hiding a part leaves a hole. To take a part away, every part has to be painted **whole**, as its own field, and the covering is left to painter's order (`A.settle`). That costs 20–45 % more weight per view, and it means parts have to meet **flush, not sunk into each other**: leave a small gap (0.8 mm in the example) where two parts touch, and declare the mounting parts `ground`.

What you get for free once parts are whole: hiding, fading (group opacity), isolating, picking (the DOM order is the painter's order, so a click lands on the visible part), and pulling apart (in a parallel projection a 3D translation is exactly a 2D one).

## 2. The exit planner

Each part leaves along a vector. A greedy planner (`scripts/planear-salidas.mjs` in the example) takes the parts in the order you want them peeled and gives each the free direction closest to a preferred one, stopping when it has cleared everything else plus an extra stretch. Things learned the hard way:

- **It samples sparsely** (every 4 mm). It misses 1 mm overlaps that the audit (which samples every 1 mm) finds. Do not fix this by demanding a positive margin: the distance bound underestimates real distances, so every pair that touches already looks too close and the planner blocks everything. Correct the few misses by hand, in a separate overrides file that the planner does not rewrite.
- **It cannot see the mount.** A part that is allowed to go straight down will go through the plinth. Give such parts a preferred direction that avoids it.
- **"Up" is not always free.** A part tucked under an overhang (the fornix under the thalamus) collides when pulled up. Search directions with fine sampling instead of moving the vector blindly: against one neighbour, 300 directions took under a minute.
- **A part that leaves after another, below it, must travel less.** Two stacked parts pulled up by almost the same amount end up overlapping by the difference.
- **Release jump.** A part that starts from zero leaves a frame in which near-flush parts order by tenths of a millimetre, and three-part cycles appear. Each part detaches suddenly by 4–8 % of its travel and then eases.

## 3. Cycles, and what breaks them

Order is solved from the overlaps of every pair in every state of the explode slider. A cycle (A over B over C over A) cannot be ordered by any key; it has to be cut.

- **Split by shadow.** Cut A by the shadow of B along the view (`split: [{ shadow }]`): one chunk behind B and one in front. The pieces share a part name and draw no seam. An automatic planner tries each pair both ways and keeps what resolves it with only those two parts in the scene.
- **Cycles of more than two parts** do not show as a pair: each pair is consistent. Read the rules the solver had to **drop** (`orderKeys(...).dropped`) and treat each as a pair to cut. This took 53 problems to 1 in one change.
- **Look at the exploded states too,** not only at rest, and give each chunk its `move`.
- **Raise the cut limit per view** (`maxCuts`) for hard views; do not raise it globally.
- **A part with notches around another part (a bowl) is a cycle factory.** The internal capsule, the leftover white matter around six embedded parts, caused 73 of 89 problems. Remove it as a part, or give it flat faces that wrap nothing.
- **A C shape interlocks with other C shapes.** The caudate nucleus against the ventricle cast and the hippocampus: split it (head and body, tail).
- **A part made of separate objects cannot sit on both sides of something that is not a part** (a stand's post): the planner cannot see the mount. Make each object its own part.
- **Parts that must line up (a brainstem in three levels) should be cut from one body** with shared planes (`capAt`), not modelled separately: modelled apart, their sections differed by 11 mm at the joint and looked disconnected.

## 4. Membranes

A translucent membrane (meninges, a pericardium) is a part with `veil: opacity`, painted with `veilSvg` (coverage and shine only). It is excluded from painter's order and from cover, so it can never be in a cycle. It still needs three things: a `blend: ["*"]` declaration so the audit lets it pass through solids as it lifts off; to be skipped by the cut planner; and to leave **first**, far and without collision checks. A dura that hugs a brain below its equator has no free exit, and an exit planner that treats it as an obstacle jams on it.

## 5. Tolerance and exceptions

A raster cell is the audit's smallest overlap. Many failures are the same 1–4 px² sliver repeated in every slider position. Decide a tolerance (the example uses 4 px², 2×2 px of a 640 px figure), write it down, and declare the real overlaps above it **per view**, each with its size and the number of states. To find out whether an exception is still needed, remove it and rebuild that view. Reading the printed rows is not reliable: excused rows print in another format.

## 6. Time, memory and caches

The audit is quadratic in chunks and linear in states: one view of 34 parts takes about 100 minutes in full, and ordering alone about 3 to 15. Three things made it workable:

- **Modes that skip the slow checks** while iterating: order only, order plus in-flight clearances, and the full audit to close a change.
- **Caches** keyed by what they depend on: the cut plan per view, the paint per chunk and view, the order per view. A change that only touches the page then rebuilds ten views in about 20 seconds. **Do not put a view's display name in its key.** Renaming views invalidated hours of plans.
- **A memory guard in the launcher** (kill above a limit) and a heap cap per child process. Running 15 order solvers at once on 24 GB took the machine down once; with three heavy views at once the guard cut a build at 14 GB. Use two.

## 7. A section viewer instead of cutting the parts

Cutting every part by a plane means new geometry, new views and new cycles. A section viewer is much cheaper: sample each part's field on a grid over the plane, extract contours with marching squares (linear interpolation on the field makes them finer than the grid), simplify, and store them as SVG paths (about 360 KB for 47 sections). The page draws the plane on the model with the affine projection of each view (origin plus the three axis vectors) and the section in a card beside it. Fill hollow regions with a virtual region that exists only in the sections. The limits are honest ones: it draws sections, it does not cut the parts, and it refers to the assembled model.

## 8. Framing

An explode box interpolated in a straight line between rest and fully apart leaves out the parts that leave first. Compute the figure's box at 26 slider positions, with each part at its own share of travel, and interpolate over that table.

## 9. Checks that caught real bugs

- A framing check across every view, five slider positions and three window sizes. It once passed with 40 of 50 checks because the capture tool lost output lines: make it fail when checks are missing.
- A state per control (peel, labels, pathways, cuts, folded panel), captured at three sizes with a clean console.
- Hidden elements: a `display:flex` rule overrides the `hidden` attribute. Add a `[hidden]{display:none}` rule for every element you give a display.
