import { layoutResume, LABELS } from "./layout.js";
import { pageSvg } from "./preview.js";
import { buildPdf } from "./pdf.js";
import { normalize, blankState, toFile, toLayoutData, uid } from "./model.js";
import { SAMPLE_STATE } from "./sample.js";

const KEY = "rirm:v1";
const $ = (sel, root = document) => root.querySelector(sel);

// ---------- state ----------
let state = load();
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return normalize(JSON.parse(raw)); } catch (e) { /* storage unavailable */ }
  return normalize(SAMPLE_STATE);
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(toFile(state))); } catch (e) { /* ignore */ } }

// ---------- tiny DOM helper ----------
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") el.className = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid);
  return el;
}

// ---------- preview + hints ----------
let queued = false;
let lastLayout = null;
function refresh() {
  persist();
  if (queued) return;
  queued = true;
  setTimeout(() => {
    queued = false;
    try { lastLayout = layoutResume(toLayoutData(state)); } catch (err) { console.error(err); return; }
    $("#pages").innerHTML = lastLayout.pages.map((items, i) => pageSvg(items, i, i === 0)).join("");
    const f = lastLayout.fit, badge = $("#fit");
    if (f.pages === 1) {
      badge.className = "fit ok";
      badge.textContent = `One page · ${f.lines} lines · ` + (f.linesLeft === 0 ? "page is full" : `room for ${f.linesLeft} more line${f.linesLeft === 1 ? "" : "s"}`);
    } else {
      badge.className = "fit over";
      badge.textContent = `Runs onto page 2 · cut about ${f.linesOver} line${f.linesOver === 1 ? "" : "s"}`;
    }
    for (const el of document.querySelectorAll(".hint[data-bullet]")) {
      const info = lastLayout.bullets[el.dataset.bullet];
      if (!info) { el.textContent = ""; el.className = "hint"; continue; }
      let msg = `${info.lines} line${info.lines === 1 ? "" : "s"} · room for ~${info.roomChars} more characters`;
      let cls = "hint";
      if (info.tooWide) { msg = "One word is longer than a full line"; cls = "hint warn"; }
      else if (info.lines > 1 && info.lastFill < 0.3) { msg = `${info.lines} lines · last line holds only ${info.lastChars} characters. Trim that much to save a line`; cls = "hint warn"; }
      el.textContent = msg; el.className = cls;
    }
  }, 0);
}

// ---------- drag to reorder (mouse and touch) ----------
function sortable(listEl, onDone) {
  listEl.addEventListener("pointerdown", (e) => {
    const handle = e.target.closest(".handle");
    if (!handle) return;
    const item = handle.closest("[data-sort-id]");
    if (!item || item.parentElement !== listEl) return;
    e.preventDefault();
    try { handle.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or lost pointer */ }
    item.classList.add("dragging");
    const scroller = $("#editor");
    const recapture = () => { try { handle.setPointerCapture(e.pointerId); } catch (err) { /* fine */ } };
    let lastY = e.clientY;
    const place = () => {
      const sibs = [...listEl.children].filter((c) => c !== item);
      const before = sibs.find((s) => { const r = s.getBoundingClientRect(); return lastY < r.top + r.height / 2; });
      if (before) { if (item.nextElementSibling !== before) { listEl.insertBefore(item, before); recapture(); } }
      else if (listEl.lastElementChild !== item) { listEl.append(item); recapture(); }
    };
    const move = (ev) => { if (ev.pointerId !== e.pointerId) return; lastY = ev.clientY; place(); };
    // Keep scrolling while the pointer rests near an edge, even if it stops moving.
    const timer = setInterval(() => {
      const box = scroller.getBoundingClientRect();
      const paneScrolls = scroller.scrollHeight > scroller.clientHeight + 1;
      const top = paneScrolls ? box.top : 0, bottom = paneScrolls ? box.bottom : window.innerHeight;
      const dy = lastY < top + 60 ? -12 : lastY > bottom - 60 ? 12 : 0;
      if (!dy) return;
      if (paneScrolls) scroller.scrollBy(0, dy); else window.scrollBy(0, dy);
      place();
    }, 16);
    const up = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      clearInterval(timer);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      item.classList.remove("dragging");
      onDone([...listEl.children].map((c) => c.dataset.sortId));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  });
}
const reorder = (arr, ids) => { const byId = new Map(arr.map((x) => [x.id, x])); arr.splice(0, arr.length, ...ids.map((id) => byId.get(id)).filter(Boolean)); };

// ---------- form pieces ----------
function field(label, obj, key, opts = {}) {
  const input = h("input", {
    type: "text", value: obj[key] ?? "", placeholder: opts.placeholder || "", maxlength: opts.max || 300,
    inputmode: opts.numeric ? "numeric" : null, autocomplete: "off", spellcheck: opts.spell ? "true" : "false",
    oninput: (e) => { obj[key] = e.target.value; if (opts.after) opts.after(); refresh(); },
  });
  if (opts.disabled) input.disabled = true;
  return h("label", { class: "field " + (opts.cls || "") }, h("span", {}, label), input);
}

const grip = () => h("button", { class: "handle", type: "button", title: "Drag to reorder", "aria-label": "Drag to reorder" }, "☰");
const autoGrow = (ta) => { if (!ta.offsetParent) return; ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px"; };

function bulletList(list) {
  const ul = h("div", { class: "bullets" });
  const draw = () => {
    ul.replaceChildren(...list.map((b) => {
      const ta = h("textarea", { rows: 2, placeholder: "Start with a verb. Say what you did and what came of it.", spellcheck: "true",
        oninput: (e) => { b.text = e.target.value; autoGrow(e.target); refresh(); } });
      ta.value = b.text;
      requestAnimationFrame(() => autoGrow(ta));
      const row = h("div", { class: "bullet" + (b.hidden ? " is-hidden" : ""), dataset: { sortId: b.id } },
        grip(),
        h("div", { class: "bullet-main" }, ta, h("div", { class: "hint", dataset: { bullet: b.id } })),
        h("div", { class: "bullet-tools" },
          h("button", { type: "button", class: "icon", title: b.hidden ? "Hidden from the resume. Click to show" : "Hide from the resume without deleting",
            onclick: () => { b.hidden = !b.hidden; draw(); refresh(); } }, b.hidden ? "Show" : "Hide"),
          h("button", { type: "button", class: "icon danger", title: "Delete bullet",
            onclick: () => { list.splice(list.indexOf(b), 1); draw(); refresh(); } }, "✕")));
      return row;
    }));
  };
  draw();
  sortable(ul, (ids) => { reorder(list, ids); refresh(); });
  const add = h("button", { type: "button", class: "add", onclick: () => { list.push({ id: uid(), text: "", hidden: false }); draw(); ul.lastElementChild.querySelector("textarea").focus(); refresh(); } }, "+ Add bullet");
  return h("div", {}, ul, add);
}

function entryCard(list, e, isEdu, redraw) {
  const title = h("span", { class: "card-title" }, e.org || (isEdu ? "New school" : "New experience"));
  const setTitle = () => { title.textContent = e.org || (isEdu ? "New school" : "New experience"); };
  const head = h("div", { class: "card-head" }, grip(), title,
    h("button", { type: "button", class: "icon danger", title: "Delete this entry",
      onclick: () => { if (confirm("Delete this entry and its bullets?")) { list.splice(list.indexOf(e), 1); redraw(); refresh(); } } }, "Delete"));
  const grid = h("div", { class: "grid" });
  if (isEdu) {
    grid.append(
      field("School", e, "org", { after: setTitle, cls: "w2" }), field("Location", e, "loc", { placeholder: "Ann Arbor, MI" }),
      field("College or program", e, "sub", { cls: "w3" }), field("Degree line", e, "deg", { cls: "w3", placeholder: "Bachelor of Business Administration, May 2029" }));
  } else {
    const endField = field("End year", e, "endYear", { numeric: true, max: 4, disabled: e.present });
    const present = h("label", { class: "check" },
      h("input", { type: "checkbox", checked: e.present, onchange: (ev) => { e.present = ev.target.checked; endField.querySelector("input").disabled = e.present; refresh(); } }), "Present");
    const label = h("select", { onchange: (ev) => { e.label = ev.target.value; refresh(); } },
      LABELS.map((l) => h("option", { value: l, selected: l === e.label }, l || "No label")));
    grid.append(
      field("Organization", e, "org", { after: setTitle, cls: "w2" }), field("Location", e, "loc", { placeholder: "City, ST" }),
      field("Title", e, "title", { cls: "w3" }),
      field("Start year", e, "startYear", { numeric: true, max: 4 }), h("div", { class: "field end" }, endField, present),
      h("label", { class: "field" }, h("span", {}, "Label (optional)"), label));
  }
  return h("section", { class: "card", dataset: { sortId: e.id } }, head, grid, bulletList(e.bullets));
}

function entrySection(titleText, list, isEdu) {
  const wrap = h("div", { class: "entries" });
  const draw = () => wrap.replaceChildren(...list.map((e) => entryCard(list, e, isEdu, draw)));
  draw();
  sortable(wrap, (ids) => { reorder(list, ids); refresh(); });
  const add = h("button", { type: "button", class: "add big", onclick: () => {
    list.push(isEdu ? { id: uid(), org: "", loc: "", sub: "", deg: "", bullets: [{ id: uid(), text: "", hidden: false }] }
      : { id: uid(), org: "", loc: "", title: "", startYear: "", endYear: "", present: false, label: "", bullets: [{ id: uid(), text: "", hidden: false }] });
    draw(); wrap.lastElementChild.querySelector("input").focus(); refresh();
  } }, isEdu ? "+ Add school" : "+ Add experience");
  return h("div", { class: "block" }, h("h2", {}, titleText), wrap, add);
}

function renderForm() {
  $("#form").replaceChildren(
    h("div", { class: "block" }, h("h2", {}, "Header"),
      h("section", { class: "card" }, h("div", { class: "grid two" },
        field("Full name", state, "name", { cls: "w2" }), field("Email", state, "email"),
        field("Phone", state, "phone"), field("LinkedIn URL", state, "linkedin", { cls: "w2", placeholder: "linkedin.com/in/you" })))),
    entrySection("Education", state.education, true),
    entrySection("Experience", state.experience, false),
    h("div", { class: "block" }, h("h2", {}, "Additional"), h("section", { class: "card" }, bulletList(state.additional))));
}

const growAll = () => document.querySelectorAll("#form textarea").forEach(autoGrow);

// ---------- toolbar ----------
function download(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = h("a", { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
const fileBase = () => (state.name.trim() || "My") + " Resume";

$("#btn-pdf").addEventListener("click", async (e) => {
  const btn = e.currentTarget, old = btn.textContent;
  btn.disabled = true; btn.textContent = "Building…";
  try {
    const bytes = await buildPdf(layoutResume(toLayoutData(state)), fileBase());
    download(bytes, fileBase() + ".pdf", "application/pdf");
  } catch (err) { console.error(err); alert("Could not build the PDF: " + err.message); }
  btn.disabled = false; btn.textContent = old;
});
$("#btn-save").addEventListener("click", () => download(JSON.stringify(toFile(state), null, 2), fileBase() + ".json", "application/json"));
$("#btn-open").addEventListener("click", () => $("#file").click());
$("#file").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try { state = normalize(JSON.parse(await f.text())); renderForm(); refresh(); }
  catch (err) { alert("That file is not a resume saved from this app."); }
});
$("#btn-blank").addEventListener("click", () => { if (confirm("Clear everything and start from a blank resume?")) { state = blankState(); renderForm(); refresh(); } });
$("#btn-sample").addEventListener("click", () => { if (confirm("Replace your current resume with the sample?")) { state = normalize(SAMPLE_STATE); renderForm(); refresh(); } });
for (const tab of document.querySelectorAll("[data-view]")) tab.addEventListener("click", () => { document.body.dataset.view = tab.dataset.view; growAll(); });
window.addEventListener("resize", growAll);

renderForm();
refresh();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
