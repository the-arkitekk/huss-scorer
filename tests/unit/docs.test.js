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

test('example scans (demo/demo-scans.js): a valid one-structure project and ten JPEG scans, small enough to load', () => {
  const path = require('node:path'), fs = require('node:fs');
  const file = path.join(__dirname, '..', '..', 'demo', 'demo-scans.js');
  require(file);
  const d = HUSS.demoData;
  const v = HUSS.io.project.validate(JSON.parse(JSON.stringify(d.project)));
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  assert.equal(HUSS.io.project.singleStructure(v.project), 'ROOM');
  assert.equal(d.scans.length, 10);
  for (const sc of d.scans) {
    const head = Buffer.from(sc.data.slice(0, 8), 'base64');
    assert.ok(head[0] === 0xFF && head[1] === 0xD8, sc.name + ' is a JPEG');
    assert.ok(/^example-\d\d\.jpeg$/.test(sc.name));
  }
  assert.ok(fs.statSync(file).size < 4.5 * 1024 * 1024, 'the demo file stays small');
  assert.ok(fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'pages.yml'), 'utf8').includes(' demo '), 'published with the site');
});
