---
name: specimen
description: Build crafted, interactive isometric SVG figures of anatomy as a real teaching object (a classroom heart model on a turned plinth, a kidney cut open beside its adrenal gland, a brain hemisphere with its sulci, a liver with its vessels), with organs and vessels drawn from smooth distance fields, four-tone shading, tissue colours, cuts, translucent membranes, correct painter's order, a framed card with title, hint and live readout, and calm motion from a true model. Use it whenever someone wants an anatomical illustration, an organ or system diagram for a class, a slide, docs or an article, an explanatory figure of physiology (a heartbeat, blood flow, a hormone path), or an interactive explainer of the body, even if they never say "isometric". It keeps the Anatomy kit's machine parts (stands, instruments, pipes) for the objects around the specimen. Framework-free (Node scripts that write SVG and HTML) or React/Next.js; WebGL optional.
license: MIT
compatibility: Written for Claude Code; also runs in Antigravity, OpenCode, Codex and MiniMax Code. Needs Node.js 20.10+, and Chrome or Chromium for the checks.
metadata:
  opencode/slash: "true"
---

# Specimen

Specimen is a fork of Anatomy (MIT, Ryan) for the body. Its figures look like a good teaching model on a bench: an organ made of smooth fused lobes and vessels, painted in sober tissue colours, standing on a turned plinth on a rod, turning through a few audited views, opened along a real anatomical plane or seen through a translucent membrane. The reader understands the physiology because they recognise the organ and can follow its parts. Every number the figure shows comes from the same model that moves it.

Open the closest example before you start. Each is built with `node examples/<name>/build.mjs` (add `--light` for the light theme, which ships, and `--audit` to prove the geometry).

- `examples/heart/` is the reference: one distance field with chambers, draped auricles, the great vessels with cut ends and lumens, and coronary arteries fused on the surface, in four tissues with graded joins. Four views at different azimuths, a four-chamber section and a view through the pericardium crossfade on one card; a pure model drives a calm heartbeat and the bpm readout. Every view is audited in organic mode.
- `examples/kidney/`, `examples/brain/` and `examples/liver/` are the organ set: a kidney opened on its coronal plane beside its adrenal gland (cortex, medulla, pyramids, pelvis, hilum vessels), a brain hemisphere with gyri and sulci carved into its surface, and a liver with its lobes, gallbladder and the vessels at its hilum.
- `examples/endocrine/` is a whole system in one model: the back half of a torso cut on the coronal plane with the brain's medial face, the hypothalamus and pituitary, the thyroid, thymus, heart, pancreas, kidneys with their adrenals cut open and the gonads, joined by vessels and nerves split into depth-sortable pieces. A pure model plays the stress response on a loop (sympathetic to adrenal medulla, then CRH, ACTH and cortisol, then the cortisol brake), lighting the glands that act and driving the hormone flows, the readout and the level bars. It builds in English and Spanish.
- The machine examples kept from Anatomy (`dial-indicator`, `desk-computer`, `arcade-cabinet`, `raptor-engine`, `ripple-tank`, `test-rig`, `spot-plate`) stay as the reference for the machine parts a specimen stands on and the instruments around it.

## The one idea that matters

**The specimen is the explanation.** Don't draw a textbook diagram with arrows and labels. Build the real thing a teacher would put on the desk: a model of the organ, at true proportions, with the parts a student must name, mounted the way such models are mounted. The concept is carried by the anatomy itself and by what the figure does: the heart beats at the rate in the readout, the section shows why the left ventricle wall is thicker, the membrane shows what holds the heart.

| Idea | Specimen |
|---|---|
| Two circuits, one pump | A heart model with the aorta and pulmonary trunk leaving it, arteries and veins in their own tissue colours |
| Why the left ventricle works harder | The same heart opened along the four-chamber plane, its thick left wall beside the thin right one |
| Filtering blood into urine | A kidney opened on its coronal plane: cortex, medullary pyramids, calyces, pelvis, ureter, renal artery and vein |
| A stress response | The adrenal gland on the kidney's pole, cut to show cortex and medulla |
| Surface area folded into a skull | A brain hemisphere with deep sulci, the central sulcus and the lateral fissure |

Two ways this fails, both seen in practice:

- **A machine with organ names.** Prisms, cylinders and tubes with flanges, glued together, read as plumbing, not as an organ. Organs come from smooth fused fields (`kit/blob.mjs`), never from the lathe and tube parts.
- **A blob.** One smooth shape with a colour and a label teaches nothing. Every organ is built from its real parts (lobes, chambers, grooves, hila, vessels with cut ends), each where it belongs.

**Every specimen is detailed and true.** At 1× it reads at once as that organ, from its silhouette and its few landmarks. At 4× every region still has something true: a groove with its vessel, a vessel's cut end with its lumen, a fissure, the seam where two tissues meet. Proportions and positions come from anatomy (sizes in mm as world units, the apex where the apex is), never from what was easy to model. Be honest about what a model simplifies, and say it in the caption.

## Workflow

1. **Size it.** A Figure is one organ in one or two views (about an hour or two of build and check). A Hero is one organ with several views, a section and a membrane, or two organs together (3–6 hours). An Epic is a whole system (a torso, the circulation): give the estimate, propose a Hero, and wait.
2. **Truth first.** Collect real dimensions and relations: lengths and radii in mm, wall thicknesses, which structure lies in front, where vessels enter, the rate or flow the readout will show. Write the behaviour as a small pure module (`examples/heart/model.mjs`).
3. **Choose the specimen and its mount.** A classroom model on a turned plinth and rod, a dish, a cradle: something real that holds the organ. Choose the anatomical frame (left, anterior, superior) and the view that teaches most; the kit's projection is mirrored, so check the side you see.
4. **Parts list.** Write the organ's parts as an anatomist would: lobes or chambers, borders and surfaces, grooves, hila, each vessel and what it enters, cut ends, and the inner parts a section will show. For each, the primitive that makes it and its tissue.
5. **Build the field.** One field per organ (`B.field`). Lobes are ellipsoids and balls blended with large `k`; vessels are `B.vessel` chains sampled every 0.4–0.8 units, cut with `B.clip` and bored with a lumen; surface vessels follow the organ (project the path onto the surface and lift it by its radius); grooves are `B.carve`s of thin capsules along the surface. Graded joins between tissues come from `mix`. The mount is kit parts (`G.solidOf`, `G.disc`) recorded with the audit; the rod enters the organ as a declared `blend`.
6. **Paint and record.** `B.paint(F, P, { tones: "overlay", base, banded })` and `B.fieldSvg(...)`; record `A.field(F)` for the organ and the kit shapes for the mount, `A.settle`, and audit with `{ organic: true }`. A view is a camera azimuth; generate several and audit each.
7. **Sections, membranes, pieces.** A section is a `carve` by `halfspace`s with a cut-face tissue, cavities and walls modelled inside, and `cores` that colour the cut face (endocardium, medulla). A membrane is a veil: its own field (`B.grow` of the organ), drawn last with `B.veilSvg`, declared `veil: { opacity }`. A field that must pass in front of one part and behind another is split (`B.split`) into pieces whose cut faces face away from the viewer.
8. **Frame it.** The card: `Fig n`, a short title, the hint and the live readout. Legend keys and a true caption under it; no labels in the drawing.
9. **Make it live, calmly.** Motion comes from the model (a beat is a scale of a few percent with systole and diastole timed right), views crossfade, reduced motion goes still, offscreen stops.
10. **Verify like a critic.** `--audit` ends `audit passed` on every view; `scripts/lines.mjs` prints `line ends: 0` on every view in both themes; captures at 1920, 1280 and 390, and 4× close-ups of every junction, vessel origin, cut end, groove and tissue join. Read every PNG. Ask: is it instantly that organ, are its proportions right, does every vessel end on something or in a cut with a lumen, is there a tone staircase, a scalloped band, a washed-out accent, a flat patch, a line that stops in mid-air?

## Setup

The kit is in `kit/`:

| File | Use it for |
|---|---|
| `kit/iso-kit.ts` | The whole core in one file: camera, solids, a parts library, an SVG string renderer, card and page builders, and the CSS (`ISO_CSS`). Copy it into a TypeScript project. |
| `kit/iso-kit.mjs` | The same core compiled to plain ESM, for Node scripts. Import it directly. |
| `kit/iso.css` | `ISO_CSS` written out. Import it once and put `class="iso"` (plus `data-theme="light"` for light) on a wrapper or `<body>`. |
| `kit/react/draw.tsx` | Server-safe React components: `Solid`, `Line`, `Wire`, `Dots`, `FaceText`, `IsoFigure`, `Plate`. |
| `kit/react/live.tsx` | `"use client"` hooks: `useReadout`, `useLoop`, `useEased`, `useInView`, `useStillness`, plus `spring` and `follow`. |
| `kit/lathe.mjs` | Round parts along any axis: `frameAlong`, `lathe` (smooth shading switches on by itself for any profile with a smooth knot), `solidOf`, `disc`, `ringBand`, `sphereOf`, `saddleOf`, `bandsOf` (one curved body cut into depth-sortable bands that share one surface, with one outline from `sidesOf`), visible arcs, ribs and bolt circles on round surfaces (`ribsOf` and `dotsOf` take `fade`, `ribsOf` takes `seams`), `rodOut` for a rod that slides out of a gland, and `fillet` for pipe routes. |
| `kit/tube.mjs` | `tubePieces` splits a 3D pipe or cable into depth-sortable chunks (with `breaks`, `gaps` under collars and clamps, elliptical end caps, and `rings` for a braid, corrugation or wrap that follows the cross-section through every joint), and `tubeSvg` draws one; `crossingsOf` finds where a route passes through a clamp, `runsOf` the drawn runs. Its `.tb-*` fills are in `ISO_CSS`. |
| `kit/audit.mjs` | Proves the geometry. `recorder(P, { order, spring })` collects items, shapes (turned bodies, slabs, prisms, boxes, balls, tubes, pads cut by their host) and routes as the helpers draw them; `settle(R, P)` ray-casts every overlapping pair for true depth, at rest, apart and in the replayed explode, and sets the painter's keys (`overlapsOf`, `orderKeys`); `auditOrExit(R, P)` is the `--audit` hook that runs every check (`clearances`, `solidClearances`, `terminals`, `looseEnds`, `supports`, `folds`, `selfOverlaps`, `crowding` with slender solids as lines, `coverage` for stand-in shapes, `wobble`, `seats`, `depthOrder`) and exits non-zero on any problem. `A.slide` records a rod that slides out of a gland. `references/kit.md`, section 12. |
| `kit/blob.mjs` | The specimen core. Organic parts: signed distance fields of balls, ellipsoids, round cones and vessels, smooth-blended, carved and clipped, ray-marched at build time into seamless four-tone solids with tissue layers (`field`, `paint`, `fieldSvg`). Audit them with `A.field` and `{ organic: true }`. |
| `kit/gl.mjs` | The WebGL layer for shaders inside the drawing: `GLSL_ISO` (the camera in GLSL, including `rayOf` and `pixelOf`), `glCamera(P)`, `glLayer(...)`, and the JS envelopes `smooth`, `burst` and `settle`. |
| `scripts/capture.mjs` | Headless Chrome screenshots, close-ups and console checks, with WebGL on. Run with `node`. |
| `scripts/drive.mjs` | Scripted headless Chrome with WebGL: move, click, key, slow motion, wait-until, eval, shots and contact sheets that catch pops; `--no-webgl` and `--preload`. |
| `scripts/lines.mjs` | The line-end check on a built page, in headless Chrome: every texture line must end on a stroke, a dot or an outline. Rings the failures with `--out`; exits 1 on any. |
| `scripts/inline-kit.mjs` | `kitScript()` and `glScript()` return the kit and the WebGL layer as source to inline into a standalone page. |
| `scripts/print.mjs`, `scripts/print-sheet.mjs` | Printable sheets: freeze poses of a built page as vector stills and lay them out as an A4 or Letter PDF in three formats (poster, drawing, detailed). `references/print.md`. |

Pick the path that fits the project:

- **Standalone HTML, a static SVG, a blog post or any non-React site.** Write a Node build script like `examples/dial-indicator/build.mjs`. It imports `kit/iso-kit.mjs`, assembles strings with `solidSvg`, `lineSvg`, `dotsSvg`, `wireSvg` and `faceTextSvg`, wraps them with `figureSvg` and `plateHtml`, and writes the page with `pageHtml({ script: kitScript() + live })`, or `kitScript() + glScript() + live` when it has a shader. For a lone `.svg` file use `figureSvg({ standalone: "dark" | "light" })`, which embeds the styles.
- **React or Next.js.** Copy `kit/` into the project (for example `components/iso/`). Keep geometry in plain `.ts` modules, build the static art in a server component with the `draw.tsx` components, and pass it as element props to one `"use client"` live component that moves things. `references/react.md` explains the split and a trap with large pages.

## Craft rules (short form)

Organs (`references/craft.md`, part I):

- **Fields, not parts.** An organ is one field of fused primitives; separate solids sunk into each other are never an organ.
- **Proportions are anatomy.** Sizes in mm, landmarks where they are; the model may simplify, never relocate.
- **Tissues are sober, one accent.** Each tissue is a five-step token ramp (`--tissue-<name>-0..4`); muscle, arterial and venous blood, gland, fat, cut face, valve. One accent (the structure the reader should follow) keeps its own tones (`banded`), saturated in both themes.
- **Joins grade.** Where two tissues fuse, `mix` grades them over a band of distance; a hard line at a vessel's root reads as a pipe joint.
- **Vessels are tubes, sampled densely.** Union consecutive cones without smoothing (a blend between them bulges every joint and scallops the tone bands); sample a large vessel every 0.4 units. Surface vessels sit on the surface lifted by their radius, taper monotonically and dive into the surface where they end; their origin is hidden under a lobe or rises out of its parent, never a flat patch.
- **Cut ends have lumens.** A vessel that leaves the specimen ends in a flat cut with a bored lumen.
- **Sections are planes through every chamber.** Cavities fill most of the section; walls have their true relative thickness; the cut face has its own tissue, a darker endocardial rim from `cores`, and a clear edge.
- **Membranes are veils.** One tissue, one shine, one outline, an opacity between 0.08 and 0.55, drawn last.
- **Inner contours fade.** Depth jumps under a few units draw no line; the rest snap to the outline or fade where they end.

Mounts and instruments keep the machine rules of Anatomy (part II of `references/craft.md`):

- **Solids, not wireframes.** Every part is filled in paper colour and painted in order, so things in front hide things behind. No see-through edges and no dashed hidden lines.
- **Let the kit shade.** `extrude` returns four side tones by facing plus a lighter top. Keep it for anything with height, and use `flat` only for floors and inlays thinner than 1 unit.
- **Tone hierarchy.** Base and feet are `lo`, structure is `mid` and the subject is `hi`. Exactly one accent is `lit` (white in dark, black in light): the part the reader should watch. Grooves are `faint`, minor ticks `lo`, major ticks `mid` and the zero mark `hi`. Use colour only when colour is the subject, such as red, green and blue channels.
- **Small precise detail, never noise.** Use bevels of 0.4–1.6, grooves inset 3–5 from an edge, screws as 0.4–0.55 dots with a ring at the corners of plates, knurls on knobs, ruler ticks every 4–5 units with a major every 5th, and a label plate with three rule lines. Each detail belongs to a part.
- **Lines resolve.** Every line ends on something: a face, another line or a terminal dot. Connectors are `Wire`s whose terminal dots land on objects. There are no leader lines, balloons, dimension arrows or labels floating in the air.
- **No pipe or cable passes through anything.** Not through another pipe, cable or solid, at rest, apart or in any frame of the explode. Keep about 1.5 radii of clearance to everything but a line's own connection, run lines beside the structure rather than across the subject's face, and gap a pipe wherever a flange, band, bellows, clamp or valve wraps it. Parts meet flush, tangent or rim-on-surface, never sunk in: a flange's back face lands on its port (on a saddle pad, `G.saddleOf`, when the port is curved), a branch leaves from a ball tee, and every end, apart too, finishes on a flange, coupling, connector shell or terminal dot.
- **Every crossing is drawn in true depth order.** Where two items overlap on screen, the nearer is drawn on top, proved by `A.settle` and the audit, not tuned by eye. Lines cross on straights, well apart in depth: a bend, end or clamp that lands on another line's outline reads as a joint (a rod, tie rod, post or rail counts as a line: a pipe's last leg never runs along one on screen), a leg that points at the viewer and then turns pinches to a V (leave such a port through an elbow ball), and a route never doubles back on screen. A pair that can't be ordered interlocks, and the fix is a cut or a tangent contact, never a bias.
- **Curved surfaces shade smoothly, never in a staircase.** Mark curved knots smooth (`[s, r, 1]`) and `lathe` shades them from one monotone curve that also draws the outline; give any curved body larger than a fitting an analytic profile with `smooth: { slope }`, cut long bodies with `G.bandsOf`, and use `G.sphereOf` for balls. Tone bands taper to nothing instead of ending on a straight cut, and seams go under the outline (`inner`).
- **A texture ends on a real edge or fades.** Ribs, bolt circles, rule lines, seams and grooves never stop in the middle of a surface, flat or curved: `ribsOf` and `dotsOf` take `fade` (draw faded ribs with `fadedSvg`), a rib row ends on its seams (`ribsOf(…, { seams: true })`), a seam or weld on a box wraps its corners (`k.sideSeam`, as the slab's `inner`), a line on one face runs edge to edge, vents are closed slots, ticks hang from a ruler strip's edge, a single line that must stop ramps out with `fadeLineSvg`, and a row whose features face up (holes on top of a ring) is seen all round (`all: true`). A texture on a pipe (braid, corrugation, wrap) follows its cross-section and runs through every chunk joint: `tubePieces(…, { rings })`, never a dashed stroke down the centreline. A pipe's shine and shade run onto its end caps and through every chunk joint. Only rule lines that stand for printed text, a needle's tail and a pointer's tip may stop on a bare face, marked `free`.
- **Shaders never pop or cut off.** Every uniform rides an envelope with an attack and a decay, phase changes are crossfades driven by the physical quantity, every term reaches zero before any bound or canvas edge, and the effect lives in world space in the figure's own camera (see below).
- **Things on faces fit them.** Text a machine displays fits its window at its widest string and is clipped to it; content seen through an opening is clipped by the opening as well as by its own plane, with the recess walls drawn.
- **Volume.** Give things real thickness, make them stand on other things, and put a soft halo under the base and under anything lifted.
- **Composition.** Centre the figure and let it fill about 55–65% of the card. Keep a consistent scale across a set of figures, and make sure it still reads at 390 px wide.

## WebGL inside the drawing

Use a shader only for what lines can't draw: fire and exhaust, water and caustics, real lamp light, glow, steam. The parts stay SVG. The core rules come from the first shader figure, whose colour change between phases looked cut rather than crossfaded:

- **Three layers.** A back SVG holds what the effect covers, the canvas holds the effect (`pointer-events: none`), and a front SVG holds what covers it. Split a part, or the effect, when it is on both sides.
- **World space, same camera.** Build every shader point from `onFloor`, `onWallX` and `onWallY`, or march the pixel's ray `rayOf(vb) + t·towardViewer()`. Size everything in world units times `uK`. Anything lying on a plane registers exactly with that plane's SVG lines.
- **Nothing pops.** Every uniform follows an envelope with an attack and a decay (the kit's `burst` for events, `settle` for levels). Phase changes are crossfades where colour shifts continuously with the physical quantity, and a fade-out only gets darker.
- **No hard cut-offs.** Every term reaches zero before any `if`, bound or canvas edge, and before any cell edge of a cell noise.
- **Seen through an opening, masked twice.** Content behind a window or a recess is masked in its own plane and by the opening in the face plane, multiplied (`references/webgl.md`, section 5).
- **Blending.** Use `tonemap()` and dither. In dark, a canvas that only adds light uses premultiplied output with `mix-blend-mode: screen`, and one that must also darken (the ripple tank's water) stays normal-blended.
- **Light theme ships, and its shaders are designed for paper.** Use normal premultiplied alpha, never screen. Write the colour the paper should show and solve for the ink. A glow is a saturated body with a pale core, a coloured rim and an alpha floor, never a darkened dark-theme colour: that gave the Raptor's "red ink smoke".
  - What the light falls on takes a tint, and the cavity that holds it gets a darker physical ground (soot, refractory, water depth).
  - Hot bodies follow one blackbody ink table shared with the fallback.
  - Ink only grows with light: fade the finished ink once, never one term at a time.
  - Ink ends at each stroke's inner edge.
  - Measure ink per frame. `references/webgl.md`, section 8, has the recipes and the faults reviewers found.
- **Restraint.** Cap the device ratio at 1.5 and render only while the effect is active and onscreen. Reduced motion gets one still frame, and the SVG must still read without WebGL.

Read `references/webgl.md` before writing any shader.

## Printable sheets (A4)

When the user wants the figure on paper (a handout, a poster, a PDF, an A4 or Letter sheet), print it from the finished figure instead of drawing again. Write a `sheet.mjs` next to the build: the poses to capture as `drive.mjs` actions, the parts as CSS selectors over the live SVG, and the words, every one of them true to the model. Then run `node scripts/print.mjs sheet.mjs --format all --png` and read every page.

- **poster** (the default): one page, the name set large, the question, big numbers, the figure with numbered pins and every part with one line.
- **drawing**: one page, a technical drawing with a parts list, a specification, an inset and a strip of steps with the working parts lit.
- **detailed**: 2–4 pages, scaled to the machine: an overview with pins and round close-ups; "How it works" with each step as a large lit still (six per page, the why in the last slot); and for complex figures an "Assemblies" page with up to four large close-ups of part groups (`assemblies` in the spec). A simple figure stays at 2 pages; `maxPages` caps it.

Offer all three when the user hasn't picked one. When the page shows a figure that has a PDF, put a link to it on the card with `pdfButton(href)` from `kit/pdf-button.mjs` inside the plate body (see `examples/push-button/build.mjs`); print first, then rebuild the page. `examples/raptor-engine/sheet.mjs` and `examples/arcade-cabinet/sheet.mjs` are the references. Read `references/print.md` first.

## References

Read these as you need them:

- `references/craft.md`: part I is the specimen doctrine (what a good specimen is, the organ parts vocabulary, fields, tissues and joins, vessels, sections, membranes, pieces, views, and the anti-patterns found in this fork); part II is the machine craft for mounts and instruments, including the parts vocabulary with code, tone tables, painter's order patterns, round parts, pipes and harnesses, exploded views, screens on faces, and the anti-patterns that got figures rejected. Read it before designing.
- `references/kit.md`: the API, with signatures and examples.
- `references/motion.md`: live behaviour (loops, springs, tours, pointer, keyboard, accessibility, reduced motion), plus envelopes for one-shot events, exploded views, depth re-sorting and arming, in vanilla JS and React.
- `references/react.md`: the React/Next.js server/client split, element props and the large-payload key-warning trap.
- `references/verify.md`: the `capture.mjs` and `drive.mjs` commands, the review checklist (including shaders) and common faults.
- `references/webgl.md`: shaders inside the drawing: when one earns its place, the layer stack, the camera contract, ray-marching in the iso camera, the full API with a minimal page, the craft rules with the bugs that taught them, the light theme (inks on paper, per-phenomenon recipes, the reviewers' faults), and how to verify them.
- `references/walkthrough.md`: how the test rig was designed, step by step, from concept to code.
- `references/print.md`: printable A4 or Letter sheets from a built figure: the three formats, the `sheet.mjs` spec (poses, parts as selectors, focus, hide, crops, rasters for WebGL) and how to check the PDF.
