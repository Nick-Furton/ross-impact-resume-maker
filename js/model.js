// Editor data model. No DOM here, so it also runs in Node.
import { LABELS } from "./layout.js";

export const uid = () => Math.random().toString(36).slice(2, 10);
const str = (v, max = 2000) => (typeof v === "string" || typeof v === "number" ? String(v).slice(0, max) : "");

function bullets(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 60).map((b) =>
    typeof b === "string" ? { id: uid(), text: str(b), hidden: false } : { id: uid(), text: str(b && b.text), hidden: !!(b && b.hidden) });
}

// Accepts anything (a saved file, the sample, garbage) and returns a well-formed state.
export function normalize(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const arr = (v) => (Array.isArray(v) ? v.slice(0, 40) : []);
  return {
    name: str(r.name, 120), email: str(r.email, 120), phone: str(r.phone, 60), linkedin: str(r.linkedin, 200),
    education: arr(r.education).map((e) => ({
      id: uid(), org: str(e && e.org, 200), loc: str(e && e.loc, 120), sub: str(e && e.sub, 300), deg: str(e && e.deg, 300), bullets: bullets(e && e.bullets),
    })),
    experience: arr(r.experience).map((e) => ({
      id: uid(), org: str(e && e.org, 200), loc: str(e && e.loc, 120), title: str(e && e.title, 300),
      startYear: str(e && e.startYear, 4), endYear: str(e && e.endYear, 4), present: !!(e && e.present),
      label: LABELS.includes(e && e.label) ? e.label : "", bullets: bullets(e && e.bullets),
    })),
    additional: bullets(r.additional),
  };
}

export const blankState = () => normalize({
  education: [{ org: "University of Michigan", loc: "Ann Arbor, MI", sub: "Stephen M. Ross School of Business", deg: "Bachelor of Business Administration, May 20XX", bullets: [""] }],
  experience: [{ bullets: [""] }],
  additional: [""],
});

// Strips editor-only ids for saving to a file.
export function toFile(state) {
  const b = (list) => list.map(({ text, hidden }) => (hidden ? { text, hidden: true } : text));
  return {
    app: "ross-impact-resume-maker", version: 1,
    name: state.name, email: state.email, phone: state.phone, linkedin: state.linkedin,
    education: state.education.map(({ id, bullets, ...e }) => ({ ...e, bullets: b(bullets) })),
    experience: state.experience.map(({ id, bullets, ...e }) => ({ ...e, bullets: b(bullets) })),
    additional: b(state.additional),
  };
}

export function toLayoutData(state) {
  return { ...state, contact: [state.email, state.phone, state.linkedin] };
}
