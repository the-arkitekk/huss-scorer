# Example scans

`demo-scans.js` holds the ten scans of the author's trial 5 (from `samples/real`, 300 dpi, recompressed) and an example project with **three structures**: S1 (ceiling 3 m, opposite wall 6 m), S2 (4 m / 7 m) and S3 (5 m / 8 m). Each sheet has the structure boxes; the desk coordinator marked one, but two sheets were left unmarked and one was marked twice, and some drawings are wrong on purpose. Main menu → **Try with example scans** loads them and starts an Open mode session (rater code DEMO); nothing is uploaded.

**Different structures.** The structure of each sheet comes from its marked box. In Open mode it is shown under the sheet code; for an unmarked or doubly marked sheet choose it from the list there. In Blind mode (and afterwards) the **Tables** screen lists every scored sheet with the structure of its box; choose it there for the sheets without a clear box, or change it where a box was marked wrongly (your row is used instead of the box).

Made with `node tests/tools/make-demo.js`.

| File | From | Shows |
|---|---|---|
| example-01.jpeg | trial5_01_ZD897.jpeg | boxes S2 and S3 both marked: choose the structure (Open mode list, or the Tables screen) |
| example-02.jpeg | trial5_02_ZT8GX.jpeg | no structure box marked: choose the structure; the ceiling rises |
| example-03.jpeg | trial5_03_6NL8Y.jpeg | S1; thick hatched walls: the inner face (nearer the figure) is measured |
| example-04.jpeg | trial5_04_KYRZJ.jpeg | S3; a very small figure (flagged) and a curved wall: place the wall by hand |
| example-05.jpeg | trial5_05_YQEHG.jpeg | S1; a detailed figure, drawn as asked |
| example-06.jpeg | trial5_06_7P4HN.jpeg | S3 (box filled in); figure in pencil, not red: place head and foot by hand; double lines |
| example-07.jpeg | trial5_07_XLXPH.jpeg | S2; a small figure, sketchy lines |
| example-08.jpeg | trial5_08_E8LF8.jpeg | S1; section drawn in red pen: place ceiling and wall by hand and tick "colour not as instructed" |
| example-09.jpeg | trial5_09_6T3WA.jpeg | S2; drawn as asked |
| example-10.jpeg | trial5_10_MHZ62.jpeg | no structure box marked: choose the structure; ceiling drawn at the top edge (place it by hand), leaning wall |
