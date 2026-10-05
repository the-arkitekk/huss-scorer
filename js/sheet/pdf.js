/* HuSS Scorer — js/sheet/pdf.js
 * Drawing sheets as a vector PDF (one sheet per page, true size). DOM-free: returns bytes.
 * Uses the standard Helvetica and Courier fonts (nothing embedded), WinAnsi encoding.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.sheet = HUSS.sheet || {};

  var PT = 72 / 25.4; // points per mm

  // Helvetica advance widths (1/1000 em), printable ASCII 32..126, plus the Turkish letters in WinAnsi.
  var HELV_ASCII = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  var HELV_EXTRA = { 'ç': 500, 'ö': 556, 'ü': 556, 'Ç': 722, 'Ö': 778, 'Ü': 722 };
  // Letters WinAnsi lacks are written with their closest ASCII letter.
  var FALLBACK = { 'ş': 's', 'Ş': 'S', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I' };

  function toWinAnsi(s) {
    return Array.prototype.map.call(String(s), function (ch) {
      if (FALLBACK[ch]) return FALLBACK[ch];
      return ch.charCodeAt(0) <= 255 ? ch : '?';
    }).join('');
  }

  function widthPt(s, font, size) {
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      if (font === 'mono') { w += 600; continue; }
      var c = s.charCodeAt(i);
      w += c >= 32 && c <= 126 ? HELV_ASCII[c - 32] : (HELV_EXTRA[s[i]] || 556);
    }
    return w * size / 1000;
  }

  function f3(v) { return v.toFixed(3); }
  function rg(c) { return (c[0] / 255).toFixed(3) + ' ' + (c[1] / 255).toFixed(3) + ' ' + (c[2] / 255).toFixed(3); }

  function pageContent(t, items) {
    var X = function (x) { return f3(x * PT); };
    var Y = function (y) { return f3((t.height_mm - y) * PT); };
    // White page first: a rasterised PDF must not come out transparent (QR readers see that as black).
    var ops = ['1 g', '0 0 ' + f3(t.width_mm * PT) + ' ' + f3(t.height_mm * PT) + ' re f', '0 g', '0 G'];
    items.forEach(function (it) {
      if (it.k === 'rect') {
        ops.push(X(it.x) + ' ' + Y(it.y + it.h) + ' ' + f3(it.w * PT) + ' ' + f3(it.h * PT) + ' re f');
      } else if (it.k === 'rects') {
        ops.push(it.rects.map(function (r) {
          return X(r.x) + ' ' + Y(r.y + r.h) + ' ' + f3(r.w * PT) + ' ' + f3(r.h * PT) + ' re';
        }).join('\n') + '\nf');
      } else if (it.k === 'poly') {
        ops.push(it.pts.map(function (p, i) { return X(p[0]) + ' ' + Y(p[1]) + (i ? ' l' : ' m'); }).join(' ') + ' h f');
      } else if (it.k === 'line') {
        ops.push((it.color ? rg(it.color) + ' RG ' : '') + f3(it.w * PT) + ' w ' + (it.cap === 'round' ? 1 : 0) + ' J ' +
          X(it.x1) + ' ' + Y(it.y1) + ' m ' + X(it.x2) + ' ' + Y(it.y2) + ' l S' + (it.color ? ' 0 G' : ''));
      } else if (it.k === 'ring') {
        // circle from four Bezier quarter arcs
        var k = 0.5522847498 * it.r, cx = it.cx, cy = it.cy, r = it.r;
        ops.push((it.color ? rg(it.color) + ' RG ' : '') + f3(it.w * PT) + ' w ' +
          X(cx + r) + ' ' + Y(cy) + ' m ' +
          X(cx + r) + ' ' + Y(cy + k) + ' ' + X(cx + k) + ' ' + Y(cy + r) + ' ' + X(cx) + ' ' + Y(cy + r) + ' c ' +
          X(cx - k) + ' ' + Y(cy + r) + ' ' + X(cx - r) + ' ' + Y(cy + k) + ' ' + X(cx - r) + ' ' + Y(cy) + ' c ' +
          X(cx - r) + ' ' + Y(cy - k) + ' ' + X(cx - k) + ' ' + Y(cy - r) + ' ' + X(cx) + ' ' + Y(cy - r) + ' c ' +
          X(cx + k) + ' ' + Y(cy - r) + ' ' + X(cx + r) + ' ' + Y(cy - k) + ' ' + X(cx + r) + ' ' + Y(cy) + ' c S' + (it.color ? ' 0 G' : ''));
      } else if (it.k === 'text') {
        var s = toWinAnsi(it.text), w = widthPt(s, it.font, it.size_pt);
        var x = it.x * PT - (it.anchor === 'middle' ? w / 2 : it.anchor === 'end' ? w : 0);
        var e = s.replace(/[\\()]/g, function (m) { return '\\' + m; });
        ops.push('BT /' + (it.font === 'mono' ? 'F2' : 'F1') + ' ' + it.size_pt + ' Tf ' + f3(x) + ' ' + Y(it.y) + ' Td (' + e + ') Tj ET');
      }
    });
    return ops.join('\n') + '\n';
  }

  /**
   * PDF bytes (Uint8Array) with one page per sheet code. opts.structures: the project's structure
   * codes (boxes on the sheet); opts.itemsFor(code, i): other pages (calibration).
   */
  function sheets(t, codes, label, opts) {
    var structures = opts && opts.structures;
    var W = f3(t.width_mm * PT), H = f3(t.height_mm * PT);
    var objs = [];
    var add = function (s) { objs.push(s); return objs.length; };
    var catalog = add(null), pages = add(null);
    var f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    var f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
    var kids = [];
    var page = function (items) {
      var content = pageContent(t, items);
      var cs = add('<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream');
      kids.push(add('<< /Type /Page /Parent ' + pages + ' 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 ' +
        f1 + ' 0 R /F2 ' + f2 + ' 0 R >> >> /Contents ' + cs + ' 0 R >>'));
    };
    var front = opts && opts.itemsFor ? opts.itemsFor : function (code) { return HUSS.sheet.template.items(t, code, label, structures); };
    codes.forEach(function (code, i) { page(front(code, i)); });
    objs[catalog - 1] = '<< /Type /Catalog /Pages ' + pages + ' 0 R /ViewerPreferences << /PrintScaling /None >> >>';
    objs[pages - 1] = '<< /Type /Pages /Kids [' + kids.map(function (k) { return k + ' 0 R'; }).join(' ') + '] /Count ' + kids.length + ' >>';
    var out = '%PDF-1.4\n', offsets = [];
    objs.forEach(function (o, i) { offsets.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    var xref = out.length;
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    offsets.forEach(function (off) { out += ('0000000000' + off).slice(-10) + ' 00000 n \n'; });
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + catalog + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    var bytes = new Uint8Array(out.length);
    for (var i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xFF;
    return bytes;
  }

  var api = { sheets: sheets, toWinAnsi: toWinAnsi, widthPt: widthPt };
  HUSS.sheet.pdf = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
