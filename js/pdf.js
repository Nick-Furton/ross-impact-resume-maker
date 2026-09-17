// Builds the PDF in the browser with pdf-lib. Nothing is uploaded anywhere.
// Works in Node too (test/make_pdf.mjs) when given the libraries and font bytes.
import { G, contactRuns, textWidth } from "./layout.js";

let fontBytes = null;
async function loadFonts() {
  if (!fontBytes) {
    const get = async (u) => new Uint8Array(await (await fetch(u)).arrayBuffer());
    fontBytes = await Promise.all([get("fonts/Carlito-Regular.ttf"), get("fonts/Carlito-Bold.ttf")]);
  }
  return fontBytes;
}

export async function buildPdf(layout, title, deps = {}) {
  const PDFLib = deps.PDFLib || globalThis.PDFLib;
  const fontkit = deps.fontkit || globalThis.fontkit;
  const [regBytes, boldBytes] = deps.fonts || (await loadFonts());
  const { PDFDocument, PDFName, PDFString, rgb } = PDFLib;

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // Kerning and ligatures off: the original builder uses plain advance widths, and so does our wrap model.
  const opts = { subset: true, features: { kern: false, liga: false, clig: false } };
  const reg = await doc.embedFont(regBytes, opts);
  const bold = await doc.embedFont(boldBytes, opts);
  doc.setTitle(title);
  doc.setCreator("Ross Impact Resume Maker (open source)");
  doc.setProducer("pdf-lib");

  const black = rgb(0, 0, 0), blue = rgb(0, 0, 1);
  for (const items of layout.pages) {
    const page = doc.addPage([G.PAGE_W, G.PAGE_H]);
    const draw = (x, y, text, size, isBold, color = black) =>
      page.drawText(text, { x, y: G.PAGE_H - y, size, font: isBold ? bold : reg, color });
    const annots = [];
    for (const it of items) {
      if (it.kind === "name") {
        draw(306 - textWidth(it.text, 15, true) / 2, it.y, it.text, 15, true);
      } else if (it.kind === "contact") {
        for (const r of contactRuns(it.parts)) {
          draw(r.x, it.y, r.text, 11, r.bold, r.link ? blue : black);
          if (r.link) {
            const uy = G.PAGE_H - (it.y + 1.27);
            page.drawLine({ start: { x: r.x, y: uy }, end: { x: r.x + r.w, y: uy }, thickness: 0.37, color: blue });
            annots.push(doc.context.register(doc.context.obj({
              Type: "Annot", Subtype: "Link", Border: [0, 0, 0],
              Rect: [r.x, G.PAGE_H - it.y - 3, r.x + r.w, G.PAGE_H - it.y + 9],
              A: { Type: "Action", S: "URI", URI: PDFString.of(r.link) },
            })));
          }
        }
        page.drawLine({ start: { x: G.LEFT_X, y: G.PAGE_H - G.RULE_Y }, end: { x: G.RIGHT_X, y: G.PAGE_H - G.RULE_Y }, thickness: 1.02, color: black });
      } else if (it.align === "right") {
        draw(it.x - textWidth(it.text, it.size, it.bold), it.y, it.text, it.size, it.bold);
      } else if (it.text.trim()) {
        draw(it.x, it.y, it.text, it.size, it.bold);
      }
    }
    if (annots.length) page.node.set(PDFName.of("Annots"), doc.context.obj(annots));
  }
  return doc.save();
}
