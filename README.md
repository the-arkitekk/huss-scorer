# HuSS Scorer

Semi-automatic scorer for HuSS (Human-Scaled Section) drawings. The tool suggests, the rater confirms or corrects. Everything runs in the browser; images and data never leave the computer.

Status: **v0.1.0, rules 1.3** — Phase 1 (alignment, red-figure suggestion, handles with snap), Phase 2a (project file, sheet generator, QR code), Phase 2b (folder sessions: queue, Blind/Open, exclusions, autosave, resume, Excel view) and Phase 2c (ceiling and wall suggestions, manual alignment). See `huss-scorer-sartname-v1.md` (technical specification, Turkish), section 13.

## Use

The top bar has five screens: **Score**, **Sheets**, **Tables**, **Results** and **New project**.

**New project** (once, by the project owner): fill in the form and download `<project_code>.huss.json`; send it to the raters. It holds no personal data.

**Sheets**: choose the number of sheets (and optionally codes not to use, e.g. an earlier code list), then **Print…** or **Download PDF**, and keep the code list CSV. Print at 100 % (actual size); on a printed sheet the centres of the two top corner squares are 277 mm apart (A3L: 400 mm). Optionally a back side for the desk coordinator is printed (participant and structure codes, date; double-sided, flip on short edge). The back is never scanned, so raters stay blind.

**Tables**: the structures (code, name, true ceiling height, true distance in metres) and the key table (sheet code → participant code, structure code), entered by hand or imported. Sheet codes are checked while typing; download both as CSV or load them straight into Open mode.

**Results** (after scoring): add one or more measurement CSVs (any raters) and the key and structures tables (from the Tables screen or files). The tool merges them by sheet code (spec 8.6), computes E = (estimate − true) / true for every drawing, lists data problems (sheets not in the key, missing structures, sheets scored twice, unfinished records, key sheets without a record) and downloads the merged CSV. Below it the **Report**:

- summary cards: drawings, measured / excluded, participants, structures, raters, median error and share overestimating for both axes;
- charts: error by structure (dots with box and median), estimated against true (with the identity line), error in height against error in distance (four quadrants), error distributions, and scoring quality (how the handles ended up, i.e. the share of suggestions kept unchanged; flags; where sheet codes came from; alignment; time per drawing);
- tables: by structure (n, true value, mean and median estimate, median E with the middle half, share over) and suggestions per handle;
- a rater selector and a **Values** selector: line averages (rules 1.3), the rules 1.2 points, or the figure to the lowest red point;
- exports: each chart as SVG or PNG, **Print / save as PDF**, and **Download report (HTML)**, one self-contained file that opens offline.

The charts are drawn by the tool itself (`js/report/charts.js`), no chart library. Only descriptive statistics are computed; ICC and kappa stay in R. Example data from the trial scans, with an example report: `samples/example/`.

**Score**:

1. Open `index.html` (double-click; no installation, no internet needed). Load the project file (**Load project file…**).
2. Enter your rater code and choose **Blind** or **Open** (fixed for the session). In Open mode the key table and structures table can be loaded to show structures and E.
3. Choose the folder of scans (or drop it on the page). The sheet codes are read from the QR codes (where a QR code cannot be read, from the five printed characters next to it) and the drawings come in ascending sheet-code order. Repeated codes are resolved by choosing one scan; only scans whose code cannot be read at all come last, and their code is typed.
4. Compare the sheet code (filled in by the tool) with the picture of the printed code and tick **Same as the code printed on the sheet** (`K`); confirming without the tick marks it in red. Head, foot, ceiling and opposite wall are suggested (dashed lines); the stretch of pencil line a ceiling or wall handle stands for is softly highlighted. If they sit on the right lines, nothing else is needed: `K`, then `Enter`. Otherwise drag a line, or use **Re-place** and click near the right line; a ceiling or wall handle released within 1.5 mm of a line's average jumps to that average (hold Alt to keep it exactly where it is released). Lines that could not be suggested are placed by clicking (the tool moves on to the next one by itself). Tick exclusion criteria or "not measurable" where needed, add a note.
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
| K | Tick "same as the printed code" |
| Backspace | Manual alignment: undo the last point |

The foot handle is locked by default (rule 3 decides it); unlock it in the panel to move it.

### Suggestions (spec 7.9)

- **Ceiling:** going up from 1 mm above the head, the first line that really runs horizontally: on its row, at least 60 % of the 10 mm right of the figure axis is dark (±0.5 mm, a slight slope allowed). A wavy freehand ceiling also counts when the line can be followed over at least 60 % of those 10 mm. None found: no suggestion. With a double ceiling line the inner face (nearer the figure) comes first. The handle is then put on the line's average (rules 1.3).
- **Opposite wall:** among the lines right of the figure, the rightmost one that rises from the floor for at least half the ceiling height (10 mm without a ceiling); it is followed upwards row by row, so slightly slanted lines and pencil breaks up to 1 mm still count. If another such line lies within 6 mm to its left, that one (the inner face of a double-line wall). The handle is then put on the line's average.
- **Following a line:** column by column (ceiling) or row by row (wall), bridging pencil breaks up to 1 mm and stopping where the line runs into another line or turns by more than 45° (a corner, also a rounded one). Broad, grainy strokes and strongly slanted lines are followed too (trial 3). Because the ceiling is averaged up to the wall and the wall up to the ceiling, moving one of them (or the axis) averages the other again if it came from a line (suggested or snapped); a handle placed by hand stays put.
- "Dark" means darker than halfway between the paper and the line itself, so faint pencil is treated like dark pencil. All values are in `js/config.js` (`SUGGEST`).
- The first position of every suggestion is written to the CSV (`*_suggested_*` columns, at handle precision), together with how each handle ended up (`suggested`, `snapped`, `manual`), so the share of suggestions accepted unchanged can be reported.

### Manual alignment (spec 7.5)

Alignment is automatic. When one corner mark is missing (a torn or blotted corner), its place is completed from the other three, which must make a right angle and the sheet's side ratio (`align_method = auto_three_corners`, no flag). Only when two or more marks cannot be found does the scan open as it is, for alignment by hand (wheel to zoom, drag to pan, a magnifier follows the pointer):

- **4 corner squares** (recommended): click the four black squares in any order. Each click is centred on its square and the page orientation is found as in automatic alignment, so the result is as accurate as automatic alignment.
- **2 floor line ends** (when a square is missing or damaged): click the two ends of the printed floor line, the end at the triangle first. If the QR code reads only the other way round, the tool turns the page itself. This is coarser (a similarity, about 0.5 mm), but estimates are ratios, so the effect stays small.

Afterwards everything runs as usual: QR code (the scan gets its code if it can be read now), suggestions, scoring. The CSV gets `align_method = manual_corners` or `manual_floorline` and `flag_manual_alignment`; reopening the scan later repeats the alignment from the corners kept in the record.

## Detection settings changed after the trials

- The red figure is looked for within 35 mm of the start mark (spec 7.7: 20 mm): figures drawn 2–3 cm beside the mark were missed in trial 3.
- One missing corner mark is completed from the other three (see Manual alignment).

## Rule changes since the specification (rules 1.0)

- **1.1** Rule 3 (foot): red drawn more than 0.5 mm below the floor line counts as standing on the line (flagged).
- **1.2** Rule 3 (foot): the figure is always measured from the head top to the floor line, also when it floats above the line. A red trace ending more than `foot_tolerance_mm` off the line (either side) sets `flag_foot_off_floor`; the default is 4 mm since trial 3 (spec: 0.5 mm), where freehand figures ended 0–3 mm above the line and the deliberately floating one 5.8 mm. It is a project setting. The lowest red point and the values measured to it are kept as backup columns: `red_bottom_y_mm`, `figure_red_mm`, `est_vertical_red_m`, `est_horizontal_red_m`.
- **1.3** Rules 4 and 5 (ceiling, wall): a freehand line is slanted and wobbly, while the real ceiling is flat and the real wall upright, so a single point of it carries the hand's error. The ceiling is now the **average** of its line from the figure axis to the opposite wall, the wall the average of its line from the floor to the ceiling; the last 1 mm next to a corner is left out (thicker ink where lines meet). In each column (ceiling) or row (wall) the middle of the line is measured (rule 1). The rules 1.2 points are kept as backup columns: `ceiling_at_axis_y_mm` (where the ceiling line crosses the axis), `wall_at_floor_x_mm` (where the wall stands on the floor), `est_vertical_at_axis_m`, `est_horizontal_at_floor_m`. `ceiling_spread_mm` and `wall_spread_mm` give the largest deviation of the line from its average; above 5 mm `flag_ceiling_uneven` / `flag_wall_uneven` is set (the freehand ceilings of the trial scans deviate 2–4 mm; `LINE.UNEVEN_MM` in `js/config.js`).

## QR code

Sheets carry a standard QR code (version 1, error correction level Q, content `HUSS1/<TEMPLATE>/<SHEETCODE>`), readable by phones. Encoder and reader are part of the tool (`js/sheet/qr.js`, `js/detect/qr.js`); there are no third-party libraries. The reader knows where the code sits on the aligned page, corrects up to a quarter of damaged codewords and never returns a code whose check character fails. The encoder was checked against the published "HELLO WORLD" version 1-Q example and an independent reader (the browser's BarcodeDetector) for all eight mask patterns.

### Printed code (when the QR code cannot be read)

Next to the QR code the sheet code is printed in Courier. When the QR code is blotted or torn, the tool reads these five characters instead (`js/detect/ocr.js`): it compares each with stored Courier and Courier New characters (`js/detect/glyphs.js`, made once in a browser with `tests/tools/glyphs.html`) and lets the check character choose among the likely readings. A reading is only given when it passes the check character and is clearly better than any other reading that passes it; one character lost under a blot is worked out from the check character when the other four are read beyond doubt. Otherwise no code is given and the rater types it. A code read this way stays editable, the panel says where it came from, and the CSV gets `code_source = ocr` (`qr`, `ocr` or `manual`). On the six trial scans (sheets printed before the QR code existed) all six codes are read; with an ink blot on one character, 56 of 90 test cases are still read correctly and the rest are refused, none is read wrong.

## Paper template

Below the floor line the sheet carries ground hatching: short "/" strokes with slightly irregular spacing, lean and depth (fixed seed, identical on every sheet), so they read as ground but cannot be counted like a ruler (rule 4.3). They start 0.7 mm below the line and stop around the start mark and its label.

## Developer notes

- Plain HTML/CSS/JavaScript, classic `<script>` files on one `HUSS` namespace (works from `file://`). No dependencies, no build step.
- `js/image`, `js/detect`, `js/measure`, `js/sheet` and `js/io/csv.js` are DOM-free and tested with Node's built-in runner:

```bash
npm test
```

- `node tests/synthetic/generate.js` writes the synthetic pages (S1–S8, S9 double wall, S10 no ceiling, S11 JPEG quality 60 with noise, S12 600 dpi, S13 small figure, S14 missing corner mark, S15 A3L, S16 freehand slanted and wobbly ceiling and wall, S17 clearly slanted ceiling, T1 orientation tie) to `samples/synthetic/` and `tests/synthetic/expected.json`.
- Sheet geometry lives in one place, `HUSS.sheet.template.items()`; the print view (`js/sheet/svg.js`), the PDF (`js/sheet/pdf.js`) and the synthetic pages all draw from it.
- `node tests/tools/make-example.js` rebuilds `samples/example/` from the scans in `samples/real/` (every suggestion accepted; the values are the tool's, not a rater's).
- `tests/fixtures/printed-codes/` holds the printed-code strips of the six trial scans (only the five characters, cut with `node tests/tools/code-crops.js`), the test material of the printed-code reader.
- `node tests/tools/inspect.js <scan>` runs the detection on a real scan and writes overlay images, including `<name>_lines.png` with the followed ceiling and wall lines and their averages (macOS: uses `sips` to decode).
- All thresholds are named constants in `js/config.js`; all interface texts are in `js/strings.en.js`.

## Licence

Code: MIT (see `LICENSE`). Documents and the paper template: CC BY 4.0. Author: Erdem Yıldırım.
