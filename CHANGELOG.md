# Changelog

## Unreleased (0.1.0)

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
- Calibration test moved out of the Sheets and Results screens into its own screen.

### Rules
- 1.1: red drawn below the floor line counts as standing on it.
- 1.2: the figure is always measured from the head top to the floor line.
- 1.3: ceiling and wall are the averages of their lines; foot tolerance default 4 mm.
