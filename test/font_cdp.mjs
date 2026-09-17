// Tests the "use the Calibri on this computer" paths in headless Chrome (Windows with Calibri installed).
// Usage: serve the project on http://127.0.0.1:8765, then: node test/font_cdp.mjs
import { spawn } from "node:child_process";
import fs from "node:fs";

const CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL_ = process.env.APP_URL || "http://127.0.0.1:8765/";
const PORT = 9334;
const here = (p) => new URL(p, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1").replace(/%20/g, " ");
const profile = here("./private/chrome-profile-font");
fs.rmSync(profile, { recursive: true, force: true });
fs.mkdirSync(profile, { recursive: true });
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--window-size=1400,900", "--no-first-run", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception)); return r.result.value; };
const click = async (x, y) => { for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mousePressed" ? 1 : 0, clickCount: 1 }); };
const center = (sel, text) => evalJs(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.includes(${JSON.stringify(text)})); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
const pdfB64 = `(async () => { const { buildPdf } = await import('./js/pdf.js'); const { layoutResume } = await import('./js/layout.js'); const st = JSON.parse(localStorage.getItem('rirm:v1')); const bytes = await buildPdf(layoutResume({ ...st, contact: [st.email, st.phone, st.linkedin] }), 'x'); let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); })()`;

let failed = false;
try {
  let target;
  for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === "page"); } catch { /* wait */ } }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result || d); pending.delete(d.id); } };
  await send("Page.enable"); await send("DOM.enable");
  await send("Browser.grantPermissions", { permissions: ["localFonts"], origin: new URL(URL_).origin });
  await send("Page.navigate", { url: URL_ }); await sleep(2000);

  console.log("bar at start:", await evalJs("document.querySelector('#fontbar').textContent"));
  fs.writeFileSync(here("./private/font_carlito.pdf"), Buffer.from(await evalJs(pdfB64), "base64"));

  // Path 1: system fonts through the Local Font Access API (trusted click)
  const p = await center("#fontbar button", "Use my Calibri");
  if (p) { await click(p.x, p.y); await sleep(500); console.log("while waiting:", await evalJs("document.querySelector('#fontbar').textContent")); }
  for (let i = 0; i < 90; i++) { await sleep(1000); if (!(await evalJs("document.querySelector('#fontbar').textContent")).includes("Looking")) break; }
  const bar1 = await evalJs("document.querySelector('#fontbar').textContent");
  console.log("after Use my Calibri:", bar1);
  fs.writeFileSync(here("./private/font_system.pdf"), Buffer.from(await evalJs(pdfB64), "base64"));

  // survives a reload?
  await send("Page.reload"); await sleep(2500);
  const bar2 = await evalJs("document.querySelector('#fontbar').textContent");
  console.log("after reload:", bar2);

  // switch back, then Path 2: file picker
  const back = await center("#fontbar button", "Switch back");
  if (back) { await click(back.x, back.y); await sleep(600); }
  console.log("after switch back:", await evalJs("document.querySelector('#fontbar').textContent"));
  const doc = await send("DOM.getDocument");
  const node = await send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#fontfiles" });
  await send("DOM.setFileInputFiles", { nodeId: node.nodeId, files: ["C:\\Windows\\Fonts\\calibri.ttf", "C:\\Windows\\Fonts\\calibrib.ttf"] });
  await sleep(2500);
  const bar3 = await evalJs("document.querySelector('#fontbar').textContent");
  console.log("after choosing files:", bar3);
  fs.writeFileSync(here("./private/font_files.pdf"), Buffer.from(await evalJs(pdfB64), "base64"));
  // wrong files are rejected
  await evalJs("(async () => { const m = await import('./js/fonts.js'); await m.dropCalibri(); })()");
  await send("Page.reload"); await sleep(1500);
  const doc2 = await send("DOM.getDocument");
  const node2 = await send("DOM.querySelector", { nodeId: doc2.root.nodeId, selector: "#fontfiles" });
  await send("DOM.setFileInputFiles", { nodeId: node2.nodeId, files: ["C:\\Windows\\Fonts\\arial.ttf"] });
  await sleep(1500);
  const bar4 = await evalJs("document.querySelector('#fontbar').textContent");
  console.log("after a wrong file:", bar4);

  failed = !(bar1.includes("Calibri, from this computer") && bar2.includes("Calibri, from this computer") && bar3.includes("Calibri, from this computer") && bar4.includes("Pick both files"));
  console.log(failed ? "FAIL" : "PASS");
} catch (err) { console.error(err); failed = true; }
finally { try { ws && ws.close(); } catch {} chrome.kill(); }
process.exit(failed ? 1 : 0);
