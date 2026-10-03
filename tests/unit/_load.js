// Loads the DOM-free tool files into globalThis.HUSS, in dependency order.
'use strict';
const path = require('node:path');

const FILES = [
  'config.js',
  'sheet/template.js',
  'sheet/code.js',
  'image/homography.js',
  'image/lab.js',
  'image/components.js',
  'image/rectify.js',
  'measure/compute.js',
  'measure/flags.js',
  'measure/record.js',
  'io/csv.js',
  'detect/corners.js',
  'detect/floorline.js',
  'detect/redfigure.js',
  'detect/profile.js',
  'detect/snap.js',
  'detect/pipeline.js'
];

const JS = path.join(__dirname, '..', '..', 'js');
for (const f of FILES) {
  try {
    require(path.join(JS, f));
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND' || !String(e.message).includes(f)) throw e;
  }
}

module.exports = globalThis.HUSS;
