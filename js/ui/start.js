/* HuSS Scorer — js/ui/start.js
 * Start (spec 8.1): image folder by folder picker, file selection or drag and drop (folders
 * included), previous CSV for resuming, key and structures tables for Open mode.
 * The session itself is run by ui/queue.js.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.ui = HUSS.ui || {};

  function $(id) { return document.getElementById(id); }

  /** Reads every file of a dropped item list, walking into folders. */
  function droppedFiles(dt) {
    var items = dt.items ? Array.prototype.slice.call(dt.items) : [];
    var entries = items.map(function (it) { return it.webkitGetAsEntry ? it.webkitGetAsEntry() : null; }).filter(Boolean);
    if (!entries.length) return Promise.resolve(Array.prototype.slice.call(dt.files || []));
    var out = [];
    var walk = function (entry) {
      if (entry.isFile) return new Promise(function (res) { entry.file(function (f) { out.push(f); res(); }, function () { res(); }); });
      if (!entry.isDirectory) return Promise.resolve();
      var reader = entry.createReader();
      return new Promise(function (res) {
        var all = [];
        var next = function () {
          reader.readEntries(function (batch) {
            if (!batch.length) { Promise.all(all.map(walk)).then(res); return; }
            all = all.concat(Array.prototype.slice.call(batch));
            next();
          }, function () { res(); });
        };
        next();
      });
    };
    return Promise.all(entries.map(walk)).then(function () { return out; });
  }

  function pick(input) {
    input.value = '';
    input.click();
  }

  function init() {
    var folderInput = $('folder-input'), filesInput = $('files-input'), csvInput = $('csv-input');
    var keyInput = $('key-input'), structuresInput = $('structures-input');
    var Q = HUSS.ui.queue;
    [$('btn-open'), $('btn-choose'), $('btn-folder')].forEach(function (b) { b.addEventListener('click', function () { pick(folderInput); }); });
    [$('btn-choose-files'), $('btn-files')].forEach(function (b) { b.addEventListener('click', function () { pick(filesInput); }); });
    $('btn-resume-csv').addEventListener('click', function () { pick(csvInput); });
    $('btn-key').addEventListener('click', function () { pick(keyInput); });
    $('btn-structures').addEventListener('click', function () { pick(structuresInput); });

    folderInput.addEventListener('change', function () { if (folderInput.files.length) Q.begin(folderInput.files); });
    filesInput.addEventListener('change', function () { if (filesInput.files.length) Q.begin(filesInput.files); });
    csvInput.addEventListener('change', function () {
      var f = csvInput.files[0];
      if (f) HUSS.io.files.readText(f).then(function (t) { Q.setPendingCsv(t, f.name); });
    });
    keyInput.addEventListener('change', function () {
      var f = keyInput.files[0];
      if (f) HUSS.io.files.readText(f).then(function (t) { Q.setTable('key', t); });
    });
    structuresInput.addEventListener('change', function () {
      var f = structuresInput.files[0];
      if (f) HUSS.io.files.readText(f).then(function (t) { Q.setTable('structures', t); });
    });

    HUSS.io.files.onDrop($('stage'), 'drag-over', function () {});
    $('stage').addEventListener('drop', function (e) {
      if (Q.running) return;
      droppedFiles(e.dataTransfer).then(function (list) { Q.begin(list); });
    });
    // Dropping a file anywhere else must not navigate away from the tool.
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) { e.preventDefault(); });
  }

  HUSS.ui.start = { init: init, droppedFiles: droppedFiles };
})(typeof globalThis !== 'undefined' ? globalThis : this);
