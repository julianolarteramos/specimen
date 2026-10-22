# Changelog

All notable changes to specimen are recorded here. Specimen is a fork of [Anatomy](https://github.com/wheresryan22/anatomy) by Ryan; the entries for 1.1.0 and earlier are Anatomy's own, kept for its history. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Releases follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html); entries from before the first release are dated.

## [Unreleased]

### Removed

- Specimen fork: publishing to the Anatomy community gallery. `scripts/publish.mjs`, `references/publish.md`, `scripts/session.mjs` (the session log reader it used for time and tokens), `scripts/fingerprint.mjs` and their tests. Specimen has no gallery; share a figure by sharing its build script and page.
- Specimen fork: the 3D `turn` mode (beta, convex parts only). `kit/turn.mjs`, `turn-build.mjs`, `turn-audit.mjs`, `turn-fixed.mjs`, `canvas-painter.mjs` and `gl-shared.mjs`, `GLSL_TURN` and `glslPose` in `kit/gl.mjs`, `turnScript` and `fixedScript` in `scripts/inline-kit.mjs`, the `turn` and `orbit` actions of `drive.mjs`, `scripts/turn-check.mjs`, `turn-fidelity.mjs` and `turn-bench.mjs` with their tests, `examples/turning-dial/` and `references/3d.md`. Rotation in specimen is a set of pre-generated azimuth views with a crossfade, each view audited.

### Added

- Specimen fork: `examples/endocrine`, the endocrine system in the back half of a torso cut on the coronal plane, in five audited views and in English and Spanish (`endocrine-es.html`). Glands, vessels and nerves are fields; vessels and nerves are cut into depth-sortable pieces. A pure model (`model.mjs`) plays the stress response on a loop: the sympathetic path to the adrenal medulla and adrenaline, then CRH, ACTH and cortisol, then the cortisol brake on the hypothalamus and pituitary. It lights the glands that act, drives the hormone flows and the heartbeat, and shows the time, the step and five levels. It is the figure of a 48-step class presentation on the endocrine system.

- Specimen fork: three more organs on the shared builder `examples/shared/specimen.mjs` (plinth and rod, parallel audited views, crossfade card): `examples/kidney` (with its adrenal, whole and in coronal section, coloured by field `cores`), `examples/brain` (gyri carved by a band-limited field, the lateral fissure and central sulcus, cerebellar folia) and `examples/liver` (lobes, falciform ligament, gallbladder, porta and inferior vena cava). `B.grow`, `B.veilSvg` and `veil: { opacity }` items draw membranes; the heart gains a view inside its pericardium.

- Specimen fork: `B.split(root, seeds)` cuts a field into depth-sortable pieces along bisector planes; pieces draw no outline or contour along their cut, so a vessel tree that passes in front of one part and behind another can be ordered. `B.halfspace`, `B.intersect` and cut-face tissues on `carve` and `clip` build sections; `paint(..., { tones: "overlay", base, banded })` draws tones as shared translucent veils over flat tissue layers.

- Specimen fork: organic parts. `kit/blob.mjs` builds signed distance fields from balls, ellipsoids, tapered round cones and vessels (`ball`, `ellipsoid`, `capsule`, `vessel`), joined with a polynomial smooth union (`blend`), carved (`carve`), cut by planes (`clip`) or written by hand (`custom`), with tissue materials and graded tissue mixes. `paint(F, P)` ray-marches one ray per screen cell at build time (coarse to fine, hierarchical culling), bisects every crossing and contours the outline, the four light bands, the tissue layers and the inner contours (depth jumps fade where they end), and `fieldSvg` writes seamless kit solids. `kit/audit.mjs` gains `A.field(F)` and an `organic` option (a tube end may sink into a field along its inward normal; declared `blend` pairs are excused), plus two failing lines: fields without bounds and fields steeper than their Lipschitz bound. `examples/heart/` is a classroom heart model in four audited views.

- Printable sheets. `scripts/print.mjs` freezes poses of a built figure as vector stills (WebGL as a 2× PNG) and prints one A4 or US Letter PDF in three formats: `poster` (one page: big name, numbers, pinned figure and a line per part), `drawing` (one page: parts list, specification, inset and a strip of lit steps) and `detailed` (two pages: pinned figure with round close-ups, then large lit steps with text and the why). Parts are CSS selectors over the live SVG, so any figure can be printed; crowded pins spread apart with hairline leaders, and the script fails when a format runs past its pages. `examples/raptor-engine/sheet.mjs` and `examples/arcade-cabinet/sheet.mjs` are the references, `references/print.md` the guide.
- Antigravity support, alongside Claude Code, OpenCode and Codex. Documented user and project installation paths in the README and CONTRIBUTING, updated SKILL.md compatibility, and added Antigravity to the bug report form.
- MiniMax Code support. The README and CONTRIBUTING document its user (`~/.minimax/skills`) and project (`.minimax/skills`) folders and `npx skills add ... -a minimax-code`, SKILL.md lists it, and the bug report form offers it.

### Changed

- Specimen fork: lighter organ pages. `fieldSvg` draws the contour lines that share a tone, fade step and free end as one path; `paint` simplifies contours and their fade ramps to `lineSmooth` (0.12 px), and fits each overlay tone ring to a tolerance that follows its width, up to `toneSmooth`. The brain sets `toneSmooth: 2.5` and `lineSmooth: 0.2`: its views drop from about 180–200 KB to 93–98 KB and its page from 603 to 335 KB, with the same gyri and sulci at 1× and 4×. The heart page drops from 610 to 556 KB and the kidney from 221 to 219 KB, with the same look.
- Specimen fork: the liver is remodelled (`examples/liver/model.mjs`). The right lobe is about five times the left by volume, the left lobe tapers to the left, and the anterior and visceral surfaces meet at a sharp inferior border. The falciform ligament is a low fold with its own tone from the top of the liver to the notch in the border, where the round ligament passes under; the tone bands run on across it. The gallbladder sits in its fossa with the fundus just past the border; at the porta the bile duct lies in front on the right, the hepatic artery in front on the left and the portal vein behind, all cut short; the inferior vena cava lies in its groove at the back. The views are the front, from the right and from behind.
- A Figure no longer quotes a time to the user. The 30–90 minute estimate was often far longer than the build itself ([#41](https://github.com/wheresryan22/anatomy/issues/41)).

### Fixed

- Specimen fork: a surface takes the tissue of the leaf whose own surface passes through it, the nearest if several do; where none does (a carved wall, a blend fillet) it keeps the leaf it lies deepest in, and tissue mixes still weigh signed distances, so carved chamber walls keep their tissue.
- Specimen fork: contour lines are simplified by their distance to each chord segment, not to its infinite line, so a contour that hooks back at its end keeps the hook and the lines snapped to it stay attached.
- Line-end audits follow cubic and quadratic strokes with a bounded screen-space approximation, so lines attached between curve samples are not reported as loose.

- `drive.mjs` waits for the page to load (up to 10 s) before it runs the first action, and gives up with an error when Chrome leaves a request unanswered for 60 s instead of hanging, as `capture.mjs` now does.
- `drive.mjs` rejects an `orbit` whose step is zero or points away from its end angle, and a `sheet` whose count is not a whole number of at least 1, before Chrome starts. A zero step used to capture frames without ever finishing; the others died with `Cannot read properties of undefined (reading 'width')`.
- `publish.mjs --force` keeps the figure it was replacing when the new publish fails (a `--pages` file that does not exist, files that reach outside the folder, a failed build), and a missing `--pages` file now says `page X not found` instead of a bare `ENOENT`.
- `publish.mjs` rejects unsupported license values before building a figure, matching the community gallery's MIT and CC-BY-4.0 schema.
- `capture.mjs` rejects option values it cannot use (`--zoom` without four numbers, `--hover` without two, a non-numeric `--width`, `--scale`, `--wait` or `--times`, a `--theme` other than dark or light) before Chrome starts, instead of saving a shot as if they had been honoured.
- `turn-fidelity.mjs` transforms upright prisms through their authoring frame `F` (`F.o`, `F.u`, `F.v` and downward `F.a`) before calling `k.extrude`, so `turn-check.mjs --fidelity` matches `T.prism` on upright frame-authored and vertically split prisms.
- `audit.mjs` `supports` samples stiff tube surfaces on rings perpendicular to each segment's tangent (`ringAround`) instead of flat horizontal `XY` circles, so horizontal and inclined tubes detect vertical and perpendicular support contacts and no longer bridge air gaps past their flat end caps.
- A repeated vertex in a `T.prism` polygon no longer pushes a rounded corner outside the polygon: `roundedPolygon` drops consecutive duplicate points before it rounds.
- `T.prism` rejects a star polygon such as a pentagram, which turns the same way at every vertex but winds twice, with the same "split it into convex pieces" error as any other non-convex part.
- The 3D turn audit samples a clip through its last instant and never past it. A clip whose length was not a whole number of frames was sampled beyond its end, or stopped short of its final pose.
- `capture.mjs` waits for the page to load before it touches it, even with `--wait 0`, and gives up with an error when Chrome leaves a request unanswered for 60 s instead of hanging.
- `drive.mjs` `until` times a condition inside the page, so one that is already true passes however short the wait, even on a slow machine; a promise that never settles still times out.
- Start headless Chrome on Windows from an elevated terminal: `capture.mjs`, `drive.mjs` and `turn-check.mjs` pass `--do-not-de-elevate` there. Chrome otherwise relaunches itself without the elevation, the process the script started exits with code 0, and the check stops with `Chrome exited before startup: 0` while the relaunched browser stays running.
- Resolve the current React readout target on every write so replaced readouts and anchors do not leave updates on detached elements.
- Reject drive `turn` and `orbit` actions when the page has no callable 3D turn controller, instead of reporting an unchanged figure as a successful turn.
- Await asynchronous `until` conditions without treating the promise itself as success, while enforcing the wait deadline.
- Capture measures the current figure before every screenshot, including moved, resized and timed zoom crops.
- `publish.mjs --submit` makes the fork again with gh 2.101 and later, which refuse `--remote` when a repository is named; gh never adds a remote in that case, so the flag is gone (#53).
- Ripple Tank's water and paper shaders read their ink colour from the same fixed per-theme uniform as every other tuned constant in the figure, instead of carrying its own hardcoded `pale ? light : dark` pair inline in GLSL.

## [1.1.0] - 2026-10-12

### Added

- `scripts/publish.mjs` and `references/publish.md`: share a finished framework-free figure in the community gallery, `wheresryan22/anatomy-community`. The script copies the figure, points its kit imports at the gallery's `.skill/` link, records the kit fingerprint (`scripts/fingerprint.mjs`) so the gallery can rebuild it with the same kit version, and copies only the source, under `figures/<author>/<id>/`. The gallery builds the pages in a locked sandbox. `--submit` sends it as a pull request after asking, making a fork when needed.
- `publish.mjs` records how long the figure took to make and how many tokens it used. In Claude Code it reads them from the session's own log (`scripts/session.mjs`, through `CLAUDE_CODE_SESSION_ID`, subagents included): from the request that made the figure to the request to publish it, idle gaps over 10 minutes left out and cache reads not counted. The plan shows both before anything is sent. `--minutes` and `--tokens` set them by hand, `--no-session` leaves them out.
- `publish.mjs` accepts `--agent Antigravity`, alongside Claude Code, OpenCode, Codex and Other.
- OpenCode and Codex support, alongside Claude Code. `SKILL.md` exposes `/anatomy` to OpenCode through `metadata`, `agents/openai.yaml` gives Codex its display name, and the README, CONTRIBUTING and the bug report form cover all three agents.

### Fixed

- Specimen fork: contour lines are simplified by their distance to each chord segment, not to its infinite line, so a contour that hooks back at its end keeps the hook and the lines snapped to it stay attached.
- Start headless Chrome on Linux: `capture.mjs`, `drive.mjs` and `turn-check.mjs` pass `--no-sandbox` there and find Playwright's Linux Chromium under `~/.cache/ms-playwright`, so the browser checks and the gallery's validator run on Linux hosts.
- `references/publish.md` clones the gallery with `--single-branch`, so contributors skip the previews branch and its images.
- `publish.mjs --submit` no longer stops with "already exists" when an earlier run without `--submit` left the figure's folder in the clone; it only asks for `--force` when the folder is already on the gallery's main.
- Preserve configured pipe clearances in broad-phase solid and pipe sampling.
- Observe replacement and late-mounted DOM targets through useInView.
- Check texture line attachments against rounded rectangle corners, including separate radii, SVG clamping and transformed outlines.
- Honor explicit capture, drive and line-check selectors, and scope reported readouts to the requested figure.
- Decode valid SVG attribute quotes, whitespace and XML character references in audit bounds.
- Exclude invisible empty clip intersections from authored SVG bounds.
- `scripts/drive.mjs` now fails when a browser evaluation throws or rejects, rather than reporting a clean successful session.
- The arcade cabinet now accepts coins with reduced motion enabled, preserving the meter, credit and power-on events when the coin animation is skipped.
- The turning dial stops its idle tour when reduced motion is enabled while the page is open and cancels its pending automatic restart while preserving keyboard and pointer input.
- `scripts/drive.mjs` now exits with status 1 and stops subsequent actions when an `until` condition times out.
- `scripts/capture.mjs` now creates the output directory for screenshots, including nested paths under `shots/`.
- The line-end check now includes the selected element when `--select` names an SVG, rather than checking only SVGs inside it.
- `scripts/drive.mjs` now rejects unknown actions before running the session, so a misspelled verification step cannot report success.
- Browser checks now fail promptly and remove their temporary profiles when Chrome exits before its debugging port is ready.
- The line-end check now uses ellipse boundaries and transformed circle boundaries, and treats hollow interiors as empty instead of solid dots.
- The line-end check now follows SVG arc curves instead of treating each arc as a straight chord.
- Capture and drive now fail when Chrome cannot load the requested page, instead of reporting a clean browser error page.
- Orbit checks reject invalid sampling steps and empty pose lists before a zero-state sweep can pass.
- Solid clearance audits rebuild cached surface grids when sampling spacing or cell size changes.
- Tube geometry audits use tapered radii instead of replacing every segment with an averaged cylinder.
- The line verifier reflects smooth Bezier controls only after the matching curve family.
- Capture and drive send native Enter activation so button and form checks perform their default action.
- Fixed-part and coverage bounds restore a closed SVG subpath origin before relative moves.
- Audit ray casts now refresh body camera coefficients when the projection direction changes, so repeated builds retain the correct depth order.
- Audit profile tracing now checks quarter-span deviations, preserving inflected analytic and smooth profiles whose midpoint lies on their chord.
- Depth-key solving now allows large acyclic figures to converge beyond 400 rounds and avoids choosing a cycle victim from an empty set of violated rules.
- Splitting now accepts default fixed rounds and preserves explicit prism/round ownership, so a pipe fitting can be split without inventing collisions with its own pipe.
- Turning builders now reject missing named part/parent groups and duplicate group names before authored motions silently become static or alias one value.
- Native fidelity checks now compare complete filled silhouettes for cut parts and honor open round ends in the kit reference, preserving deliberately unstroked cut edges.
- Tube fidelity checks path coverage in both directions when vertex counts differ, rejecting empty or truncated live silhouettes while preserving equivalent resampling.
- Solid clearances check sliding rods whose drawn reach changes, even when their stretching geometry leaves no relative translation to a stationary obstacle.
- React `Solid` honors the existing `paths.seamless` marker so smooth tone regions receive the same seam treatment as the plain SVG renderer.
- React `Dots` retains the kit's optional per-point opacity, including fading bolt circles and pulsing dots, while ordinary points remain opaque.
- Write the first readout value even when empty or issued before passive binding.
- Measure transformed rectangular and round SVG primitives through their true affine bounds.

## [1.0.0] - 2026-10-10

### Added

- `examples/arcade-cabinet/`, an upright arcade cabinet with its side panel off. A quarter rolls down the coin chute past the coin-switch wire into the cash box, the switch's pulse runs along its cable to the board, and the CRT warms up, self-tests and runs an attract mode drawn in the plane of the tilted monitor; the stick closes a microswitch under the panel. It draws in the light and dark themes and passes `--audit`.
- `examples/spot-plate/`, a second React figure from the same site as `test-rig`: six pairs of glass drops that run together into one piece of glass as a fan of feeler blades sets `merge`. It draws in the light and dark themes.
- A first workflow step, **Size it before you start**: every request is sized as a Figure (about 30–90 minutes), a Hero (2–4 hours) or an Epic (6 hours or more), and the estimate is told to the user first. An Epic is not started until the user chooses it over a proposed Hero version. Every size has a working page within the first hour, and Claude reports when a step runs past twice its share of the estimate.

### Fixed

- Specimen fork: contour lines are simplified by their distance to each chord segment, not to its infinite line, so a contour that hooks back at its end keeps the hook and the lines snapped to it stay attached.
- `examples/test-rig/` drew its glass button dark in the light theme. `stretch.css` now has light values for its own colours.

### Changed

- The workflow steps are renumbered 1–10.
- The 4× detail sweep scales with the size: the subject and mechanism for a Figure, the whole drawing for a Hero or an Epic. The density rule itself still holds for every figure.
## 2026-10-08

### Changed

- The skill is now called Anatomy: `name: anatomy` in `SKILL.md`, invoked as `/anatomy`. It was developed privately as `isometric-objects` before this date, without releases.
- The CSS tokens are now `--anatomy-*` (for example `--anatomy-card`, `--anatomy-face`, `--anatomy-shade-0`); they were `--iso-*`. Every example is rebuilt with the new names.
- The figure card (`.iso-plate`) is square and flat: no rounded corners and no floating shadow, just a 1 px rule in the drawing's mid tone.
- `SKILL.md` makes high detail a standing rule for every figure, raises the parts list to at least 40 parts (60–150 for a hero figure), and adds a 4× detail pass to the final check.

### Added

- The public repository: a README with screenshots of the examples, the MIT license, a contributing guide, a code of conduct, a security policy, issue forms, a pull request template, and a CI workflow that rebuilds every example and fails if a committed page changes.
- What the skill contains at this point: the workflow and craft rules in `SKILL.md`; the kit (SVG core, round parts, pipes, the geometry audit, the WebGL layer, React components, and the 3D mode in beta); eight references; the headless Chrome checks in `scripts/`; six examples (`dial-indicator`, `desk-computer`, `raptor-engine`, `ripple-tank`, `test-rig`, `turning-dial`); and five evals.
