// Loads the DOM-free tool files into globalThis.HUSS, in dependency order.
'use strict';
const path = require('node:path');

const FILES = [
  'config.js',
  'strings.en.js',
  'sheet/template.js',
  'sheet/code.js',
  'sheet/qr.js',
  'sheet/svg.js',
  'sheet/pdf.js',
  'image/homography.js',
  'image/lab.js',
  'image/components.js',
  'image/rectify.js',
  'measure/compute.js',
  'measure/flags.js',
  'measure/record.js',
  'io/csv.js',
  'io/project.js',
  'io/session.js',
  'io/autosave.js',
  'io/tables.js',
  'io/merge.js',
  'io/compare.js',
  'io/subsample.js',
  'detect/corners.js',
  'detect/floorline.js',
  'detect/redfigure.js',
  'detect/profile.js',
  'detect/snap.js',
  'detect/qr.js',
  'detect/suggest.js',
  'detect/line.js',
  'detect/glyphs.js',
  'detect/ocr.js',
  'detect/boxes.js',
  'detect/pipeline.js',
  'report/stats.js',
  'report/charts.js',
  'report/build.js',
  'report/calibration.js'
];

const JS = path.join(__dirname, '..', '..', 'js');
for (const f of FILES) require(path.join(JS, f));

module.exports = globalThis.HUSS;
