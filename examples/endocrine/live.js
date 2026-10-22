__MODEL__
const D = __DATA__;
const L = D.text;
const stage = document.querySelector(".en-stage");
const svgs = [...stage.querySelectorAll("svg[data-view]")];
const views = svgs.map((svg) => ({ svg, heart: svg.querySelector('[data-part="heart"]'), brake: svg.querySelector('[data-part="brake"]'), waves: svg.querySelector('[data-part="waves"]'), groups: [...svg.querySelectorAll("[data-g]")] }));
const dots = [...document.querySelectorAll(".en-dot")];
const readout = document.querySelector("[data-readout]");
const meters = [...document.querySelectorAll(".en-level")].map((el) => ({ bar: el.querySelector("b"), value: el.querySelector("output") }));
const still = matchMedia("(prefers-reduced-motion: reduce)");
const HOLD = 4;
const STILL_AT = 14;
const LIT = {
  perceive: ["alarm", "cns"],
  nerve: ["hypothalamus", "sympathetic", "adrenal-medulla", "heart"],
  adrenaline: ["sympathetic", "adrenal-medulla", "heart"],
  crh: ["hypothalamus", "pituitary-a"],
  acth: ["pituitary-a", "adrenal-cortex"],
  brake: ["hypothalamus", "pituitary-a", "adrenal-cortex"],
  falling: [],
  rest: [],
};
const CHANNELS = ["blood", "cns", "nerve", "aff", "neu", "vag", "crh", "acth", "cor", "adr"];
const NERVES = ["cns", "nerve", "aff", "neu", "vag"];
let current = D.first;
let r = 0;
let beat = 0;
let lit = "";
let visible = false;
let frame = 0;
let last = 0;
let drag = null;
const phase = Object.fromEntries(CHANNELS.map((ch) => [ch, 0]));
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const level = (v, base = 0.1, span = 0.55) => clamp01((v - base) / span);
const number = (v) => v.toFixed(2).replace(".", L.decimal);
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };

function light(names) {
  const key = names.join(" ");
  if (key === lit) return;
  lit = key;
  for (const g of views[current].groups) {
    if (names.includes(g.dataset.g)) g.setAttribute("data-lit", "");
    else g.removeAttribute("data-lit");
  }
}

function show(index) {
  current = (index + views.length) % views.length;
  views.forEach((v, i) => {
    if (i === current) v.svg.setAttribute("data-on", ""); else v.svg.removeAttribute("data-on");
    v.svg.setAttribute("aria-hidden", i === current ? "false" : "true");
  });
  dots.forEach((dot, i) => (i === current ? dot.setAttribute("aria-current", "true") : dot.removeAttribute("aria-current")));
  lit = "?";
}

function draw(dt, now) {
  const play = still.matches ? STILL_AT : Math.min(r, DURATION);
  const t = modelTime(play);
  const row = read(D.rows, t);
  const [, nerve, adrenaline, crh, acth, cortisol] = row;
  const css = stage.style;
  const alarm = play > 0 && t < THREAT;
  const levels = { blood: 0.3, cns: nerve, nerve, aff: alarm ? 1 : 0, neu: 0, vag: 0, crh: level(crh), acth: level(acth), cor: level(cortisol, 0.1, 0.35), adr: adrenaline };
  for (const ch of CHANNELS) css.setProperty(`--lv-${ch}`, levels[ch].toFixed(3));
  const bpm = bpmOf(adrenaline);
  const moving = still.matches ? 0 : 1;
  for (const ch of CHANNELS) phase[ch] = (phase[ch] + (NERVES.includes(ch) ? 60 : 14 * (bpm / REST_BPM)) * moving * dt) % 9000;
  for (const ch of CHANNELS) css.setProperty(`--ph-${ch}`, phase[ch].toFixed(2));
  light(LIT[phaseOf(t, row)]);
  const v = views[current];
  beat = (beat + moving * dt * (bpm / 60)) % 1;
  const squeeze = moving ? Math.pow(Math.sin(Math.PI * beat), 6) : 0;
  const [hx, hy] = D.views[current].heart;
  v.heart.setAttribute("transform", squeeze ? `translate(${hx} ${hy}) scale(${(1 - 0.05 * squeeze).toFixed(4)}) translate(${-hx} ${-hy})` : "");
  v.brake.style.opacity = level(cortisol, 0.16, 0.24).toFixed(3);
  v.waves.style.opacity = (alarm ? (moving ? 0.55 + 0.45 * Math.sin(now / 160) : 1) : 0).toFixed(3);
  const step = phaseOf(t, row);
  say(`t ${clockText(t).replace(".", L.decimal)} · ${L.phases[step]}`);
  [nerve, adrenaline, crh, acth, cortisol].forEach((value, i) => {
    const text = number(value);
    if (meters[i].value.textContent !== text) {
      meters[i].value.textContent = text;
      meters[i].bar.style.width = `${(clamp01(value) * 100).toFixed(1)}%`;
    }
  });
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  r += dt;
  if (r > DURATION + HOLD) r = 0;
  draw(dt, now);
  frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
}
const run = () => {
  if (!frame && visible && !still.matches) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
const turn = (index) => { show(index); draw(0, performance.now()); };
document.querySelectorAll(".en-step").forEach((button) => button.addEventListener("click", () => turn(current + Number(button.dataset.step))));
dots.forEach((dot) => dot.addEventListener("click", () => turn(Number(dot.dataset.go))));
stage.addEventListener("keydown", (event) => {
  const keys = { ArrowLeft: () => turn(current - 1), ArrowRight: () => turn(current + 1), Home: () => turn(D.first) };
  if (!keys[event.key]) return;
  event.preventDefault();
  keys[event.key]();
});
stage.addEventListener("pointerdown", (event) => { drag = { x: event.clientX, from: current }; });
stage.addEventListener("pointermove", (event) => {
  if (!drag) return;
  const steps = Math.trunc((event.clientX - drag.x) / 70);
  if (drag.from + steps !== current) turn(drag.from + steps);
});
addEventListener("pointerup", () => { drag = null; });
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "80px 0px" }).observe(stage);
still.addEventListener?.("change", () => { draw(0, performance.now()); run(); });
show(current);
draw(0, performance.now());
