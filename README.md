# HuSS Scorer

Semi-automatic scorer for HuSS (Human-Scaled Section) drawings. The tool suggests, the rater confirms or corrects. Everything runs in the browser; images and data never leave the computer.

Status: **v0.1.0, rules 1.2** — Phase 1 (alignment, red-figure suggestion, handles with snap), Phase 2a (project file, sheet generator, QR code) and Phase 2b (folder sessions: queue, Blind/Open, exclusions, autosave, resume, Excel view). See `huss-scorer-sartname-v1.md` (technical specification, Turkish), section 13.

## Use

The top bar has three screens: **Score**, **Sheets** and **New project**.

**New project** (once, by the project owner): fill in the form and download `<project_code>.huss.json`; send it to the raters. It holds no personal data.

**Sheets**: choose the number of sheets (and optionally codes not to use, e.g. an earlier code list), then **Print…** or **Download PDF**, and keep the code list CSV. Print at 100 % (actual size); on a printed sheet the centres of the two top corner squares are 277 mm apart (A3L: 400 mm). Optionally a back side for the desk coordinator is printed (participant and structure codes, date; double-sided, flip on short edge). The back is never scanned, so raters stay blind.

**Score**:

1. Open `index.html` (double-click; no installation, no internet needed). Load the project file (**Load project file…**).
2. Enter your rater code and choose **Blind** or **Open** (fixed for the session). In Open mode the key table and structures table can be loaded to show structures and E.
3. Choose the folder of scans (or drop it on the page). The sheet codes are read from the QR codes and the drawings come in ascending sheet-code order. Repeated codes are resolved by choosing one scan; scans without a readable code come last and their code is typed.
4. Head and foot are suggested from the red figure. Place the ceiling (key `3`) and the opposite wall (key `4`) by clicking near the line; a handle released within 1.5 mm of a line jumps to its centre. Tick exclusion criteria or "not measurable" where needed, add a note.
5. **Confirm and next** (`Enter`), **Previous** (`Shift+Enter`), **Review later** (`D`). **Download CSV** saves the session; **Download for Excel** gives a semicolon / decimal-comma view that cannot be loaded back.
6. To continue later: the browser keeps an autosave (offered when the same project, rater and mode are chosen), and **Resume from CSV…** with the folder restores everything on any computer. The downloaded CSV is the real record.

| Key | Action |
|---|---|
| 1–4 | Select / place head, foot, ceiling, wall |
| Arrows | Nudge the selected handle 0.05 mm (Shift: 0.5 mm) |
| + / − / 0 | Zoom in, zoom out, fit |
| Wheel | Zoom at the pointer |
| Space + drag, or drag empty paper | Pan |
| C / R / H | Contrast boost, red mask, guide lines |
| Alt (held while releasing) | No snap |
| Enter / Shift+Enter | Confirm and next / previous |
| D | Review later |

The foot handle is locked by default (rule 3 decides it); unlock it in the panel to move it.

## Rule changes since the specification (rules 1.0)

- **1.1** Rule 3 (foot): red drawn more than 0.5 mm below the floor line counts as standing on the line (flagged).
- **1.2** Rule 3 (foot): the figure is always measured from the head top to the floor line, also when it floats above the line. A red trace ending more than 0.5 mm off the line (either side) sets `flag_foot_off_floor`. The lowest red point and the values measured to it are kept as backup columns: `red_bottom_y_mm`, `figure_red_mm`, `est_vertical_red_m`, `est_horizontal_red_m`.

## QR code

Sheets carry a standard QR code (version 1, error correction level Q, content `HUSS1/<TEMPLATE>/<SHEETCODE>`), readable by phones. Encoder and reader are part of the tool (`js/sheet/qr.js`, `js/detect/qr.js`); there are no third-party libraries. The reader knows where the code sits on the aligned page, corrects up to a quarter of damaged codewords and never returns a code whose check character fails. The encoder was checked against the published "HELLO WORLD" version 1-Q example and an independent reader (the browser's BarcodeDetector) for all eight mask patterns.

## Paper template

Below the floor line the sheet carries ground hatching: short "/" strokes with slightly irregular spacing, lean and depth (fixed seed, identical on every sheet), so they read as ground but cannot be counted like a ruler (rule 4.3). They start 0.7 mm below the line and stop around the start mark and its label.

## Developer notes

- Plain HTML/CSS/JavaScript, classic `<script>` files on one `HUSS` namespace (works from `file://`). No dependencies, no build step.
- `js/image`, `js/detect`, `js/measure`, `js/sheet` and `js/io/csv.js` are DOM-free and tested with Node's built-in runner:

```bash
npm test
```

- `node tests/synthetic/generate.js` writes the synthetic pages (S1–S8, S12 600 dpi, S13 small figure, S15 A3L, T1 orientation tie) to `samples/synthetic/` and `tests/synthetic/expected.json`.
- Sheet geometry lives in one place, `HUSS.sheet.template.items()`; the print view (`js/sheet/svg.js`), the PDF (`js/sheet/pdf.js`) and the synthetic pages all draw from it.
- `node tests/tools/inspect.js <scan>` runs the detection on a real scan and writes overlay images (macOS: uses `sips` to decode).
- All thresholds are named constants in `js/config.js`; all interface texts are in `js/strings.en.js`.

## Licence

Code: MIT (see `LICENSE`). Documents and the paper template: CC BY 4.0. Author: Erdem Yıldırım.
