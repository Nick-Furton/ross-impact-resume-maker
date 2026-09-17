// Real (trusted) mouse-drag test through the Chrome DevTools Protocol.
// Usage: serve the project on http://127.0.0.1:8765, then: node test/drag_cdp.mjs
import { spawn } from "node:child_process";
import fs from "node:fs";

const CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL_ = process.env.APP_URL || "http://127.0.0.1:8765/";
const PORT = 9333;
const profile = new URL("./private/chrome-profile", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1").replace(/%20/g, " ");
fs.mkdirSync(profile, { recursive: true });
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--window-size=1400,900", "--no-first-run", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result.value;
const mouse = (type, x, y, buttons) => send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons, clickCount: 1 });

async function drag(x, y0, y1, holdMs = 0) {
  await mouse("mouseMoved", x, y0, 0);
  await mouse("mousePressed", x, y0, 1);
  const step = y1 > y0 ? 4 : -4;
  for (let y = y0; step > 0 ? y <= y1 : y >= y1; y += step) { await mouse("mouseMoved", x, y, 1); }
  if (holdMs) await sleep(holdMs);
  await mouse("mouseReleased", x, y1, 0);
  await sleep(150);
}

let failed = false;
try {
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === "page"); } catch { /* not up yet */ }
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id).res(d.result); pending.delete(d.id); } };
  await send("Page.enable");
  await send("Page.navigate", { url: URL_ });
  await sleep(1500);
  await evalJs("localStorage.removeItem('rirm:v1'); location.reload()");
  await sleep(1500);

  const bulletsOf = "[...document.querySelectorAll('.entries')[1].children[0].querySelectorAll('.bullets textarea')].map(t => t.value.slice(0, 8))";
  const geom = async (sel) => JSON.parse(await evalJs(`(() => { const ed = document.querySelector('#editor'); const els = [...document.querySelectorAll("${sel}")]; els[0].scrollIntoView({block: 'start'}); ed.scrollTop -= 40; return JSON.stringify(els.map(c => { const h = c.querySelector('.handle').getBoundingClientRect(), b = c.getBoundingClientRect(); return { x: h.x + h.width / 2, y: h.y + h.height / 2, bottom: b.bottom }; })); })()`));

  // 1) first bullet of the first experience -> dragged below the third
  const before = await evalJs(bulletsOf);
  const g = await geom(".block:nth-child(3) .card:first-child .bullet");
  await drag(g[0].x, g[0].y, g[2].bottom - 6);
  const after = await evalJs(bulletsOf);
  const saved = await evalJs("JSON.parse(localStorage.getItem('rirm:v1')).experience[0].bullets.map(b => (b.text || b).slice(0, 8))");
  const stuck = await evalJs("document.querySelectorAll('.dragging').length");
  const ok1 = JSON.stringify(after) === JSON.stringify([before[1], before[2], before[0]]) && JSON.stringify(saved) === JSON.stringify(after) && stuck === 0;
  console.log(ok1 ? "PASS" : "FAIL", "bullet drag", { before, after, saved, stuck });

  // 2) third experience card -> dragged above the first
  const orgs = "JSON.parse(localStorage.getItem('rirm:v1')).experience.map(e => e.org.slice(0, 8))";
  const oBefore = await evalJs(orgs);
  const c = JSON.parse(await evalJs(`(() => { const ed = document.querySelector('#editor'); const cards = [...document.querySelectorAll('.block:nth-child(3) .entries > .card')]; cards[2].querySelector('.card-head .handle').scrollIntoView({block: 'center'}); return JSON.stringify(cards.map(k => { const h = k.querySelector('.card-head .handle').getBoundingClientRect(), b = k.getBoundingClientRect(); return { x: h.x + h.width / 2, y: h.y + h.height / 2, top: b.top }; })); })()`));
  await drag(c[2].x, c[2].y, Math.max(140, c[0].top + 4), 2500);
  const oAfter = await evalJs(orgs);
  const stuck2 = await evalJs("document.querySelectorAll('.dragging').length");
  const ok2 = oAfter[0] === oBefore[2] && stuck2 === 0;
  console.log(ok2 ? "PASS" : "FAIL", "entry drag", { oBefore, oAfter, stuck2 });
  failed = !(ok1 && ok2);
} catch (err) { console.error(err); failed = true; }
finally { try { ws && ws.close(); } catch {} chrome.kill(); }
process.exit(failed ? 1 : 0);
