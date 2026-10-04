/* HuSS Scorer — js/io/session.js
 * A scoring session over a folder of scans (spec 8.1, 8.4, 5.2, 5.5). DOM-free.
 *
 * Items are the scans; the queue runs in ascending sheet code order (spec 8.4), scans whose
 * code could not be read go last. Each item may carry a CSV record (measured, excluded or
 * deferred). Records restore the handles exactly (resume from CSV or autosave).
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.io = HUSS.io || {};

  var DONE = { measured: true, excluded: true };

  function itemKey(name, size, lastModified) {
    return name + '|' + size + '|' + lastModified;
  }

  /** opts: { project_code, rater_code, mode, exclusionIds } */
  function create(opts) {
    return {
      project_code: opts.project_code || '',
      rater_code: opts.rater_code || '',
      mode: opts.mode,
      exclusionIds: (opts.exclusionIds || HUSS.io.csv.DEFAULT_EXCLUSIONS).filter(function (id) { return id !== 'excl_other'; }),
      items: [],
      order: [],
      index: 0,
      setAside: [],        // duplicate scans not chosen: [{ name, sheet_code }]
      orphans: [],         // records (from CSV or autosave) whose sheet has no scan in this folder
      confirmsSinceDownload: 0,
      dirty: false         // changes since the last CSV download
    };
  }

  /** Adds scans after their codes were read: [{ name, size, lastModified, sheet_code|null, template|null, thumb? }] */
  function addItems(sess, list) {
    list.forEach(function (f) {
      sess.items.push({
        key: itemKey(f.name, f.size, f.lastModified), name: f.name, size: f.size, lastModified: f.lastModified,
        sheet_code: f.sheet_code || null, code_source: f.sheet_code ? 'qr' : null, template: f.template || null,
        thumb: f.thumb || null, status: null, record: null, seconds: 0
      });
    });
    buildOrder(sess);
  }

  function byKey(sess, key) {
    for (var i = 0; i < sess.items.length; i++) if (sess.items[i].key === key) return sess.items[i];
    return null;
  }

  /** Groups of scans that share a sheet code (to be resolved before scoring). */
  function duplicates(sess) {
    var groups = {}, out = [];
    sess.items.forEach(function (it) {
      if (!it.sheet_code || it.code_source !== 'qr') return;
      (groups[it.sheet_code] = groups[it.sheet_code] || []).push(it);
    });
    Object.keys(groups).sort().forEach(function (c) { if (groups[c].length > 1) out.push({ sheet_code: c, items: groups[c] }); });
    return out;
  }

  /** Keeps one scan of a duplicated code; the others are set aside (reported, not scored). */
  function keepDuplicate(sess, code, keepKey) {
    sess.items = sess.items.filter(function (it) {
      if (it.sheet_code === code && it.code_source === 'qr' && it.key !== keepKey) {
        sess.setAside.push({ name: it.name, sheet_code: code });
        return false;
      }
      return true;
    });
    buildOrder(sess);
  }

  /** Queue order: readable codes ascending, then unreadable scans by file name. */
  function buildOrder(sess) {
    var cur = sess.order[sess.index];
    var coded = sess.items.filter(function (it) { return it.code_source === 'qr'; });
    var rest = sess.items.filter(function (it) { return it.code_source !== 'qr'; });
    coded.sort(function (a, b) { return a.sheet_code < b.sheet_code ? -1 : a.sheet_code > b.sheet_code ? 1 : 0; });
    rest.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    sess.order = coded.concat(rest).map(function (it) { return it.key; });
    var i = cur ? sess.order.indexOf(cur) : -1;
    sess.index = i >= 0 ? i : 0;
  }

  function current(sess) {
    return sess.order.length ? byKey(sess, sess.order[sess.index]) : null;
  }

  /** 1-based number among scans without a readable code (for "Sheet without a readable code N"). */
  function unreadNumber(sess, item) {
    var n = 0;
    for (var i = 0; i < sess.order.length; i++) {
      var it = byKey(sess, sess.order[i]);
      if (it.code_source !== 'qr') n++;
      if (it === item) return n;
    }
    return 0;
  }

  function progress(sess) {
    var done = 0, deferred = 0;
    sess.items.forEach(function (it) { if (DONE[it.status]) done++; else if (it.status === 'deferred') deferred++; });
    return { done: done, deferred: deferred, total: sess.items.length, position: sess.index + 1 };
  }

  /**
   * Index of the next scan to show: the next not-yet-scored scan after the current one, then
   * from the start, then the scans marked "review later"; -1 when everything is done.
   */
  function nextIndex(sess) {
    var n = sess.order.length, i, it;
    for (i = 1; i <= n; i++) {
      it = byKey(sess, sess.order[(sess.index + i) % n]);
      if (!it.status) return (sess.index + i) % n;
    }
    for (i = 1; i <= n; i++) {
      it = byKey(sess, sess.order[(sess.index + i) % n]);
      if (it.status === 'deferred') return (sess.index + i) % n;
    }
    return -1;
  }

  function goTo(sess, index) {
    if (index >= 0 && index < sess.order.length) sess.index = index;
  }

  /** Stores the record of a scan (status inside the record: measured, excluded or deferred). */
  function setRecord(sess, item, record) {
    item.record = record;
    item.status = record.status;
    if (record.sheet_code && item.code_source !== 'qr') { item.sheet_code = record.sheet_code; item.code_source = 'manual'; }
    if (DONE[record.status]) sess.confirmsSinceDownload++;
    sess.dirty = true;
  }

  /** All records in queue order, then records whose scan is not in this folder. */
  function records(sess) {
    var out = [];
    sess.order.forEach(function (k) { var it = byKey(sess, k); if (it.record) out.push(it.record); });
    return out.concat(sess.orphans);
  }

  function columns(sess) {
    return HUSS.io.csv.columnsFor(sess.exclusionIds);
  }

  function markDownloaded(sess) {
    sess.confirmsSinceDownload = 0;
    sess.dirty = false;
  }

  /**
   * Puts saved records back on their scans: by sheet code, or by file name for scans whose
   * code had to be typed. Returns { matched, orphans, conflicts } (conflicts: other rater or mode).
   */
  function applyRecords(sess, recs) {
    var matched = 0, orphans = 0, conflicts = 0;
    recs.forEach(function (rec) {
      if ((rec.rater_code && rec.rater_code !== sess.rater_code) || (rec.mode && rec.mode !== sess.mode)) { conflicts++; return; }
      var it = null;
      for (var i = 0; i < sess.items.length && !it; i++) {
        var c = sess.items[i];
        if (c.code_source === 'qr' && c.sheet_code === rec.sheet_code) it = c;
      }
      for (i = 0; i < sess.items.length && !it; i++) {
        c = sess.items[i];
        if (c.code_source !== 'qr' && rec.file_name && c.name === rec.file_name) it = c;
      }
      if (!it) { sess.orphans.push(rec); orphans++; return; }
      it.record = rec;
      it.status = rec.status;
      it.seconds = rec.duration_s || 0;
      if (it.code_source !== 'qr' && rec.sheet_code) { it.sheet_code = rec.sheet_code; it.code_source = 'manual'; }
      matched++;
    });
    buildOrder(sess);
    return { matched: matched, orphans: orphans, conflicts: conflicts };
  }

  /** Handle state, suggestions and rater inputs of a saved record. */
  function stateFromRecord(rec) {
    var place = function (v, p) { return v == null ? null : (p || 'manual'); };
    var ex = {};
    Object.keys(rec).forEach(function (k) {
      if (/^excl_[a-z0-9_]+$/.test(k) && rec[k] !== null) ex[k] = !!rec[k];
    });
    return {
      handles: {
        axis: { x: rec.axis_x_mm, placement: rec.axis_placement || 'auto' },
        head: { y: rec.head_y_mm, placement: place(rec.head_y_mm, rec.head_placement) },
        foot: { y: rec.foot_y_mm, placement: place(rec.foot_y_mm, rec.foot_placement) },
        ceiling: { y: rec.ceiling_y_mm, placement: place(rec.ceiling_y_mm, rec.ceiling_placement) },
        wall: { x: rec.wall_x_mm, placement: place(rec.wall_x_mm, rec.wall_placement) }
      },
      suggested: {
        head_y: rec.head_suggested_y_mm, foot_y: rec.foot_suggested_y_mm,
        ceiling_y: rec.ceiling_suggested_y_mm, wall_x: rec.wall_suggested_x_mm
      },
      meta: {
        exclusions: ex,
        vertical_not_measurable: !!rec.vertical_not_measurable,
        horizontal_not_measurable: !!rec.horizontal_not_measurable,
        note: rec.note || '',
        color_noncompliant: !!rec.flag_color_noncompliant,
        sheet_code: rec.sheet_code || '',
        code_source: rec.code_source || null
      },
      seconds: rec.duration_s || 0
    };
  }

  // ---------------------------------------------------------------- autosave payload

  function toSaved(sess) {
    return {
      version: 1,
      saved_at: HUSS.measure.record.isoLocal(new Date()),
      project_code: sess.project_code, rater_code: sess.rater_code, mode: sess.mode,
      exclusionIds: sess.exclusionIds,
      total: sess.items.length,
      done: progress(sess).done,
      records: records(sess),
      current_sheet: (current(sess) || {}).sheet_code || null
    };
  }

  /** Summary line data of a saved session: { done, total, saved_at }. */
  function savedSummary(saved) {
    return saved ? { done: saved.done || 0, total: saved.total || 0, saved_at: saved.saved_at } : null;
  }

  var api = {
    itemKey: itemKey, create: create, addItems: addItems, byKey: byKey, duplicates: duplicates,
    keepDuplicate: keepDuplicate, buildOrder: buildOrder, current: current, unreadNumber: unreadNumber,
    progress: progress, nextIndex: nextIndex, goTo: goTo, setRecord: setRecord, records: records,
    columns: columns, markDownloaded: markDownloaded, applyRecords: applyRecords, stateFromRecord: stateFromRecord,
    toSaved: toSaved, savedSummary: savedSummary
  };
  HUSS.io.session = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
