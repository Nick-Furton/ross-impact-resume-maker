# Ross Impact Resume Maker

Open-sourced by Nick Furton.

A free resume maker that reproduces the one-page Ross-style resume format: same margins, type sizes, line width, and spacing as the school's own builder. It runs entirely in your browser. Nothing you type is uploaded.

**Unofficial.** This project is not affiliated with or endorsed by the University of Michigan or the Ross School of Business. It is an independent implementation written from measurements of finished resumes. It contains no code or assets from the original tool.

## What it does

- Edit the header, Education, Experience, and Additional sections.
- Drag the grip to reorder bullets, schools, and experiences.
- Live preview that matches the PDF line for line.
- A fit meter: lines used, room left on the page, and for each bullet how many characters fit before a new line starts.
- Hide a bullet without deleting it, to tailor versions.
- Download a text-searchable PDF with a working LinkedIn link.
- Save and open resume files (JSON). Work is also kept in your browser between visits.

## How the layout was derived

The page geometry was measured from real output of the original builder: Letter page, 0.7 in side margins, Calibri 15/12/11 pt, a 423.36 pt bullet line, 11.33 pt line pitch, and fixed gaps between bullets, entries, and sections. The wrap is greedy and also breaks after hyphens. The model reproduced 13 real resumes line for line, with every baseline within 0.002 pt.

Calibri cannot be redistributed, so the app uses [Carlito](https://github.com/googlefonts/carlito) (SIL Open Font License), which has the same letter widths. Line breaks are therefore identical. Letter shapes differ very slightly.

## Run it locally

No build step. Serve the folder with any static server:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Tests

```bash
node test/run.mjs        # layout engine vs. ground truth (needs a private fixture, skips without it)
node test/make_pdf.mjs   # renders the sample resume to test/private/out.pdf
node test/drag_cdp.mjs   # real mouse-drag reorder test in headless Chrome (serve on port 8765 first)
python test/gen_metrics.py   # regenerates js/metrics.js from the fonts
```

## Credits

- [pdf-lib](https://github.com/Hopding/pdf-lib) and [@pdf-lib/fontkit](https://github.com/Hopding/fontkit), MIT.
- Carlito font, SIL OFL 1.1 (see `fonts/OFL.txt`).

MIT license.
