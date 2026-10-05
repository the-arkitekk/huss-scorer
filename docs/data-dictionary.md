# Data dictionary

Every column HuSS Scorer writes. Rules version 1.3, tool version 0.2.0.

**Conventions**

- **Page mm:** millimetres on the printed sheet, origin at its top left corner, *x* to the right, *y* downwards (A4L: 297 × 210 mm). **px:** pixels of the original scan, so a value can be found again in the image file.
- **Decimals:** mm 2, m 3, E 4, px 2. Booleans are `1` / `0`. An empty cell means "no value": not placed, not measurable, or not applicable.
- **Measurement CSV:** UTF-8 without BOM, comma separator, dot decimal, CRLF line ends (RFC 4180). The **Excel view** (`…_excel-view.csv`: BOM, semicolon, decimal comma) is for reading only and cannot be loaded back.
- One row is one drawing scored by one rater. The key is `sheet_code` (+ `rater_code`).

## Measurement CSV (Score screen, spec 5.2)

### Identification

| Column | Type | Meaning |
|---|---|---|
| `project_code` | text | Project code from the project file. |
| `sheet_code` | text | Five-character sheet code (31-character alphabet without 0, 1, I, O, S; the last character is a check character). |
| `rater_code` | text | Who scored the drawing. |
| `mode` | text | `blind` or `open`. |
| `status` | text | `measured`, `excluded`, or `deferred` (review later; left out by Merge). |
| `measured_at` | text | Time of confirmation, ISO 8601 with offset. |
| `duration_s` | integer | Seconds spent on the drawing, summed over visits. |
| `tool_version` | text | HuSS Scorer version. |
| `rules_version` | text | Scoring rules version (1.3: line averages). |
| `template` | text | Sheet template, `A4L` or `A3L`. |
| `file_name` | text | Name of the scan file (for finding it; carries no meaning). |
| `image_width_px`, `image_height_px` | integer | Size of the scan. |
| `code_source` | text | Where the sheet code came from: `qr` (QR code), `ocr` (the printed characters, when the QR code could not be read) or `manual` (typed). |
| `structure_mark` | text | Structure code of the box the desk coordinator marked on the sheet (projects with two or more structures), or the structure the rater chose in Open mode. Empty when no box is clearly marked. |
| `structure_mark_source` | text | `mark` (read from the box) or `rater` (chosen in Open mode). |

### Alignment

| Column | Type | Meaning |
|---|---|---|
| `align_method` | text | `auto` (four corner marks), `auto_three_corners` (one mark missing, completed from the other three), `manual_corners` or `manual_floorline` (aligned by hand). |
| `px_per_mm_x`, `px_per_mm_y` | px/mm | Scale of the scan at the page centre. |
| `rotation_deg` | degrees | Rotation of the sheet in the scan. |
| `align_residual_mm` | mm | Largest corner deviation from a similarity fit; empty for `manual_floorline`. |
| `corner_tl_x_px` … `corner_br_y_px` | px | Centres of the four corner marks (top left, top right, bottom left, bottom right of the page) in the scan. |
| `floor_y_mm` | mm | Floor line centre at the figure axis, after the fine adjustment (spec 7.4). |
| `floor_slope` | ratio | Slope of the fitted floor line (dy/dx). |

### Handles (page mm)

| Column | Type | Meaning |
|---|---|---|
| `axis_x_mm` | mm | Figure axis: centre of the red figure, or the start mark. |
| `head_y_mm` | mm | Head top (rule 2). |
| `foot_y_mm` | mm | Foot: the floor line (rule 3, rules 1.2). |
| `ceiling_y_mm` | mm | Ceiling: the average of the ceiling line from the axis to 1 mm before the opposite wall (rule 4, rules 1.3). |
| `wall_x_mm` | mm | Opposite wall: the average of the wall line from 1 mm above the floor to 1 mm below the ceiling (rule 5, rules 1.3). |
| `head_x_px` … `wall_y_px` | px | The same points in the scan (head, foot, floor and ceiling on the axis; wall on the floor line). |
| `head_placement`, `foot_placement`, `ceiling_placement`, `wall_placement` | text | How the handle ended up: `suggested` (the tool's suggestion kept), `snapped` (moved and snapped to a line), `manual` (placed by hand, no snap). |
| `axis_placement` | text | `auto` or `manual` (moved by hand). |
| `head_suggested_y_mm`, `foot_suggested_y_mm`, `ceiling_suggested_y_mm`, `wall_suggested_x_mm` | mm | The tool's first suggestion, at handle precision; empty when nothing was suggested. |

### Lengths and estimates

| Column | Type | Meaning |
|---|---|---|
| `figure_mm` | mm | Figure height: foot − head (rule 2). |
| `figure_from_floor_mm` | mm | Floor line − head. Equal to `figure_mm` under rules 1.2. |
| `foot_floor_gap_mm` | mm | Floor line − foot handle (0 unless the foot was moved). |
| `ceiling_mm` | mm | Floor line − ceiling. |
| `distance_mm` | mm | Wall − axis. |
| `ref_height_m` | m | Reference figure height (project file, usually 1.70). |
| `scale_mm_per_m` | mm/m | `figure_mm` / `ref_height_m`. |
| `est_vertical_m` | m | Estimated ceiling height: `ceiling_mm` / `scale_mm_per_m`. |
| `est_horizontal_m` | m | Estimated distance to the opposite wall. |
| `est_vertical_alt_m`, `est_horizontal_alt_m` | m | The same with `figure_from_floor_mm`. |

### Backup values

Kept so that earlier rules can be compared with the current ones.

| Column | Type | Meaning |
|---|---|---|
| `red_bottom_y_mm` | mm | Lowest point of the red figure. |
| `figure_red_mm` | mm | Figure measured to the lowest red point (rules 1.0 for a floating figure). |
| `est_vertical_red_m`, `est_horizontal_red_m` | m | Estimates with `figure_red_mm`. |
| `ceiling_at_axis_y_mm` | mm | Where the ceiling line crosses the figure axis (rules 1.0–1.2). |
| `wall_at_floor_x_mm` | mm | Where the wall line stands, 1–6 mm above the floor line (rules 1.0–1.2). |
| `est_vertical_at_axis_m`, `est_horizontal_at_floor_m` | m | Estimates with those two points. |
| `ceiling_spread_mm`, `wall_spread_mm` | mm | Largest deviation of the followed line from its average. |

### Flags, decisions, note

| Column | Type | Meaning |
|---|---|---|
| `flag_red_not_found` | 0/1 | No red figure found; head and foot placed by the rater (rule 9). |
| `flag_figure_small` | 0/1 | `figure_mm` below the project's minimum (rule 10). |
| `flag_figure_off_mark` | 0/1 | Figure axis more than 5 mm from the start mark (rule 6). |
| `flag_foot_off_floor` | 0/1 | The red figure ends more than `foot_tolerance_mm` (project; default 4 mm) above or below the floor line, or the foot handle was moved off it (rule 3). |
| `flag_multiple_red` | 0/1 | More than one large red cluster. |
| `flag_axis_moved` | 0/1 | The axis was moved by hand. |
| `flag_manual_alignment` | 0/1 | Aligned by hand. |
| `flag_alignment_warning` | 0/1 | Large alignment residual or floor line not found. |
| `flag_ceiling_uneven`, `flag_wall_uneven` | 0/1 | The line deviates more than 5 mm from its average. |
| `flag_structure_mark` | 0/1 | The sheet has structure boxes, but not exactly one is clearly marked (none, or more than one). |
| `flag_color_noncompliant` | 0/1 | Set by the rater: figure colour does not follow the instructions. |
| `vertical_not_measurable`, `horizontal_not_measurable` | 0/1 | Set by the rater (rule 8); the axis then has no values. |
| `excl_<criterion>` | 0/1 | Exclusion criteria of the project (defaults `excl_no_figure`, `excl_not_standing_full`, `excl_not_along_axis`) and `excl_other`. |
| `excluded` | 0/1 | Any exclusion criterion set (then `status` is `excluded`). |
| `note` | text | The rater's note. |

## Merged CSV (Results screen, spec 8.6)

All measurement columns, then:

| Column | Type | Meaning |
|---|---|---|
| `participant_code` | text | From the key table (optional). |
| `structure_code` | text | From the key table, else from the marked structure box (`structure_mark`), else the project's one structure. |
| `structure_source` | text | Where `structure_code` came from: `key`, `mark`, `rater` (chosen in Open mode) or `project`. |
| `structure_name` | text | From the structures table. |
| `true_vertical_m`, `true_horizontal_m` | m | True ceiling height and distance of the structure. |
| `E_vertical`, `E_horizontal` | E | Error ratio: (estimate − true) / true; empty for excluded drawings and not measurable axes. |
| `E_vertical_at_axis`, `E_horizontal_at_floor` | E | E of the rules 1.2 backup estimates. |
| `E_vertical_red`, `E_horizontal_red` | E | E of the estimates with `figure_red_mm`. |
| `source_file` | text | The measurement CSV the record came from. |
| `key_<name>` | text | Any extra column of the key table. |

## Comparison CSV (Compare screen, spec 8.7)

One row per drawing scored by both raters.

| Column | Type | Meaning |
|---|---|---|
| `sheet_code`, `project_code`, `participant_code`, `structure_code` | text | Identification. |
| `rater_r1`, `rater_r2` | text | The two raters. |
| `<column>_r1`, `<column>_r2` | | `status`, `excluded`, `vertical_not_measurable`, `horizontal_not_measurable`, `figure_mm`, `ceiling_mm`, `distance_mm`, `est_vertical_m`, `est_horizontal_m`, `E_vertical`, `E_horizontal`, `ceiling_placement`, `wall_placement`, `duration_s`, `note` of each rater. |
| `reldiff_est_vertical`, `reldiff_est_horizontal` | E | (r2 − r1) / mean of the two estimates. |
| `diff_E_vertical`, `diff_E_horizontal` | E | E r2 − E r1. |

`r/icc_kappa.R` reads this file.

## Other tables (spec 5.4)

| File | Columns |
|---|---|
| Key table | `sheet_code`, `participant_code`, `structure_code` (a row needs at least one of the two; a structure here is used instead of the box on the sheet), optional extra columns |
| Structures table | `structure_code`, `structure_name`, `true_vertical_m`, `true_horizontal_m` |
| Code list (Sheets screen) | `sheet_code`, `template`, `generated_at` |
| Calibration key (Sheets screen) | `sheet_code`, `layout`, `figure_mm`, `ceiling_mm`, `distance_mm`, `template`, `generated_at` |
| Subsample list | one sheet code per line (or a CSV with a `sheet_code` column) |
| Project file `<project_code>.huss.json` | project settings (spec 5.1) and, from format version 2, `structures`: `code`, `name`, `true_vertical_m`, `true_horizontal_m`; no personal data |
