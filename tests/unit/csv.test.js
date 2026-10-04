'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const HUSS = require('./_load.js');

const csv = HUSS.io.csv;

function sampleRecord(overrides) {
  const r = {};
  for (const c of csv.COLUMNS) r[c.name] = null;
  return Object.assign(r, {
    project_code: 'VR3005', sheet_code: '2223' + HUSS.sheet.code.checkChar('2223'), rater_code: 'AB',
    mode: 'open', status: 'measured', measured_at: '2026-10-04T14:03:22+03:00', duration_s: 41,
    tool_version: '0.1.0', rules_version: '1.0', template: 'A4L', file_name: 'scan 001.jpg',
    image_width_px: 3508, image_height_px: 2480, code_source: 'manual', align_method: 'auto',
    px_per_mm_x: 11.811, px_per_mm_y: 11.809, rotation_deg: -0.412, align_residual_mm: 0.04,
    corner_tl_x_px: 118.25, corner_tl_y_px: 117.9, floor_y_mm: 180.03, floor_slope: -0.000123,
    axis_x_mm: 40.12, head_y_mm: 160.05, foot_y_mm: 180.03, ceiling_y_mm: 120.1, wall_x_mm: 160.2,
    head_placement: 'suggested', foot_placement: 'suggested', ceiling_placement: 'snapped',
    wall_placement: 'manual', axis_placement: 'auto', head_suggested_y_mm: 160.05,
    figure_mm: 19.98, ceiling_mm: 59.93, distance_mm: 120.08, ref_height_m: 1.7,
    scale_mm_per_m: 11.7529, est_vertical_m: 5.099, est_horizontal_m: 10.217,
    flag_red_not_found: false, flag_figure_small: false, flag_color_noncompliant: true,
    excluded: false,
    note: 'Comma, "quotes"\nand a second line\r\nand CRLF'
  }, overrides || {});
}

test('header matches the spec column list exactly', () => {
  const header = csv.toCSV([]).split('\r\n')[0].split(',');
  assert.equal(header[0], 'project_code');
  assert.equal(header.at(-1), 'note');
  assert.equal(new Set(header).size, header.length, 'no duplicate columns');
  for (const name of ['corner_tl_x_px', 'corner_br_y_px', 'floor_x_px', 'wall_y_px', 'wall_suggested_x_mm',
    'est_horizontal_alt_m', 'flag_alignment_warning', 'horizontal_not_measurable', 'excl_other',
    'ceiling_at_axis_y_mm', 'wall_at_floor_x_mm', 'est_vertical_at_axis_m', 'est_horizontal_at_floor_m',
    'ceiling_spread_mm', 'wall_spread_mm', 'flag_ceiling_uneven', 'flag_wall_uneven']) {
    assert.ok(header.includes(name), name);
  }
  assert.equal(header.includes('E_vertical'), false, 'post-merge columns are added by Merge');
});

test('export -> import gives back the same record; text is stable', () => {
  const rec = sampleRecord();
  const text = csv.toCSV([rec]);
  assert.equal(text.charCodeAt(0) === 0xFEFF, false, 'no BOM');
  const back = csv.readMeasurements(text);
  assert.equal(back.ok, true);
  assert.equal(back.records.length, 1);
  assert.deepEqual(back.records[0], rec);
  assert.equal(csv.toCSV(back.records), text);
});

test('note keeps commas, quotes and line breaks', () => {
  const rec = sampleRecord({ note: 'a,b "c" ""\nline2\r\nline3,' });
  const back = csv.readMeasurements(csv.toCSV([rec, sampleRecord({ sheet_code: '22222' })]));
  assert.equal(back.records[0].note, 'a,b "c" ""\nline2\r\nline3,');
  assert.equal(back.records[1].sheet_code, '22222');
});

test('rounding rules: mm 0.01, m 0.001, E 0.0001; booleans 0/1; missing empty', () => {
  assert.equal(csv.formatValue('mm', 94.1176), '94.12');
  assert.equal(csv.formatValue('m', 2.54999), '2.550');
  assert.equal(csv.formatValue('E', -0.055555), '-0.0556');
  assert.equal(csv.formatValue('mm', -0.001), '0.00');
  assert.equal(csv.formatValue('bool', true), '1');
  assert.equal(csv.formatValue('bool', false), '0');
  assert.equal(csv.formatValue('mm', null), '');
  assert.equal(csv.formatValue('m', NaN), '');
});

test('Excel view uses BOM, semicolons and decimal commas, and is refused on load', () => {
  const rec = sampleRecord();
  const xl = csv.toExcelView([rec]);
  assert.equal(xl.charCodeAt(0), 0xFEFF);
  const lines = xl.slice(1).split('\r\n');
  assert.ok(lines[0].startsWith('project_code;sheet_code;'));
  assert.ok(lines[1].includes(';11,811;'));
  const back = csv.readMeasurements(xl);
  assert.equal(back.ok, false);
  assert.equal(back.error, 'excel_view');
  // Also refused when the BOM was stripped by another program.
  assert.equal(csv.readMeasurements(xl.slice(1)).error, 'excel_view');
});

test('foreign CSV is refused', () => {
  assert.equal(csv.readMeasurements('a,b\n1,2\n').error, 'not_measurement_csv');
});
