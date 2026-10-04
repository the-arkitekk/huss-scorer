# Validation plan (outside the tool)

From the specification, section 11. The plan checks that HuSS Scorer measures the drawings as a careful person would with a general image tool.

## Sets

- **Tuning set:** about 20 drawings (team and volunteers). Thresholds (`js/config.js`) are tuned on this set, then frozen. The trial scans in `samples/real/` belong here.
- **Validation set:** about 30 pilot drawings, opened only after the thresholds are frozen.

## Procedure

- The same rater measures every drawing with HuSS Scorer and with ImageJ/Fiji, by the same written rules (`docs/scoring-rules.md`), at least one week apart and in a different order.
- Compared values: `est_vertical_m` and `est_horizontal_m`, as percent differences between the methods.
- In ImageJ/Fiji the rules 1.3 averages are measured by tracing each line with the segmented line tool and taking its mean position over the same stretch (axis to 1 mm before the wall; 1 mm above the floor to 1 mm below the ceiling). The rules 1.2 points (`*_at_axis`, `*_at_floor`) can be compared as well.

## Acceptance criteria

- Mean difference within ±1 %.
- Bland-Altman 95 % limits of agreement within ±5 %.
- ICC between the methods (absolute agreement) of .95 or more.

## Also reported

- Time per drawing (`duration_s`).
- Share of drawings aligned by hand (`flag_manual_alignment`) and of each flag.
- Share of suggestions accepted unchanged (`*_placement = suggested`), per handle.

The Report on the Results screen shows the last three; the agreement statistics come from `r/icc_kappa.R` (with the methods as "raters") or from any statistics package.

## If the criteria are not met

The cause is examined, corrected, and the validation repeated on a new set. If they are still not met, the main measurement is made with ImageJ/Fiji (plan B).

## Calibration (specification 10.3)

Ten calibration sheets (Sheets screen → Calibration sheets) are printed in colour at 100 %, scanned at 300 dpi colour JPEG and scored. Criterion: every length (figure, ceiling, distance) within 0.3 mm or 1 % of the printed value, whichever is larger. The Results screen's calibration check reports this from the calibration key.
