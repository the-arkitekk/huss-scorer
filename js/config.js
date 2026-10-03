/* HuSS Scorer — js/config.js
 * Every threshold and default lives here as a named constant.
 * Values are starting points (spec section 7); they are tuned on the tuning set and
 * frozen before validation.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};

  var config = {
    TOOL_VERSION: '0.1.0',
    RULES_VERSION: '1.0',

    // Project-level defaults (spec 5.1). Phase 2 reads these from the project file.
    DEFAULTS: {
      project_code: '',
      template: 'A4L',
      sheet_label: 'figure',
      ref_height_m: 1.70,
      min_figure_mm: 10,
      foot_tolerance_mm: 0.5,
      snap_radius_mm: 1.5,
      mode: 'open',
      file_project_fallback: 'HUSS'
    },

    // Default exclusion criteria (spec 5.1); Phase 2 takes them from the project file.
    EXCLUSION_IDS: ['excl_no_figure', 'excl_not_standing_full', 'excl_not_along_axis', 'excl_other'],

    // 7.2 Corner marks and orientation
    CORNERS: {
      DOWNSCALE_LONG_SIDE: 1000,   // px, long side of the grey working copy
      ASPECT_MIN: 0.7,
      ASPECT_MAX: 1.4,
      FILL_MIN: 0.8,
      SIZE_TOL_MIN: 0.6,           // candidate side / expected side
      SIZE_TOL_MAX: 1.6,
      CENTROID_PAD_FRAC: 0.5,      // window padding around a mark, as a fraction of its side
      CENTROID_DEAD_ZONE: 0.1      // weights below this fraction of contrast are ignored
    },
    ORIENTATION: {
      SAMPLE_STEP_MM: 1,
      FLOOR_END_MARGIN_MM: 2,
      FLOOR_DARK_RATIO_MIN: 0.6,
      TIE_EPS: 0.05                // ratios closer than this count as a tie
    },
    ALIGN: {
      RESIDUAL_WARN_MM: 0.5
    },

    // 7.3 Rectified image
    RECTIFY: {
      R_MIN: 8,
      R_MAX: 24,
      MAX_MEGAPIXELS: 40,
      OUTSIDE_VALUE: 255
    },

    // 7.4 Floor line refinement
    FLOOR: {
      STEP_MM: 1,
      HALF_WINDOW_MM: 1.5,
      END_MARGIN_MM: 2,
      MIN_PEAK_CONTRAST: 30,       // grey levels above the window baseline
      MIN_INLIER_FRACTION: 0.5,
      OUTLIER_MAD_K: 3,
      OUTLIER_MIN_MM: 0.1,
      ITERATIONS: 3
    },

    // 7.7 Red figure
    RED: {
      SEARCH_HALF_WIDTH_MM: 20,
      SEARCH_TOP_MM: 13,
      SEARCH_BELOW_FLOOR_MM: 8,
      A_PRESELECT: 5,
      T_A_MIN: 15,
      T_C: 25,
      HUE_MIN_DEG: -30,
      HUE_MAX_DEG: 60,
      MIN_PRESELECT_PIXELS: 20,    // fewer a*>5 pixels than this: Otsu is skipped, T_A_MIN used
      CLOSE_RADIUS_MM: 0.3,
      MIN_AREA_MM2: 0.5,
      LINK_RADIUS_MM: 1.5,
      MIN_HEIGHT_MM: 3,
      MULTIPLE_RATIO: 0.5,         // second cluster >= this share of the largest: flag_multiple_red
      HEAD_MIN_PIXELS: 2,
      FAST_REJECT_RG: 8,           // R - G below this cannot reach a* >= T_A_MIN
      DARKNESS_DILATE_PX: 1        // red mask grown by this before it is removed from darkness
    },

    // Rule 6
    MARK: {
      OFF_MARK_MM: 5
    },

    // 7.8 Darkness profiles and snap
    PROFILE: {
      CEILING_BAND_HALF_MM: 1.5,
      WALL_BAND_MIN_MM: 1,
      WALL_BAND_MAX_MM: 6,
      SMOOTH_SIGMA_MM: 0.1,
      PEAK_MIN_PROMINENCE: 6,
      PEAK_REL_PROMINENCE: 0.2
    },

    // Scoring screen
    UI: {
      NUDGE_MM: 0.05,
      NUDGE_BIG_MM: 0.5,
      MAGNIFIER_ZOOM: 4,
      MAGNIFIER_SIZE_PX: 180,
      HANDLE_HIT_PX: 9,
      HANDLE_HALF_LEN_MM: 6,
      HANDLE_MIN_HALF_LEN_PX: 28,
      ZOOM_STEP: 1.25,
      ZOOM_MIN_FACTOR: 0.5,        // relative to "fit"
      ZOOM_MAX_PX_PER_MM: 200,
      SMOOTH_BELOW_SCREEN_PX_PER_SOURCE_PX: 3,
      CONTRAST_GAMMA: 1.6
    }
  };

  HUSS.config = config;
  if (typeof module === 'object' && module.exports) module.exports = config;
})(typeof globalThis !== 'undefined' ? globalThis : this);
