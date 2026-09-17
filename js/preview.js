// Draws laid-out pages as SVG. Every line is placed at the exact coordinates the PDF will use.
import { G, contactRuns, textWidth } from "./layout.js";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function textEl(x, y, text, size, bold, extra = "") {
  return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${size}" font-weight="${bold ? 700 : 400}" ${extra} xml:space="preserve">${esc(text)}</text>`;
}

export function pageSvg(items, pageIndex, showGuide) {
  let out = `<svg class="page" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${G.PAGE_W} ${G.PAGE_H}" role="img" aria-label="Resume page ${pageIndex + 1}">`;
  out += `<rect width="${G.PAGE_W}" height="${G.PAGE_H}" fill="#fff"/>`;
  for (const it of items) {
    if (it.kind === "name") {
      out += textEl(306 - textWidth(it.text, 15, true) / 2, it.y, it.text, 15, true);
    } else if (it.kind === "contact") {
      for (const r of contactRuns(it.parts)) {
        out += textEl(r.x, it.y, r.text, 11, r.bold, r.link ? 'fill="#0000ff"' : "");
        if (r.link) out += `<line x1="${r.x.toFixed(2)}" x2="${(r.x + r.w).toFixed(2)}" y1="${(it.y + 1.27).toFixed(2)}" y2="${(it.y + 1.27).toFixed(2)}" stroke="#0000ff" stroke-width="0.37"/>`;
      }
      out += `<line x1="${G.LEFT_X}" x2="${G.RIGHT_X}" y1="${G.RULE_Y}" y2="${G.RULE_Y}" stroke="#000" stroke-width="1.02"/>`;
    } else if (it.align === "right") {
      out += textEl(it.x - textWidth(it.text, it.size, it.bold), it.y, it.text, it.size, it.bold);
    } else {
      out += textEl(it.x, it.y, it.text, it.size, it.bold);
    }
  }
  if (showGuide) {
    const gy = G.SAFE_LAST_BASELINE + 3;
    out += `<line x1="0" x2="${G.PAGE_W}" y1="${gy}" y2="${gy}" stroke="#c0392b" stroke-width="0.6" stroke-dasharray="4 3" opacity="0.55"/>`;
    out += `<text x="${G.PAGE_W - 6}" y="${gy + 9}" font-size="7" text-anchor="end" fill="#c0392b" opacity="0.8" style="font-family:system-ui,sans-serif">end of page one</text>`;
  }
  return out + "</svg>";
}
