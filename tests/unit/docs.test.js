'use strict';
// The data dictionary names every column the tool writes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const HUSS = require('./_load.js');

const DOC = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'data-dictionary.md'), 'utf8');

// Columns described as a group in the dictionary
const GROUPS = [/^corner_(tl|tr|bl|br)_[xy]_px$/, /^(head|foot|floor|ceiling|wall)_[xy]_px$/, /^excl_[a-z0-9_]+$/];

test('data dictionary: every measurement, merged and comparison column is described', () => {
  const missing = [];
  const cols = HUSS.io.csv.COLUMNS.concat(HUSS.io.csv.MERGED_COLUMNS).map((c) => c.name)
    .concat(HUSS.io.compare.PER_RATER.map((c) => c[0]), ['rater_r1', 'rater_r2', 'reldiff_est_vertical', 'reldiff_est_horizontal', 'diff_E_vertical', 'diff_E_horizontal']);
  for (const name of cols) {
    if (DOC.includes('`' + name + '`')) continue;
    if (GROUPS.some((g) => g.test(name))) continue;
    missing.push(name);
  }
  assert.deepEqual(missing, []);
});
