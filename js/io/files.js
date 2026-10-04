/* HuSS Scorer — js/io/files.js
 * Local file helpers: downloads (Blob URLs, no network) and drag-and-drop.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.io = HUSS.io || {};

  function downloadText(fileName, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function downloadBytes(fileName, bytes, mime) {
    var blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  /** Reads a File as text (UTF-8). */
  function readText(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result)); };
      r.onerror = function () { reject(r.error); };
      r.readAsText(file);
    });
  }

  /** Calls onFiles(FileList) when files are dropped on `el`; toggles `className` while dragging. */
  function onDrop(el, className, onFiles) {
    var depth = 0;
    el.addEventListener('dragenter', function (e) { e.preventDefault(); depth++; el.classList.add(className); });
    el.addEventListener('dragover', function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    el.addEventListener('dragleave', function () { depth = Math.max(0, depth - 1); if (!depth) el.classList.remove(className); });
    el.addEventListener('drop', function (e) {
      e.preventDefault(); depth = 0; el.classList.remove(className);
      if (e.dataTransfer.files && e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
    });
  }

  HUSS.io.files = { downloadText: downloadText, downloadBytes: downloadBytes, readText: readText, onDrop: onDrop };
})(typeof globalThis !== 'undefined' ? globalThis : this);
