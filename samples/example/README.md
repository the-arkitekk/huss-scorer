# Example data for the Results screen

Made with `node tests/tools/make-example.js` from the 19 trial scans in `samples/real/` (all drawn by the author, of one remembered room: ceiling 4 m, depth 7 m).

| File | What it is |
|---|---|
| `HUSS-TRIALS_DEMO_blind.csv` | A measurement CSV as the Score screen writes it. Rater `DEMO` accepted every suggestion unchanged (as if pressing K and Enter on each drawing); the two drawings without a red figure are excluded, an axis without a suggestion is marked not measurable. The values are the tool's own suggestions, not a human rater's scores. |
| `HUSS-TRIALS_key.csv`, `HUSS-TRIALS_structures.csv` | Key table (participant codes P01–P19 are placeholders) and structures table. |
| `HUSS-TRIALS_merged.csv` | The Merge output: the measurement CSV with participant, structure, true dimensions and E columns. |
| `HUSS-TRIALS_report.html` | The Report as a self-contained HTML file. Open it in any browser. |

To try the Results screen: Results → Add CSV files… → `HUSS-TRIALS_DEMO_blind.csv`, then Load key CSV… and Load structures CSV….
