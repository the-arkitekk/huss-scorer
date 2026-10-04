// Developer tool: example data for the Results screen, made from the scans in samples/real.
//
//   node tests/tools/make-example.js
//
// Writes samples/example/: key and structures tables, DEMO_blind.csv (every suggestion accepted
// unchanged, as if a rater had pressed K and Enter on each drawing; drawings without a red figure
// are excluded, axes without a suggestion marked not measurable), the merged CSV and the HTML
// report. The values are the tool's own suggestions, not a human rater's scores.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const HUSS = require('../unit/_load.js');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'samples', 'real'), OUT = path.join(ROOT, 'samples', 'example');
const STRUCTURE = { code: 'ROOM-EY', name: 'Remembered room (author)', v: 4, h: 7 };

function decode(file) {
  const src = fs.readFileSync(path.join(__dirname, 'inspect.js'), 'utf8');
  const readBmp = new Function('fs', src.match(/function readBmp[\s\S]*?\n}\n/)[0] + 'return readBmp;')(fs);
  const tmp = path.join(os.tmpdir(), `huss-example-${process.pid}.bmp`);
  execFileSync('sips', ['-s', 'format', 'bmp', file, '--out', tmp], { stdio: 'ignore' });
  try { return readBmp(tmp); } finally { fs.rmSync(tmp, { force: true }); }
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const P = HUSS.detect.pipeline, prm = HUSS.config.DEFAULTS, records = [], key = [];
  const scans = fs.readdirSync(SRC).filter((f) => /\.jpe?g$/i.test(f)).sort();
  scans.forEach((f, i) => {
    const img = decode(path.join(SRC, f));
    const rc = P.readCode(img, { template: 'A4L', params: prm });
    const a = P.analyze(img, { template: 'A4L', params: prm });
    if (!rc.ok || !a.ok) { console.log(f, 'skipped:', rc.reason || a.error); return; }
    const sug = a.suggestions, noFigure = !a.red.found;
    const s = {
      analysis: a, params: prm, status: noFigure ? 'excluded' : 'measured', confirmedAt: Date.UTC(2026, 9, 5, 6, i, 0), duration_s: null,
      meta: {
        project_code: 'HUSS-TRIALS', rater_code: 'DEMO', mode: 'blind', file_name: f, sheet_code: rc.sheet_code, code_source: rc.source,
        exclusions: noFigure ? { excl_no_figure: true } : {}, note: noFigure ? 'example: no red figure, excluded' : '',
        vertical_not_measurable: !noFigure && sug.ceiling_y == null, horizontal_not_measurable: !noFigure && sug.wall_x == null
      },
      handles: {
        axis: { x: sug.axis_x, placement: 'auto' },
        head: { y: sug.head_y, placement: sug.head_y == null ? null : 'suggested' },
        foot: { y: sug.foot_y, placement: sug.foot_y == null ? null : 'suggested' },
        ceiling: { y: sug.ceiling_y, placement: sug.ceiling_y == null ? null : 'suggested' },
        wall: { x: sug.wall_x, placement: sug.wall_x == null ? null : 'suggested' }
      },
      suggested: { head_y: sug.head_y, foot_y: sug.foot_y, ceiling_y: sug.ceiling_y, wall_x: sug.wall_x }
    };
    records.push(HUSS.measure.record.buildRecord(s));
    key.push({ sheet_code: rc.sheet_code, participant_code: 'P' + String(i + 1).padStart(2, '0'), structure_code: STRUCTURE.code });
    console.log(f, rc.sheet_code, rc.source, s.status);
  });
  const T = HUSS.io.tables;
  const keyText = T.keyToCSV(key);
  const stText = T.structuresToCSV([{ structure_code: STRUCTURE.code, structure_name: STRUCTURE.name, true_vertical_m: STRUCTURE.v, true_horizontal_m: STRUCTURE.h }]);
  const csvText = HUSS.io.csv.toCSV(records);
  fs.writeFileSync(path.join(OUT, 'HUSS-TRIALS_key.csv'), keyText);
  fs.writeFileSync(path.join(OUT, 'HUSS-TRIALS_structures.csv'), stText);
  fs.writeFileSync(path.join(OUT, 'HUSS-TRIALS_DEMO_blind.csv'), csvText);
  const read = HUSS.io.csv.readMeasurements(csvText);
  const merged = HUSS.io.merge.merge([{ name: 'HUSS-TRIALS_DEMO_blind.csv', records: read.records, exclusionIds: read.exclusionIds }], T.parseKey(keyText), T.parseStructures(stText));
  fs.writeFileSync(path.join(OUT, 'HUSS-TRIALS_merged.csv'), HUSS.io.csv.toCSV(merged.rows, merged.columns));
  const model = HUSS.report.build.model(merged, { rater: 'DEMO', method: 'main', generatedAt: new Date(2026, 9, 5, 9, 0, 0) });
  fs.writeFileSync(path.join(OUT, 'HUSS-TRIALS_report.html'), HUSS.report.build.documentHtml(model));
  console.log('wrote', OUT);
}

main();
