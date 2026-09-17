// Layout engine. Pure functions, no DOM. Works in the browser and in Node (see test/).
//
// Every number here was measured from real PDFs produced by the Ross iMpact resume builder
// (Aspose.PDF, Calibri). The wrap and spacing model reproduced 13 real resumes line for line.
import { METRICS } from "./metrics.js";

export const G = {
  PAGE_W: 612, PAGE_H: 792,
  LEFT_X: 50.4,          // section labels and years (0.7 in margin)
  RIGHT_X: 561.6,        // right text edge (0.7 in margin)
  COL_X: 129.6,          // organization, title, bullet glyph
  TEXT_X: 138.24,        // bullet text, first and wrapped lines
  WRAP_W: 423.36,        // usable width of one bullet line
  LEFT_COL_W: 76,        // years / labels column (79.2 minus a little air)
  COL_W: 432,
  NAME_Y: 55.25, RULE_Y: 72.41,
  P_NAME_CONTACT: 11.9488, P_CONTACT_ORG: 16.9456,
  P_LINE: 11.33,         // wrapped line inside a bullet
  P_BUL_EDU: 11.834,     // next bullet in Education / Additional
  P_BUL_EXP: 12.194,     // next bullet in Experience
  P_TO_ORG: 18.2055,     // last bullet line -> next organization line
  P_EXP_ORG_SUB: 11.3194, P_EXP_SUB_BUL: 11.165,
  P_EDU_ORG_SUB: 11.4845, P_EDU_LINE: 11.33,
  P_TO_ADD: 17.33,       // last bullet line -> first Additional bullet
  LABEL_DROP: 0.876,     // 12 pt text sits this far below 11 pt text in the same row
  P_LEFT: 12.36,
  SAFE_LAST_BASELINE: 751.25, // lowest last-line baseline proven to stay on page one
  PAGE2_FIRST: 51.749,        // first 11 pt baseline on a continuation page
  AVG_CHAR: 4.555,            // average character width at 11 pt, for "room left" hints
};

export const LABELS = ["", "Summer(s)", "Fall", "Winter", "Spring", "Action-Based Learning", "MAP", "Part-time", "Volunteer"];

// ---------- text ----------
export function clean(text) {
  let s = String(text ?? "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[\t\r\n ]+/g, " ").replace(/ {2,}/g, " ").trim();
  let out = "";
  for (const ch of s) out += METRICS.regular[ch.codePointAt(0)] !== undefined ? ch : "?";
  return out;
}

export function textWidth(text, size = 11, bold = false) {
  const t = bold ? METRICS.bold : METRICS.regular;
  let units = 0;
  for (const ch of text) units += t[ch.codePointAt(0)] ?? 1038;
  return (units / 2048) * size;
}

// Greedy wrap. Breaks at spaces and after hyphens, like the real builder.
export function wrap(text, limit = G.WRAP_W, size = 11, bold = false) {
  const pieces = [];
  for (const word of text.split(" ")) {
    if (!word) continue;
    const parts = word.match(/[^-]*-+|[^-]+/g) || [word];
    parts.forEach((p, i) => pieces.push([p, i === 0]));
  }
  const lines = [];
  let cur = "";
  for (const [piece, spaced] of pieces) {
    const cand = cur === "" ? piece : cur + (spaced ? " " : "") + piece;
    if (cur === "" || textWidth(cand, size, bold) <= limit) cur = cand;
    else { lines.push(cur); cur = piece; }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function yearsText(e) {
  const sy = String(e.startYear ?? "").trim(), ey = String(e.endYear ?? "").trim();
  if (!sy && !ey) return e.present ? "Present" : "";
  if (e.present) return `${sy || ey}-Present`;
  if (sy && ey && sy !== ey) return `${sy}-${ey}`;
  return sy || ey;
}

export function labelText(e) {
  if (!e.label) return "";
  if (e.label !== "Summer(s)") return e.label;
  const sy = String(e.startYear ?? "").trim(), ey = String(e.endYear ?? "").trim();
  return e.present || (sy && ey && sy !== ey) ? "Summers" : "Summer";
}

const liveBullets = (list) => (list || []).filter((b) => !b.hidden && clean(b.text));

// ---------- layout ----------
// Returns { pages: [[item]], bullets: {id: info}, fit: {...} }.
// item = { kind, x?, y, text, size, bold, align?, color?, link?, parts? }
export function layoutResume(data) {
  const items = [];      // continuous coordinates first, paginated at the end
  const bullets = {};
  let group = 0;         // pagination unit: an entry header with its first bullet, or one bullet
  let y = G.NAME_Y;
  let last = "contact";
  let pendingLabel = null;

  const push = (it) => { items.push({ group, ...it }); };

  push({ kind: "name", y, text: clean(data.name).toUpperCase(), size: 15, bold: true });
  y += G.P_NAME_CONTACT;
  const parts = (data.contact || []).map(clean).filter(Boolean);
  push({ kind: "contact", y, parts, size: 11 });

  const putLeft = (texts, y0) => {
    let yy = y0;
    for (const t of texts) {
      for (const line of wrap(t, G.LEFT_COL_W, 12, true)) {
        push({ kind: "left", x: G.LEFT_X, y: yy, text: line, size: 12, bold: true });
        yy += G.P_LEFT;
      }
    }
  };

  const putBullets = (list, pitch, firstPitch, newGroupForFirst) => {
    liveBullets(list).forEach((b, bi) => {
      const lines = wrap(clean(b.text));
      if (bi > 0 || newGroupForFirst) group++;
      y += bi === 0 ? firstPitch : pitch;
      if (pendingLabel) { putLeft([pendingLabel], y + G.LABEL_DROP); pendingLabel = null; }
      lines.forEach((t, li) => {
        if (li) y += G.P_LINE;
        if (li === 0) push({ kind: "dot", x: G.COL_X, y, text: "•", size: 11, bold: true });
        push({ kind: "body", x: G.TEXT_X, y, text: t, size: 11 });
      });
      const lastW = textWidth(lines[lines.length - 1]);
      bullets[b.id] = {
        lines: lines.length,
        lastFill: lastW / G.WRAP_W,
        roomChars: Math.max(0, Math.floor((G.WRAP_W - lastW) / G.AVG_CHAR)),
        lastChars: lines[lines.length - 1].length,
        tooWide: lines.some((l) => textWidth(l) > G.WRAP_W),
      };
      last = "bullet";
    });
  };

  const putHeaderLines = (texts, firstPitch, bold) => {
    texts.forEach(([t, b], i) => {
      wrap(t, G.COL_W, 11, b).forEach((line, li) => {
        y += i === 0 && li === 0 ? firstPitch : G.P_LINE;
        push({ kind: "sub", x: G.COL_X, y, text: line, size: 11, bold: b });
      });
    });
  };

  const section = (title, entries, isEdu) => {
    const live = (entries || []).filter((e) => clean(e.org) || clean(e.title) || clean(e.sub) || liveBullets(e.bullets).length);
    if (!live.length) return;
    pendingLabel = title;
    for (const e of live) {
      group++;
      y += last === "contact" ? G.P_CONTACT_ORG : G.P_TO_ORG;
      last = "org";
      const loc = clean(e.loc);
      const locW = loc ? textWidth(loc, 11, true) : 0;
      const orgLines = wrap(clean(e.org).toUpperCase() || " ", G.COL_W - locW - (loc ? 14 : 0), 12, true);
      const leftTexts = [];
      if (pendingLabel) { leftTexts.push(pendingLabel); pendingLabel = null; }
      if (!isEdu) { const yt = yearsText(e), lt = labelText(e); if (yt) leftTexts.push(yt); if (lt) leftTexts.push(lt); }
      putLeft(leftTexts, y);
      orgLines.forEach((line, li) => {
        if (li) y += G.P_LEFT;
        push({ kind: "org", x: G.COL_X, y, text: line, size: 12, bold: true });
        if (li === 0 && loc) push({ kind: "loc", x: G.RIGHT_X, y: y - G.LABEL_DROP, text: loc, size: 11, bold: true, align: "right" });
      });
      if (isEdu) {
        const heads = [];
        if (clean(e.sub)) heads.push([clean(e.sub), true]);
        if (clean(e.deg)) heads.push([clean(e.deg), false]);
        putHeaderLines(heads, G.P_EDU_ORG_SUB, true);
        putBullets(e.bullets, G.P_BUL_EDU, heads.length ? G.P_EDU_LINE : G.P_EDU_ORG_SUB, false);
      } else {
        const hasTitle = !!clean(e.title);
        if (hasTitle) putHeaderLines([[clean(e.title), true]], G.P_EXP_ORG_SUB, true);
        putBullets(e.bullets, G.P_BUL_EXP, hasTitle ? G.P_EXP_SUB_BUL : G.P_EXP_ORG_SUB, false);
      }
    }
  };

  section("EDUCATION", data.education, true);
  section("EXPERIENCE", data.experience, false);
  if (liveBullets(data.additional).length) {
    pendingLabel = "ADDITIONAL";
    putBullets(data.additional, G.P_BUL_EDU, last === "contact" ? G.P_CONTACT_ORG : G.P_TO_ADD, true);
  }

  // ---------- fit on a single continuous page ----------
  const bodyKinds = new Set(["org", "sub", "body"]);
  const body = items.filter((it) => bodyKinds.has(it.kind));
  const lastBaseline = body.length ? Math.max(...body.map((it) => it.y)) : y;

  // ---------- pagination: whole groups move to the next page ----------
  const pages = [[]];
  let offset = 0;
  const groups = new Map();
  for (const it of items) { if (!groups.has(it.group)) groups.set(it.group, []); groups.get(it.group).push(it); }
  for (const [, its] of groups) {
    const rightKinds = its.filter((it) => it.kind !== "left");
    const bottom = Math.max(...rightKinds.map((it) => it.y));
    const tall = bottom - Math.min(...rightKinds.map((it) => it.y)) > G.SAFE_LAST_BASELINE - G.PAGE2_FIRST;
    if (bottom - offset > G.SAFE_LAST_BASELINE && pages[pages.length - 1].length && !tall) {
      const first = its.find((it) => it.kind === "org" || it.kind === "dot" || it.kind === "body");
      const firstBase = first.size === 12 ? first.y - G.LABEL_DROP : first.y;
      offset = firstBase - G.PAGE2_FIRST;
      pages.push([]);
    }
    for (const it of its) pages[pages.length - 1].push({ ...it, y: it.y - offset });
  }

  const spare = G.SAFE_LAST_BASELINE - lastBaseline;
  const fit = {
    lines: body.length,
    lastBaseline,
    pages: pages.length,
    spare,
    linesLeft: spare >= 0 ? Math.floor(spare / G.P_LINE) : 0,
    linesOver: spare < 0 ? Math.ceil(-spare / G.P_LINE) : 0,
  };
  return { pages, bullets, fit };
}

// Horizontal placement of the centered contact line. Shared by the preview and the PDF.
export function contactRuns(parts) {
  const SEP = 4.75, dotW = textWidth("•", 11, true);
  const total = parts.reduce((s, p) => s + textWidth(p), 0) + Math.max(0, parts.length - 1) * (2 * SEP + dotW);
  let x = 306 - total / 2;
  const runs = [];
  parts.forEach((p, i) => {
    const isLink = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+\/\S*$/i.test(p) || /linkedin\.com/i.test(p);
    runs.push({ x, text: p, bold: false, link: isLink ? (/^https?:/i.test(p) ? p : "https://" + p) : null, w: textWidth(p) });
    x += textWidth(p);
    if (i < parts.length - 1) { runs.push({ x: x + SEP, text: "•", bold: true, link: null, w: dotW }); x += 2 * SEP + dotW; }
  });
  return runs;
}
