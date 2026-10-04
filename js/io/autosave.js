/* HuSS Scorer — js/io/autosave.js
 * Crash insurance in the browser's localStorage (spec 5.5): the session's records, never the
 * images. The downloaded CSV remains the real record. Every access is guarded: in a private
 * window or with storage blocked, autosave simply stays off.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.io = HUSS.io || {};

  function storage(store) {
    if (store) return store;
    try { return root.localStorage || null; } catch (e) { return null; }
  }

  function key(projectCode, raterCode, mode) {
    return 'huss:v1:' + (projectCode || 'NOPROJECT') + ':' + String(raterCode || '').toUpperCase() + ':' + mode;
  }

  /** true when written. */
  function save(k, data, store) {
    var s = storage(store);
    if (!s) return false;
    try { s.setItem(k, JSON.stringify(data)); return true; } catch (e) { return false; }
  }

  function load(k, store) {
    var s = storage(store);
    if (!s) return null;
    try {
      var v = s.getItem(k);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }

  function remove(k, store) {
    var s = storage(store);
    if (!s) return;
    try { s.removeItem(k); } catch (e) { /* storage unavailable */ }
  }

  function available(store) {
    var s = storage(store);
    if (!s) return false;
    try { s.setItem('huss:probe', '1'); s.removeItem('huss:probe'); return true; } catch (e) { return false; }
  }

  var api = { key: key, save: save, load: load, remove: remove, available: available };
  HUSS.io.autosave = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
