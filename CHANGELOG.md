# Changelog

## 0.2.0 (unreleased)

- Main menu: **Try with example scans**: ten trial 3 scans (150 dpi, `demo/demo-scans.js`, loaded only when chosen, also from disk) and an example project with one structure; an Open mode session starts at once (rater code DEMO). Made with `tests/tools/make-demo.js`; published with the Pages site.
- Ceiling drawn only right of the figure: a speck near the axis or a faint line start no longer hides the line (it was missed at 200 dpi).

Report (display only; measurement, rules and CSV columns unchanged):
- Error-by-structure charts: the mean (diamond) and its 95 % confidence interval (bar; t distribution, from 3 drawings on) right of each box; the mean and interval under each group and as two new columns of the By structure table; captions explain the sideways spread of the dots and the whiskers (lowest to highest value).
- "Show as": Error (%) or Ratio (estimate / true = 1 + E), for the summary cards, the error charts, the histograms, the height-against-distance chart and the By structure table, and for the PNG, SVG, print and HTML exports; the merged CSV files are unchanged.
- Small negative percentages (between -1 % and 0) kept their minus sign in the charts.
- Guide: "Reading the report".

## 0.1.0 (pilot, unreleased)

Rules version 1.3.

### Phase 1: core
- Automatic alignment from the four corner marks (homography), rectified page, floor line fine adjustment.
- Red figure detection (CIELAB), head and foot suggestions, axis.
- Axis-locked handles with snap, zoom, pan, magnifier, keyboard.
- Scoring arithmetic, flags, one-line CSV. Synthetic test pages S1–S8.

### Phase 2: workflow
- Project file, sheet generator (print view and PDF, optional back side for the desk coordinator), the tool's own QR code (version 1-Q) encoder and reader.
- Folder sessions: sheet codes read first, queue in code order, duplicates resolved, Blind and Open modes, exclusions, "not measurable", notes, autosave, resume from CSV, Excel view, Tables screen.
- Ceiling and wall suggestions (spec 7.9); manual alignment fallback (four corner squares or two floor line ends).
- Printed sheet code read from its characters when the QR code cannot be read (Courier glyphs, check character).
- One missing corner mark completed from the other three.
- Synthetic pages S9–S17, T1; real trial scans in samples/real.

### Phase 3: completion
- Results screen: Merge (spec 8.6) and a Report with summary cards, charts (own SVG), tables, rater and values selectors, SVG/PNG/PDF/HTML exports.
- Compare screen (spec 8.7) with agreement charts and the wide CSV; subsample lists; r/icc_kappa.R.
- Calibration sheets and calibration check (spec 10.3).
- Guide and About screen; documents in docs/; citation and archive metadata.

### After the pilot feedback
- Main menu at start (new project, open project file, continue the last project; try without a project, calibration test, guide); no New project tab inside a project; "HuSS Scorer" opens the menu.
- Structures with their true dimensions in the project file (format 2); one-structure projects need no key table; the Tables screen holds the key table only.
- Results and Compare use the drawings scored in this session without a CSV.
- Structure boxes on the sheet (projects with 2-16 structures): the desk coordinator marks one; the tool reads it, covers it in Blind mode, shows and lets the rater correct it in Open mode; Merge takes the structure from the key table, else the box. New columns `structure_mark`, `structure_mark_source`, `flag_structure_mark`, merged `structure_source`. The back side for the desk coordinator was removed (it shows through in scans). The participant code in the key table is optional.
- Ceiling drawn only between the figure and the wall (not over the figure): suggested and snapped to, averaged from where it starts (rule 4 addition; S10 changed; trial scan XA569). "Not measurable" now means no ceiling line at all.
- Structure boxes made visible: Blind mode says that the box was read (not which), or that none / several are marked; a marked box beyond the project's structures is flagged; the report lists where the structures came from (boxes, key table, Open mode, the project's one structure, not known).
- Score panel: the sheet card (title, code) sits right above Confirm and next; Previous and Review later below it.
- Orientation: the floor line may lie up to 0.6 mm off its expected place (a sheet printed or scanned slightly askew); such a scan needed manual alignment before (trial scan FRQ9Y). Synthetic page S18.
- Queue: a scan whose code cannot be read keeps its place in the folder instead of going last; going back to drawings set aside with Review later after the end of the queue is announced.
- Score: the "Same as the code printed on the sheet" tick is needed only for codes read from the printed characters or typed in; it sits with the picture of the printed code right above Confirm and next.
- QR reader: when the first threshold fails it tries two higher ones (pale prints with toner spread); three trial scans that fell back to the printed characters are now read from the QR code. Trial 4 scans (structure boxes) in samples/real.
- Score: the buttons that open scans stay locked until the rater code, the mode (and, without a project, the project code) are set; pointing at them lists what is missing. Previous goes back through the drawings seen in this session (it did nothing on the first queue position, e.g. after Review later wrapped around).
- Results with several structures and no key table: a clear notice with a link to the Tables screen; the report shows the estimates in metres instead of empty error charts.
- Calibration test moved out of the Sheets and Results screens into its own screen.

### Rules
- 1.1: red drawn below the floor line counts as standing on it.
- 1.2: the figure is always measured from the head top to the floor line.
- 1.3: ceiling and wall are the averages of their lines; foot tolerance default 4 mm.
