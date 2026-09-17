// Real Calibri, without hosting it. Calibri ships with Windows and Microsoft Office, but its license does not
// allow putting the font file on a website. So the app reads it from the visitor's own computer (with their
// permission) and embeds it in their own PDF, which the license does allow. Carlito stays as the fallback.
import { setCustomFonts } from "./pdf.js";

const WANT = ["Calibri", "Calibri-Bold"];       // PostScript names: regular, bold
const FACE = "ResumeCalibri";
let faces = [];
let pending = [null, null];   // lets a visitor pick the two files one at a time

const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer());
function psName(bytes) {
  try { return globalThis.fontkit.create(bytes).postscriptName || ""; } catch (e) { return ""; }
}

// ---------- tiny IndexedDB store so the choice survives a reload ----------
function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("rirm-fonts", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("f");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idb(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => { const tx = d.transaction("f", mode); const out = fn(tx.objectStore("f")); tx.oncomplete = () => res(out.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
}

async function apply(pair, persist) {
  const made = [new FontFace(FACE, pair[0].buffer.slice(0), { weight: "400" }), new FontFace(FACE, pair[1].buffer.slice(0), { weight: "700" })];
  await Promise.all(made.map((f) => f.load()));
  faces.forEach((f) => document.fonts.delete(f));
  faces = made; faces.forEach((f) => document.fonts.add(f));
  setCustomFonts(pair);
  if (persist) { try { await idb("readwrite", (s) => s.put(pair, "calibri")); } catch (e) { /* storage blocked: fine */ } }
}

export const canReadSystemFonts = () => typeof window.queryLocalFonts === "function";

// Chrome and Edge on a computer: asks the browser for the installed Calibri. Must run from a click.
export async function useSystemCalibri() {
  const found = await window.queryLocalFonts({ postscriptNames: WANT });
  const pick = (n) => found.find((f) => f.postscriptName === n);
  if (!pick(WANT[0]) || !pick(WANT[1])) throw new Error("Calibri is not installed on this computer (or the browser was not allowed to look).");
  await apply([await bytesOf(await pick(WANT[0]).blob()), await bytesOf(await pick(WANT[1]).blob())], true);
}

// Any browser: the visitor picks calibri.ttf and calibrib.ttf themselves.
export async function useCalibriFiles(fileList) {
  for (const file of fileList) { const b = await bytesOf(file); const i = WANT.indexOf(psName(b)); if (i >= 0) pending[i] = b; }
  if (!pending[0] && !pending[1]) throw new Error("Pick both files: Calibri Regular (calibri.ttf) and Calibri Bold (calibrib.ttf). Hold Ctrl or Cmd to select both at once.");
  if (!pending[1]) throw new Error("Got Calibri Regular. Now pick Calibri Bold (calibrib.ttf).");
  if (!pending[0]) throw new Error("Got Calibri Bold. Now pick Calibri Regular (calibri.ttf).");
  const pair = pending; pending = [null, null];
  await apply(pair, true);
}

export async function restoreCalibri() {
  try {
    const saved = await idb("readonly", (s) => s.get("calibri"));
    if (saved && saved[0] && saved[1] && psName(saved[0]) === WANT[0]) { await apply(saved, false); return true; }
  } catch (e) { /* nothing saved */ }
  return false;
}

export async function dropCalibri() {
  faces.forEach((f) => document.fonts.delete(f)); faces = [];
  pending = [null, null];
  setCustomFonts(null);
  try { await idb("readwrite", (s) => s.delete("calibri")); } catch (e) { /* ignore */ }
}
