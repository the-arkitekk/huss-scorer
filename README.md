# HuSS Scorer

Semi-automatic scorer for HuSS (Human-Scaled Section) drawings. The tool suggests, the rater confirms or corrects. Everything runs in the browser; images and data never leave the computer.

Status: **Phase 1 prototype (v0.1.0, rules 1.2)** — single image, automatic alignment, red-figure suggestion, handles with snap, one-row CSV. See `huss-scorer-sartname-v1.md` (technical specification, Turkish), section 13.

## Use

1. Open `index.html` (double-click; no installation, no internet needed).
2. Drop a scanned drawing (JPEG or PNG, colour, 300 dpi) on the page, or click **Open image…**.
3. Head and foot are suggested from the red figure. Place the ceiling (key `3`) and the opposite wall (key `4`) by clicking near the line; a handle released within 1.5 mm of a line jumps to its centre.
4. Enter a rater code and press **Confirm and download CSV** (or `Enter`).

| Key | Action |
|---|---|
| 1–4 | Select / place head, foot, ceiling, wall |
| Arrows | Nudge the selected handle 0.05 mm (Shift: 0.5 mm) |
| + / − / 0 | Zoom in, zoom out, fit |
| Wheel | Zoom at the pointer |
| Space + drag, or drag empty paper | Pan |
| C / R / H | Contrast boost, red mask, guide lines |
| Alt (held while releasing) | No snap |
| Enter | Confirm |

The foot handle is locked by default (rule 3 decides it); unlock it in the panel to move it.

## Rule changes since the specification (rules 1.0)

- **1.1** Rule 3 (foot): red drawn more than 0.5 mm below the floor line counts as standing on the line (flagged).
- **1.2** Rule 3 (foot): the figure is always measured from the head top to the floor line, also when it floats above the line. A red trace ending more than 0.5 mm off the line (either side) sets `flag_foot_off_floor`. The lowest red point and the values measured to it are kept as backup columns: `red_bottom_y_mm`, `figure_red_mm`, `est_vertical_red_m`, `est_horizontal_red_m`.

## Paper template

Below the floor line the sheet carries ground hatching: short "/" strokes with slightly irregular spacing, lean and depth (fixed seed, identical on every sheet), so they read as ground but cannot be counted like a ruler (rule 4.3). They start 0.7 mm below the line and stop around the start mark and its label.

## Developer notes

- Plain HTML/CSS/JavaScript, classic `<script>` files on one `HUSS` namespace (works from `file://`). No dependencies, no build step.
- `js/image`, `js/detect`, `js/measure`, `js/sheet` and `js/io/csv.js` are DOM-free and tested with Node's built-in runner:

```bash
npm test
```

- `node tests/synthetic/generate.js` writes the synthetic pages S1–S8 to `samples/synthetic/` (300 dpi PNG) and `tests/synthetic/expected.json`.
- `node tests/synthetic/blank-sheet.js 3` writes printable blank A4L test sheets (true-size PDF) to `samples/template/` until the Phase 2 sheet generator exists. Print at 100 %.
- `node tests/tools/inspect.js <scan>` runs the detection on a real scan and writes overlay images (macOS: uses `sips` to decode).
- All thresholds are named constants in `js/config.js`; all interface texts are in `js/strings.en.js`.

## Licence

Code: MIT (see `LICENSE`). Documents and the paper template: CC BY 4.0. Author: Erdem Yıldırım.
