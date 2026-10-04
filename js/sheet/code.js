/* HuSS Scorer — js/sheet/code.js
 * Sheet codes (spec 4.4): 4 random characters + 1 check character over a
 * 31-character alphabet without 0, 1, I, O, S.
 * Check character: A[(1*v1 + 2*v2 + 3*v3 + 4*v4) mod 31].
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.sheet = HUSS.sheet || {};

  var ALPHABET = '23456789ABCDEFGHJKLMNPQRTUVWXYZ';
  var N = ALPHABET.length; // 31

  function normalize(input) {
    return String(input == null ? '' : input).trim().toUpperCase();
  }

  /** Check character for a 4-character body; null if the body is not valid. */
  function checkChar(body) {
    if (typeof body !== 'string' || body.length !== 4) return null;
    var sum = 0;
    for (var i = 0; i < 4; i++) {
      var v = ALPHABET.indexOf(body[i]);
      if (v < 0) return null;
      sum += (i + 1) * v;
    }
    return ALPHABET[sum % N];
  }

  /** True when the (normalized) code has 5 alphabet characters and a matching check character. */
  function isValid(code) {
    var c = normalize(code);
    if (c.length !== 5) return false;
    var expected = checkChar(c.slice(0, 4));
    return expected !== null && expected === c[4];
  }

  /** New random code; `random` returns floats in [0, 1). */
  function generate(random) {
    var rnd = random || Math.random;
    var body = '';
    for (var i = 0; i < 4; i++) body += ALPHABET[Math.floor(rnd() * N)];
    return body + checkChar(body);
  }

  /** Valid sheet codes found anywhere in a text (a pasted list or a code-list CSV). */
  function extract(text) {
    var out = [], seen = {}, m, re = /[0-9A-Z]{5}/g, up = String(text || '').toUpperCase();
    while ((m = re.exec(up))) {
      if (isValid(m[0]) && !seen[m[0]]) { seen[m[0]] = true; out.push(m[0]); }
    }
    return out;
  }

  /** n new codes, all different and none in `exclude`; `random` returns floats in [0, 1). */
  function batch(n, exclude, random) {
    var taken = {}, out = [], tries = 0;
    (exclude || []).forEach(function (c) { taken[normalize(c)] = true; });
    while (out.length < n) {
      if (++tries > n * 50 + 1000) throw new Error('Could not find enough unused sheet codes');
      var c = generate(random);
      if (!taken[c]) { taken[c] = true; out.push(c); }
    }
    return out;
  }

  /** Cryptographically strong random floats in [0, 1) when the platform offers them. */
  function secureRandom() {
    var c = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
    if (c && c.getRandomValues) {
      var a = new Uint32Array(1);
      c.getRandomValues(a);
      return a[0] / 4294967296;
    }
    return Math.random();
  }

  var api = {
    ALPHABET: ALPHABET, normalize: normalize, checkChar: checkChar, isValid: isValid, generate: generate,
    extract: extract, batch: batch, secureRandom: secureRandom
  };
  HUSS.sheet.code = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
