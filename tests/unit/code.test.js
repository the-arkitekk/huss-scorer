'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const HUSS = require('./_load.js');

const { ALPHABET, checkChar, isValid, generate, normalize } = HUSS.sheet.code;

// Deterministic PRNG so failures are reproducible.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('alphabet has 31 characters without 0, 1, I, O, S', () => {
  assert.equal(ALPHABET.length, 31);
  for (const ch of '01IOS') assert.equal(ALPHABET.includes(ch), false);
  assert.equal(new Set(ALPHABET).size, 31);
});

test('check character follows the weighted sum rule', () => {
  // body "2222": all values 0 -> check A[0] = "2"
  assert.equal(checkChar('2222'), '2');
  // body "3222": v1 = 1 -> sum 1 -> "3"
  assert.equal(checkChar('3222'), '3');
  // body "2223": v4 = 1 -> sum 4 -> "6"
  assert.equal(checkChar('2223'), '6');
  assert.equal(checkChar('22I2'), null);
});

test('valid codes are accepted (also lower case and padded)', () => {
  const rnd = mulberry32(42);
  for (let k = 0; k < 500; k++) {
    const c = generate(rnd);
    assert.equal(isValid(c), true, c);
  }
  const c = generate(mulberry32(7));
  assert.equal(isValid('  ' + c.toLowerCase() + ' '), true);
  assert.equal(normalize(' ab '), 'AB');
});

test('every single-character change is rejected', () => {
  const rnd = mulberry32(1);
  for (let k = 0; k < 200; k++) {
    const c = generate(rnd);
    for (let i = 0; i < 5; i++) {
      for (const ch of ALPHABET) {
        if (ch === c[i]) continue;
        const bad = c.slice(0, i) + ch + c.slice(i + 1);
        assert.equal(isValid(bad), false, `${c} -> ${bad}`);
      }
    }
  }
});

test('every swap of two different neighbouring characters is rejected', () => {
  const rnd = mulberry32(2);
  for (let k = 0; k < 2000; k++) {
    const c = generate(rnd);
    for (let i = 0; i < 4; i++) {
      if (c[i] === c[i + 1]) continue;
      const bad = c.slice(0, i) + c[i + 1] + c[i] + c.slice(i + 2);
      assert.equal(isValid(bad), false, `${c} -> ${bad}`);
    }
  }
});

test('wrong length and foreign characters are rejected', () => {
  assert.equal(isValid(''), false);
  assert.equal(isValid('2222'), false);
  assert.equal(isValid('222222'), false);
  assert.equal(isValid('O2222'), false);
  assert.equal(isValid(null), false);
});
