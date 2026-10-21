const VIEWS = __VIEWS__;
const stage = document.querySelector(".sp-stage");
const svgs = [...stage.querySelectorAll("svg[data-view]")];
const dots = [...document.querySelectorAll(".sp-dot")];
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
let current = 0;
let idle = 0;
let tour = 0;
let drag = null;
function show(index) {
  current = (index + VIEWS.length) % VIEWS.length;
  svgs.forEach((svg, i) => {
    if (i === current) svg.setAttribute("data-on", ""); else svg.removeAttribute("data-on");
    svg.setAttribute("aria-hidden", i === current ? "false" : "true");
  });
  dots.forEach((dot, i) => (i === current ? dot.setAttribute("aria-current", "true") : dot.removeAttribute("aria-current")));
  if (readout.textContent !== VIEWS[current].say) readout.textContent = VIEWS[current].say;
}
const touring = () => {
  clearInterval(tour);
  if (!still.matches) tour = setInterval(() => show(current + 1), 6000);
};
const hold = () => {
  clearInterval(tour);
  clearTimeout(idle);
  idle = setTimeout(touring, 9000);
};
document.querySelectorAll(".sp-step").forEach((button) => button.addEventListener("click", () => { hold(); show(current + Number(button.dataset.step)); }));
dots.forEach((dot) => dot.addEventListener("click", () => { hold(); show(Number(dot.dataset.go)); }));
stage.addEventListener("keydown", (event) => {
  const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
  if (event.key === "Home") { event.preventDefault(); hold(); show(0); return; }
  if (!step) return;
  event.preventDefault();
  hold();
  show(current + step);
});
stage.addEventListener("pointerdown", (event) => { drag = { x: event.clientX, from: current }; });
stage.addEventListener("pointermove", (event) => {
  if (!drag) return;
  const steps = Math.trunc((event.clientX - drag.x) / 70);
  if (drag.from + steps !== current) { hold(); show(drag.from + steps); }
});
addEventListener("pointerup", () => { drag = null; });
new IntersectionObserver((entries) => { if (entries[entries.length - 1].isIntersecting) touring(); else clearInterval(tour); }, { rootMargin: "80px 0px" }).observe(stage);
still.addEventListener?.("change", touring);
show(0);
