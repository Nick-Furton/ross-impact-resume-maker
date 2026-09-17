// Checks the JS layout engine against ground truth taken from real builder PDFs.
// The fixture holds a private resume, so it is not part of the repository.
import fs from "node:fs";
import { layoutResume } from "../js/layout.js";
const path = new URL("./private/portal_cases.json", import.meta.url);
if (!fs.existsSync(path)) { console.log("no private fixture, skipping"); process.exit(0); }
const cases = JSON.parse(fs.readFileSync(path, "utf8"));
let bad = 0;
for (const c of cases) {
  const { pages, fit } = layoutResume(c.data);
  const mine = pages[0].filter((it) => ["org", "sub", "body"].includes(it.kind)).sort((a, b) => a.y - b.y);
  let worst = 0, textOk = mine.length === c.truth.length;
  c.truth.forEach((t, i) => {
    const m = mine[i];
    if (!m || m.text !== t.text) textOk = false; else worst = Math.max(worst, Math.abs(m.y - t.y));
  });
  const pagesOk = (fit.pages > 1) === (c.pages > 1) || (c.pages === 1 && fit.lastBaseline <= 751.25);
  const ok = textOk && worst < 0.01 && pagesOk;
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.file.padEnd(40)} lines ${String(mine.length).padStart(2)}/${c.truth.length}  worst dy ${worst.toFixed(4)}  pages mine ${fit.pages} real ${c.pages}`);
  if (!textOk) { const i = c.truth.findIndex((t, k) => !mine[k] || mine[k].text !== t.text); console.log("   first diff:", JSON.stringify(c.truth[i]), "vs", JSON.stringify(mine[i] && { y: mine[i].y, text: mine[i].text })); }
}
process.exit(bad ? 1 : 0);
