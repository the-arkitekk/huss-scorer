# HuSS Scorer user guide

HuSS Scorer runs in the browser: open `index.html` (double-click, no installation, no internet). Images and data never leave the computer; nothing is uploaded.

## 1. Before the study (project owner)

1. **Main menu → New project:** fill in the form (project code, template A4L or A3L, reference height, minimum figure size, foot tolerance, snap radius, which suggestions are on, the **structures** with their true ceiling height and distance, exclusion criteria) and **Create project**. The file `<project_code>.huss.json` is downloaded; send it to the raters. Clicking **HuSS Scorer** at the top left always opens the main menu (Back to it, Edit project, Continue).
2. **Sheets:** choose the number of sheets and **Download PDF** (or **Print…**). Print at 100 % ("actual size"), one-sided; the centres of the two top corner squares must be 277 mm apart on A4L (400 mm on A3L). Keep the code list CSV. A project with two or more structures (at most 16) gets a row of **structure boxes** below the floor line, one per structure with its code.
3. **Calibration (once per printer and scanner):** main menu → **Calibration test**: Download PDF and the calibration key, print in colour at 100 %, scan, score, and read the check on the same screen.

## 2. During the study (desk coordinator)

- Each participant draws on one sheet with a red pen (figure) and a pencil (section).
- **Mark the box of the structure** the participant drew (a cross, a tick or filled in; one box only). The tool reads it from the scan. A wrong or missing mark is corrected in the **Tables** screen (key table), whose structure is used instead of the box.
- Participant codes, if needed, go into the key table. The true dimensions of the structures are in the project. A one-structure project has no boxes and needs no key table.

## 3. Scanning

- Colour, 300 dpi, JPEG or PNG, the whole sheet. Any orientation (the tool turns the page).
- Put all scans of a session in one folder. File names do not matter.

## 4. Scoring (raters)

1. Open the project (main menu: **Open project file…** or **Continue**). **Score** screen: enter your **rater code**, choose **Blind** (no file names, structures or numbers on screen) or **Open**. Until these are set (and the project code, without a project) the buttons that open scans are locked; pointing at one says what is still needed.
2. **Choose folder…** In Blind mode the structure boxes are covered on screen. The sheet codes are read from the QR codes (or from the printed characters when a QR code is damaged) and the drawings come in sheet-code order.
3. For each drawing: head, foot, ceiling and opposite wall are suggested; if they are right, press **Enter**. A code read from the QR code needs no check. When it was read from the printed characters (damaged QR code) or typed in, a picture of the printed code appears right above **Confirm and next**: compare and tick **Same as the code printed on the sheet** (`K`). Otherwise drag a handle near the right line (it snaps to the line's average), or press its number (1–4) and click. Tick exclusion criteria or "not measurable" where needed.
4. **Review later** (`D`) puts a drawing at the end. **Previous** (`Shift+Enter`) goes back to the drawing you saw just before, step by step.
5. **Download CSV** saves the session (the tool also reminds you every 20 drawings). The browser keeps an autosave; **Resume from CSV…** with the same folder restores a session on any computer.
6. A second rater who scores only part of the drawings loads the **Subsample list…** before choosing the folder.

If the corner marks of a scan cannot be found (two or more torn or blotted), the scan opens for **manual alignment**: click the four corner squares, or the two ends of the floor line (the end at the triangle first).

### Keys

| Key | Action |
|---|---|
| Enter / Shift+Enter | Confirm and next / previous |
| D | Review later |
| K | Tick "same as the printed code" (codes not read from the QR code) |
| 1–4 | Select or place head, foot, ceiling, wall |
| Arrows (Shift) | Nudge the selected handle 0.05 mm (0.5 mm) |
| Wheel, + / − / 0 | Zoom, fit |
| Space + drag | Pan |
| C / R / H | Contrast, red mask, guide lines |
| Alt while releasing | No snap |
| Backspace | Manual alignment: undo the last point |

## 5. After scoring

- **Results:** the drawings of this session appear by themselves (other raters' CSVs can be added). With the project's structures and the key table the tool computes the errors, lists data problems, and shows the **Report** (summary cards, charts, tables). With more than one structure, the structure of each sheet comes from its marked box (or the key table). Sheets without a clear mark are listed with **Add them to the Tables screen**: their codes are added to the key table and only the structure is left to choose. Until then the report shows those drawings without errors. Download the merged CSV, each chart as SVG or PNG, the report as PDF (print) or as one HTML file.
- **Compare:** add the CSVs of two raters; read-only comparison, agreement charts, comparison CSV for `r/icc_kappa.R` (ICC and kappa in R). The subsample list maker is on the same screen.

The scoring rules are in `docs/scoring-rules.md`, every CSV column in `docs/data-dictionary.md`.
