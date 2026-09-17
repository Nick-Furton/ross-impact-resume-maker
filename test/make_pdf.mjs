// Renders a PDF in Node with the same code the browser uses. Usage: node test/make_pdf.mjs [data.json] [out.pdf]
import fs from "node:fs";
import { createRequire } from "node:module";
import { layoutResume } from "../js/layout.js";
import { buildPdf } from "../js/pdf.js";
const require = createRequire(import.meta.url);
const PDFLib = require("../vendor/pdf-lib.min.js");
const fontkit = require("../vendor/fontkit.umd.min.js");
const root = new URL("..", import.meta.url);
const fonts = ["fonts/Carlito-Regular.ttf", "fonts/Carlito-Bold.ttf"].map((f) => new Uint8Array(fs.readFileSync(new URL(f, root))));
let data;
const arg = process.argv[2];
if (arg) { const j = JSON.parse(fs.readFileSync(arg, "utf8")); data = Array.isArray(j) ? j[j.length - 1].data : j; }
else { const { normalize, toLayoutData } = await import("../js/model.js"); data = toLayoutData(normalize((await import("../js/sample.js")).SAMPLE_STATE)); }
const bytes = await buildPdf(layoutResume(data), "Test Resume", { PDFLib, fontkit, fonts });
const out = process.argv[3] || "test/private/out.pdf";
fs.writeFileSync(out, bytes);
console.log("wrote", out, bytes.length, "bytes");
