__MODEL__
const VIEWS = __VIEWS__;
const stage = document.querySelector(".hr-stage");
const svgs = [...stage.querySelectorAll("svg[data-view]")];
const hearts = svgs.map((svg) => svg.querySelector('[data-part="heart"]'));
const dots = [...document.querySelectorAll(".hr-dot")];
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
let current = __DEFAULT__;
let bpm = REST_BPM;
let visible = false;
let frame = 0;
let clock = 0;
let last = 0;
let touring = !still.matches;
let idle = 0;
let tourAt = 0;
let drag = null;
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
function show(index) {
  current = (index + VIEWS.length) % VIEWS.length;
  svgs.forEach((svg, i) => {
    if (i === current) svg.setAttribute("data-on", ""); else svg.removeAttribute("data-on");
    svg.setAttribute("aria-hidden", i === current ? "false" : "true");
  });
  dots.forEach((dot, i) => (i === current ? dot.setAttribute("aria-current", "true") : dot.removeAttribute("aria-current")));
  stage.setAttribute("aria-valuetext", `view ${VIEWS[current].azimuth}°`);
}
function draw() {
  const beat = still.matches ? { scale: 1, phase: "diastole" } : beatAt(clock, bpm);
  const heart = hearts[current];
  if (heart) {
    const [cx, cy] = VIEWS[current].centre;
    heart.setAttribute("transform", beat.scale === 1 ? "" : `translate(${cx} ${cy}) scale(${beat.scale.toFixed(5)}) translate(${-cx} ${-cy})`);
  }
  say(`${VIEWS[current].cut ? "four-chamber cut · " : ""}${Math.round(bpm)} bpm · ${beat.phase}`);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  clock += dt;
  if (touring && clock - tourAt > 6) {
    tourAt = clock;
    show(current + 1);
  }
  draw();
  frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
const hold = () => {
  touring = false;
  clearTimeout(idle);
  idle = setTimeout(() => { touring = !still.matches; tourAt = clock; run(); }, 9000);
};
const turn = (step) => { hold(); show(current + step); draw(); };
const rate = (step) => { hold(); bpm = Math.max(LIMITS[0], Math.min(LIMITS[1], bpm + step)); draw(); };
document.querySelectorAll(".hr-step").forEach((button) => button.addEventListener("click", () => turn(Number(button.dataset.step))));
dots.forEach((dot) => dot.addEventListener("click", () => { hold(); show(Number(dot.dataset.go)); draw(); }));
stage.addEventListener("keydown", (event) => {
  const keys = { ArrowLeft: () => turn(-1), ArrowRight: () => turn(1), ArrowUp: () => rate(6), ArrowDown: () => rate(-6), Home: () => { hold(); show(DEFAULT_VIEW); draw(); } };
  if (!keys[event.key]) return;
  event.preventDefault();
  keys[event.key]();
});
stage.addEventListener("pointerdown", (event) => { drag = { x: event.clientX, from: current }; });
stage.addEventListener("pointermove", (event) => {
  if (!drag) return;
  const steps = Math.trunc((event.clientX - drag.x) / 70);
  if (drag.from + steps !== current) { hold(); show(drag.from + steps); draw(); }
});
addEventListener("pointerup", () => { drag = null; });
const DEFAULT_VIEW = current;
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "80px 0px" }).observe(stage);
still.addEventListener?.("change", () => { touring = !still.matches; draw(); run(); });
show(current);
draw();
