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
    rater_code: 'Rater code *',
    rater_code_placeholder: 'your initials, e.g. EY',
    rater_code_help: 'Who is scoring: your initials or a short code. Required; it is written into the CSV.',
    sheet_code: 'Sheet code',
    sheet_code_placeholder: 'optional, e.g. 6QHJ4',
    sheet_code_hint: 'Optional for now: the 5 characters printed at the bottom right of the sheet, next to the QR square. From Phase 2 on it is read from the QR automatically.',
    sheet_code_ok: 'Check character OK',
    sheet_code_bad: 'Not a sheet code. Copy the 5 characters printed at the bottom right, next to the QR square (they never contain 0, 1, I, O or S).',

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
    need_rater_code: 'your rater code (Session, top of this panel)',
    confirmed: 'Confirmed at {time}. The CSV file was downloaded.',
    changed_after_confirm: 'Changed after confirming. Confirm again to download the new values.',

    err_corners_not_found: 'The four corner marks were not found. Scan the whole sheet in colour at 300 dpi. Manual alignment comes in Phase 2.',
    err_orientation_failed: 'The page orientation could not be determined (floor line not found).',
    err_decode: 'This file could not be opened as an image.',
    err_type: 'Please choose a JPEG or PNG image.',
    err_internal: 'Something went wrong while processing the image: {msg}',

    // Navigation
    tab_score: 'Score',
    tab_sheets: 'Sheets',
    tab_project: 'New project',

    // Project card on the scoring screen
    sec_project: 'Project',
    project_none: 'No project file loaded: default settings (A4L, reference 1.70 m).',
    project_info: '{code}{title} · {template} · reference {ref} m',
    load_project: 'Load project file…',
    new_project: 'New project…',
    project_loaded_reload: 'Project loaded; the open image was analysed again with its settings.',
    project_rules_mismatch: 'This project file says scoring rules {file}; this tool uses rules {tool}.',
    project_bad_file: 'This is not a valid project file: {list}',
    sheet_code_qr: 'Read from the QR code on the sheet.',
    qr_template_mismatch: 'The QR code says template {qr}, but {used} is in use. Load the matching project file.',

    // Sheet generator
    sg_title: 'Sheet generator',
    sg_intro: 'Makes coded drawing sheets with a QR code. Nothing about the participant is printed on the front.',
    sg_template: 'Template',
    sg_template_locked: 'Set by the loaded project.',
    sg_label: 'Mark label',
    sg_count: 'Number of sheets',
    sg_exclude: 'Codes not to use',
    sg_exclude_placeholder: 'Paste codes already printed, or load an earlier code list',
    sg_load_list: 'Load code list…',
    sg_exclude_info: '{n} codes will be avoided.',
    sg_generate: 'Generate sheets',
    sg_bad_count: 'Enter a number of sheets between 1 and {max}.',
    sg_bad_label: 'The mark label must be 1 to 20 characters.',
    sg_done: '{n} sheets generated ({template}).',
    sg_print_warning: 'Print at 100% (actual size), not fit to page.',
    sg_check: 'Check one printed sheet with a ruler: the centres of the two top corner squares must be {mm} mm apart.',
    sg_print: 'Print…',
    sg_pdf: 'Download PDF',
    sg_csv: 'Download code list (CSV)',
    sg_codes: 'Codes: {list}',

    // New project form
    pf_title: 'New project',
    pf_intro: 'The project file is made once by the project owner and sent to every rater. It contains no personal data.',
    pf_code: 'Project code *',
    pf_code_help: 'Capital letters, digits and hyphens, e.g. VR3005.',
    pf_title_field: 'Title',
    pf_template: 'Template',
    pf_label: 'Mark label',
    pf_ref: 'Reference height (m)',
    pf_min_fig: 'Minimum figure (mm)',
    pf_foot_tol: 'Foot tolerance (mm)',
    pf_snap: 'Snap radius (mm)',
    pf_suggestions: 'Suggestions',
    pf_sug_figure: 'Head and foot from the red figure',
    pf_sug_ceiling: 'Ceiling (from Phase 2c)',
    pf_sug_wall: 'Opposite wall (from Phase 2c)',
    pf_exclusions: 'Exclusion criteria',
    pf_excl_add: 'Add criterion',
    pf_excl_remove: 'Remove',
    pf_excl_placeholder: 'Criterion, e.g. Figure not drawn',
    pf_rules: 'Scoring rules {v} (set by the tool).',
    pf_download: 'Download project file',
    pf_use: 'Use this project now',
    pf_saved: 'Project file downloaded: {name}',
    pf_errors: 'Please fix: {list}',
    pf_err_required: '{field} is required',
    pf_err_pattern: '{field} may contain only capital letters, digits and hyphens',
    pf_err_range: '{field} is out of range',
    pf_err_template: 'unknown template',
    pf_err_type: '{field} is not valid',
    pf_err_exclusion: 'an exclusion criterion is empty or repeated',
    pf_err_json: 'the file is not readable JSON',
    pf_err_not_project: 'the file is not a HuSS project file',
    pf_err_format_version: 'the project file format version is not supported'
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
