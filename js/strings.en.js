/* HuSS Scorer — js/strings.en.js
 * Every interface text. A translation is a copy of this file with the same keys.
 * Placeholders: {name}.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};

  HUSS.strings = {
    app_title: 'HuSS Scorer',
    phase_badge: 'Phase 1 prototype',
    open_image: 'Open image…',

    drop_title: 'Drop a scanned HuSS drawing here',
    drop_sub: 'JPEG or PNG, colour scan at 300 dpi. The image stays on this computer.',
    drop_button: 'Choose image…',
    busy: 'Aligning and detecting…',

    fit: 'Fit',
    zoom_in: 'Zoom in (+)',
    zoom_out: 'Zoom out (−)',
    hint_idle: 'Wheel: zoom · Space + drag or drag empty paper: pan · 1–4: select handle · Arrows: nudge (Shift ×10) · Alt: no snap · Enter: confirm',
    hint_place: 'Click on the drawing to place the {name} handle. Esc cancels.',
    hint_foot_locked: 'The foot handle is locked. Unlock it in the panel to move it.',

    sec_session: 'Session',
    project_code: 'Project code',
    rater_code: 'Your rater code *',
    rater_code_placeholder: 'your initials, e.g. EY',
    rater_code_help: 'Who is scoring: your initials or a short code. Required; it is written into the CSV.',
    sheet_code: 'Sheet code',
    sheet_code_hint: 'Typed by hand until QR reading arrives (Phase 2).',
    sheet_code_ok: 'Check character OK',
    sheet_code_bad: 'Not a valid sheet code',

    sec_image: 'Image',
    no_image: 'No image loaded.',
    align_summary: 'Aligned automatically · {r} px/mm · residual {res} mm · rotation {rot}°',
    timing: 'Processed in {ms} ms',

    sec_handles: 'Handles',
    h_head: 'Head',
    h_foot: 'Foot',
    h_ceiling: 'Ceiling',
    h_wall: 'Opposite wall',
    h_axis: 'Axis',
    st_suggested: 'suggested',
    st_snapped: 'snapped',
    st_manual: 'manual',
    st_auto: 'auto',
    st_unplaced: 'not placed',
    place: 'Place',
    replace: 'Re-place',
    foot_locked: 'Locked',
    foot_unlocked: 'Unlocked',
    foot_lock_title: 'The foot follows rule 3 unless you unlock it',

    sec_values: 'Values',
    v_figure: 'Figure',
    v_ceiling: 'Ceiling height',
    v_distance: 'Distance to wall',
    v_scale: 'Scale',
    v_est_v: 'Estimated ceiling height',
    v_est_h: 'Estimated distance',
    v_backup: 'backup',
    v_backup_title: 'Figure measured to the lowest red point instead of the floor line (rules 1.0 for floating figures)',
    v_figure_red: 'Figure to red bottom (backup)',
    unit_mm: 'mm',
    unit_m: 'm',
    unit_mm_per_m: 'mm/m',

    sec_flags: 'Flags',
    flag_red_not_found: 'Red figure not found',
    flag_figure_small: 'Figure smaller than the minimum',
    flag_figure_off_mark: 'Figure more than 5 mm from the start mark',
    flag_foot_off_floor: 'Red figure does not end on the floor line',
    flag_multiple_red: 'More than one red cluster',
    flag_axis_moved: 'Axis moved by hand',
    flag_manual_alignment: 'Manual alignment',
    flag_alignment_warning: 'Alignment warning',
    flag_color_noncompliant: 'Figure colour does not follow the instructions',
    flags_none: 'None',

    sec_view: 'View',
    view_contrast: 'Contrast boost (C)',
    view_mask: 'Show red mask (R)',
    view_guides: 'Guide lines (H)',
    view_snap: 'Snap',

    confirm: 'Confirm and download CSV',
    download_again: 'Download CSV again',
    missing: 'Still needed before the CSV can be downloaded: {list}',
    need_rater_code: 'your rater code (box just above the button)',
    confirmed: 'Confirmed at {time}. The CSV file was downloaded.',
    changed_after_confirm: 'Changed after confirming. Confirm again to download the new values.',

    err_corners_not_found: 'The four corner marks were not found. Scan the whole sheet in colour at 300 dpi. Manual alignment comes in Phase 2.',
    err_orientation_failed: 'The page orientation could not be determined (floor line not found).',
    err_decode: 'This file could not be opened as an image.',
    err_type: 'Please choose a JPEG or PNG image.',
    err_internal: 'Something went wrong while processing the image: {msg}'
  };

  /** Interface text by key, with {placeholders} filled from params. */
  HUSS.t = function (key, params) {
    var s = HUSS.strings[key];
    if (s === undefined) return key;
    if (params) s = s.replace(/\{(\w+)\}/g, function (m, k) { return params[k] !== undefined ? params[k] : m; });
    return s;
  };

  if (typeof module === 'object' && module.exports) module.exports = HUSS.strings;
})(typeof globalThis !== 'undefined' ? globalThis : this);
