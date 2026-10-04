/* HuSS Scorer — js/io/subsample.js
 * Subsample list (spec 5.4, 8.1): one sheet code per line (TXT, or a CSV whose first column or
 * sheet_code column holds the codes). Used to give a second rater part of the drawings. DOM-free.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.io = HUSS.io || {};

  /** Returns { codes: [valid, unique, in file order], invalid: [{ line, text }] }. */
  function parse(text) {
    var C = HUSS.sheet.code, lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/);
    var head = (lines[0] || '').toLowerCase().split(/[;,\t]/).map(function (h) { return h.trim(); });
    var col = head.indexOf('sheet_code'), start = col >= 0 ? 1 : 0;
    if (col < 0) col = 0;
    var codes = [], invalid = [];
    for (var i = start; i < lines.length; i++) {
      var cell = (lines[i].split(/[;,\t]/)[col] || '').trim();
      if (!cell) continue;
      var c = C.normalize(cell);
      if (!C.isValid(c)) { invalid.push({ line: i + 1, text: cell }); continue; }
      if (codes.indexOf(c) < 0) codes.push(c);
    }
    return { codes: codes, invalid: invalid };
  }

  /**
   * A random subsample of n codes (all when n >= the number of codes), returned sorted.
   * byGroup: optional { code: group } to take the same share from every group (e.g. structure).
   * random() in [0, 1); pass a secure one in the tool.
   */
  function make(codes, n, random, byGroup) {
    var pick = function (list, k) {
      var a = list.slice();
      for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
      return a.slice(0, Math.max(0, Math.min(k, a.length)));
    };
    var out;
    if (!byGroup) out = pick(codes, n);
    else {
      var groups = {}, keys = [];
      codes.forEach(function (c) { var g = byGroup[c] || ''; if (!groups[g]) { groups[g] = []; keys.push(g); } groups[g].push(c); });
      var share = codes.length ? n / codes.length : 0;
      out = [];
      // Each group its proportional share (rounded), then the remainder from the largest remainders.
      var rest = keys.map(function (g) { var want = groups[g].length * share; return { g: g, k: Math.floor(want), frac: want - Math.floor(want) }; });
      var left = Math.min(n, codes.length) - rest.reduce(function (s, r) { return s + r.k; }, 0);
      rest.slice().sort(function (a, b) { return b.frac - a.frac; }).slice(0, Math.max(0, left)).forEach(function (r) { r.k++; });
      rest.forEach(function (r) { out = out.concat(pick(groups[r.g], r.k)); });
    }
    return out.sort();
  }

  function toText(codes) {
    return codes.join('\r\n') + '\r\n';
  }

  var api = { parse: parse, make: make, toText: toText };
  HUSS.io.subsample = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
