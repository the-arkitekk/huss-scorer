# HuSS scoring rules (rules version 1.5)

HuSS (Human-Scaled Section) measures how accurately the scale of a space is perceived. The participant draws a standing person, 170 cm tall, on the start mark of the printed floor line, then the section of the space along the viewing direction up to the opposite wall, from memory and without a ruler. The scale comes from the figure.

Two axes are measured: **vertical** (ceiling height, primary) and **horizontal** (distance from the figure to the opposite wall, secondary).

## Rules

1. **Lines.** The middle of a line is measured (floor, ceiling, opposite wall).
2. **Figure height.** From the foot to the head top. The head top is the highest point of the red trace.
3. **Foot.** The foot is always the floor line: the figure is measured from the head top to the floor line, also when it floats above the line or its feet are drawn through it. If the red trace ends more than `foot_tolerance_mm` (project setting; default 4 mm, specification 0.5 mm) above or below the line, `flag_foot_off_floor` is set. The lowest red point and the values measured to it are kept as backup columns.
4. **Ceiling height.** From the floor line to the ceiling. The ceiling is the **average** of its line from the figure axis to 1 mm before the opposite wall (without an opposite wall: as far as the line goes). A ceiling drawn only between the figure and the wall (not reaching over the figure) is averaged from where it starts. **A ceiling slanted more than 10°** (a straight line fitted through it, against the horizontal) is not averaged: it is measured right above the figure, vertically from the floor line on the figure axis (or at its end nearest to the figure). In each column the middle of the line is taken; the last 1 mm next to a corner is left out.
5. **Distance.** From the figure axis to the opposite wall, along the floor line. The wall is the **average** of its line from 1 mm above the floor to 1 mm below the ceiling. **A wall slanted more than 10°** (against the vertical) is not averaged: the horizontal distance is measured where it stands on the floor.
6. **Axis.** The vertical axis passes through the middle of the figure. If the figure is more than 5 mm from the start mark, `flag_figure_off_mark` is set; the axis still follows the figure.
7. **Double lines, corrections and thick elements.** With a double line or correction marks, the line nearer the figure (the inner face) is measured. A ceiling or wall drawn with its thickness (a band at least 2 mm deep, often hatched) is measured at its face towards the figure: the ceiling at the underside of the band, the wall at its inner face (rules 1.5). The rater decides in the end.
8. **Not measurable.** No ceiling line at all: the vertical axis is marked not measurable. No opposite wall, or a wall running off the page: the horizontal axis is marked not measurable.
9. **No red figure.** The rater places the head and the foot; the drawing is not excluded, it is flagged (`flag_red_not_found`).
10. **Small figure.** A figure smaller than `min_figure_mm` is not excluded, it is flagged (`flag_figure_small`).

## Estimates

- scale (mm per m) = figure height (mm) / reference height (m, usually 1.70)
- estimated ceiling height (m) = ceiling height (mm) / scale
- estimated distance (m) = distance (mm) / scale
- error E = (estimate − true) / true; above 0 overestimated, below 0 underestimated

## Why the averages (rules 1.3) and the points for slanted lines (rules 1.4)

The real ceilings are flat and the real walls upright, and the true dimension of a structure is one number. A freehand line slants and wobbles, so a single point of it (where it crosses the figure axis, or where the wall meets the floor) carries the error of the hand rather than the participant's idea of the height. The average of the line represents that idea better. A clearly slanted line (more than 5 mm off its average) is flagged, so that deliberately drawn roofs can be looked at; the single points are kept as backup columns.

A line slanted more than 10° is not a flat ceiling or an upright wall drawn by an unsteady hand but a deliberate shape (a pitched roof, a leaning wall). Its average depends on how far it was drawn; what the participant shows is the height right above the figure and the depth on the floor. Rules 1.4 therefore takes those points for such lines and keeps the averages as backup columns (`ceiling_avg_y_mm`, `wall_avg_x_mm`, `est_vertical_avg_m`, `est_horizontal_avg_m`); `ceiling_basis` / `wall_basis` say which was taken. The threshold is `LINE.SLANT_DEG` in `js/config.js`.

## Changes

| Version | Change |
|---|---|
| 1.0 | Specification v1. |
| 1.1 | Red drawn more than 0.5 mm below the floor line counts as standing on it (flagged). |
| 1.2 | The figure is always measured from the head top to the floor line; red-bottom values kept as backups. |
| 1.3 | Ceiling and wall are the averages of their lines; the rules 1.2 points kept as backups; flags for clearly slanted lines. Foot tolerance default 4 mm (a project setting). |
| 1.3 (addition) | A ceiling drawn only between the figure and the wall is measured (averaged from where it starts) instead of marking the height not measurable. Drawings measurable before give the same values. |
| 1.4 | A ceiling or wall slanted more than 10° is measured at one point: the ceiling right above the figure, the wall on the floor. The averages kept as backups; slant and basis written to the CSV. |
| 1.5 | A ceiling or wall drawn with its thickness (a band at least 2 mm deep, often hatched) is measured at its face towards the figure: the underside of the slab, the inner face of the wall. `ceiling_thick`, `wall_thick` and the thicknesses written to the CSV. |
