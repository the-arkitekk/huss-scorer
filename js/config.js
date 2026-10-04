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
    // 1.1: rule 3 — red drawn below the floor line counts as standing on the line (flagged).
    // 1.2: rule 3 — the figure is always measured from the head top to the floor line;
    //      a red trace ending off the line is flagged, its own bottom kept as a backup value.
    RULES_VERSION: '1.3',

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
      WINDOW_ABOVE_MM: 1.5,
      WINDOW_BELOW_MM: 0.6,        // ground hatching starts ~0.9 mm below the line centre
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
      DARKNESS_DILATE_PX: 2        // red mask grown by this before it is removed from darkness (JPEG pink rim)
    },

    // 7.6 Sheet QR code (version 1, alphanumeric; content HUSS1/<TEMPLATE>/<SHEETCODE>)
    QR: {
      LEVEL: 'Q',                  // error correction level printed on sheets (spec: M or higher)
      QUIET_MODULES: 4,            // quiet zone inside the 15 mm square
      FINDER_WINDOW_MODULES: 4.5,  // half-width of the first, coarse finder centroid window
      CORE_WINDOW_MODULES: 2,      // half-width of the core centroid windows (3 x 3 core + light ring)
      COARSE_ITERATIONS: 2,
      FINDER_ITERATIONS: 3,
      SAMPLE_OFFSET: 0.25,         // 3 x 3 samples per module, this far apart (modules)
      MIN_CONTRAST: 60,            // grey levels between the lightest and darkest sample
      SEARCH_RADIUS_MM: 10,        // fallback search around the expected position
      SEARCH_STEP_MM: 1.5
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

    // 7.9 Automatic suggestions for ceiling and opposite wall
    SUGGEST: {
      CONTINUITY_FRACTION: 0.5,    // 'dark' = darker than this share between paper and the line itself
      TOP_MM: 13,                  // nothing is searched above this (corner marks)
      CEILING_START_ABOVE_HEAD_MM: 1,
      NO_HEAD_START_MM: 3,         // without a head: start this far above the floor line
      CEILING_RUN_MM: 10,          // horizontal continuity checked over this length right of the axis
      CEILING_RUN_MIN: 0.6,
      CEILING_Y_TOLERANCE_MM: 0.5, // hand-drawn ceilings waver
      CEILING_SLOPE_MAX: 0.15,     // ... and may rise or fall slightly (about 8 degrees)
      WALL_START_RIGHT_OF_FIGURE_MM: 1,
      WALL_SEARCH_FROM_MM: 0.5,    // drawn walls often stop short of the floor line: start at the
      WALL_SEARCH_TO_MM: 6,        // lowest dark point between these heights above the floor
      WALL_MIN_FRACTION: 0.5,      // of the ceiling height
      WALL_MIN_MM: 10,             // when the ceiling is unknown
      WALL_INNER_MM: 6,            // double-line wall: inner face within this distance
      WALL_DRIFT_PER_MM: 0.75,     // a drawn wall may lean this much per mm of height
      WALL_GAP_MM: 1               // pencil breaks tolerated
    },

    // 7.5 Manual alignment
    // Average position of hand-drawn ceiling and wall lines (rules 1.3, rules 4 and 5)
    LINE: {
      WINDOW_HALF_MM: 1.0,         // the line centre is looked for within this distance of the previous one
      GAP_MM: 1.0,                 // pencil breaks up to this length are bridged
      END_MM: 1.0,                 // left out at the ends next to a corner (thicker ink where lines meet)
      MIN_LENGTH_MM: 2,            // less followed line than this: the point value is used
      STRENGTH_RUN_MM: 3,          // the line's typical darkness is taken over this length at its start
      FOLLOW_FRACTION: 0.35,       // a sample is on the line when darker than this share of the way from paper to it
      MIN_CONTRAST: 15,            // a start stretch less dark than this above the paper has no line to follow
      PAGE_MARGIN_MM: 8,           // a ceiling without a wall is followed at most this close to the page edge
      CANDIDATE_EXTRA_MM: 10,      // lines crossing the axis (ceiling) or the floor band (wall) this much beyond the snap
                                   // radius are candidates too: a slanted line crosses there away from its average
      FOLLOW_UP_EXTRA_MM: 3,       // a suggested/snapped handle is averaged again within snap radius + this when the other moves
      TURN_SLOPE: 1,               // a line turning steeper than this (45 degrees) over TURN_RUN_MM ends there (a corner)
      TURN_RUN_MM: 0.5,
      TURN_SLACK_MM: 0.15,         // allowance for pencil texture in that test
      UNEVEN_MM: 5                 // flag_ceiling_uneven / flag_wall_uneven above this largest deviation
                                   // (freehand ceilings in the trial scans deviate 2-4 mm; 5 marks a clearly slanted line)
    },
    // Printed sheet code read from its characters when the QR code cannot be read (js/detect/ocr.js)
    OCR: {
      LENGTH: 5,
      ADVANCE_EM: 0.6,             // Courier: every character is 0.6 em wide
      TOP_EM: 0.85,                // the characters are looked for from this far above the baseline
      BOTTOM_EM: 0.3,              // to this far below it (the tail of Q)
      STEP_MM: 0.0625,             // sampling step (16 per mm)
      SUB: 3,                      // samples per grid cell side when a character is averaged onto the grid
      MAX_SHIFT_MM: 0.8,           // the row of characters may sit this far off its printed place
      MIN_SPECK_MM2: 0.02,         // smaller dark spots are dirt, not ink of a character
      MIN_CONTRAST: 40,            // darkness above the paper needed to call it printed text
      ASPECT_WEIGHT: 0.5,          // score penalty per unit of |ln(width/height ratio)| difference
      TOP_K: 3,                    // characters per position tried with the check character
      MIN_CHAR_SCORE: 0.5,         // every character of a reading must match at least this well
      MIN_MARGIN: 0.15,            // and the reading must beat the next valid reading by this much (summed)
      SOLVE_MIN_SCORE: 0.8,        // one lost character is worked out from the check character only when
      SOLVE_MIN_GAP: 0.2           // the other four match this well and this far ahead of their next candidate
    },
    MANUAL: {
      REFINE_WINDOW_MM: 3,         // a click is centred on the corner square within this radius
      CLICK_SLOP_PX: 5             // a press that moves further than this pans instead of placing a point
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
