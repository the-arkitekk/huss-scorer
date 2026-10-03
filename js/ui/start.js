/* HuSS Scorer — js/ui/start.js
 * Phase 1 start: open a single image by button or drag and drop.
 * (Project file, folder, resume and modes come in Phase 2.)
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.ui = HUSS.ui || {};

  function init() {
    var input = document.getElementById('file-input');
    var pick = function () { input.value = ''; input.click(); };
    document.getElementById('btn-open').addEventListener('click', pick);
    document.getElementById('btn-choose').addEventListener('click', pick);
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) HUSS.ui.scorer.load(input.files[0]);
    });
    HUSS.io.files.onDrop(document.getElementById('stage'), 'drag-over', function (files) {
      HUSS.ui.scorer.load(files[0]);
    });
    // Dropping a file anywhere else must not navigate away from the tool.
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) { e.preventDefault(); });
  }

  HUSS.ui.start = { init: init };
})(typeof globalThis !== 'undefined' ? globalThis : this);
