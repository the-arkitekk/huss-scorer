# HuSS Scorer — r/icc_kappa.R
#
# Reads the comparison CSV of the Compare screen ("Download comparison CSV": one row per drawing,
# the two raters' values with the suffixes _r1 and _r2) and reports (spec 12):
#   - ICC(2,1) for E_vertical and E_horizontal: two-way random effects, absolute agreement,
#     single measure, with its 95 % confidence interval (irr::icc);
#   - the same for the estimates themselves (est_vertical_m, est_horizontal_m), useful when no
#     true dimensions were loaded;
#   - Cohen's kappa for the exclusion decisions (irr::kappa2).
#
# Usage, in a terminal:   Rscript r/icc_kappa.R path/to/VR3005_compare_AB_CD.csv
#        or in R:         source("r/icc_kappa.R")   (a file dialog asks for the CSV)
# Needs the irr package once: install.packages("irr")

args <- commandArgs(trailingOnly = TRUE)
file <- if (length(args) >= 1) args[1] else file.choose()

if (!requireNamespace("irr", quietly = TRUE)) {
  stop("The irr package is needed: install.packages(\"irr\")")
}

d <- read.csv(file, stringsAsFactors = FALSE, na.strings = c("", "NA"))
need <- c("rater_r1", "rater_r2", "E_vertical_r1", "E_vertical_r2", "E_horizontal_r1", "E_horizontal_r2",
          "est_vertical_m_r1", "est_vertical_m_r2", "est_horizontal_m_r1", "est_horizontal_m_r2",
          "excluded_r1", "excluded_r2")
missing <- setdiff(need, names(d))
if (length(missing) > 0) {
  stop("This is not a HuSS comparison CSV; missing columns: ", paste(missing, collapse = ", "))
}

icc_for <- function(a, b, label) {
  x <- cbind(as.numeric(a), as.numeric(b))
  x <- x[stats::complete.cases(x), , drop = FALSE]
  if (nrow(x) < 2) {
    cat(sprintf("%-34s fewer than 2 drawings with values from both raters\n", label))
    return(invisible(NULL))
  }
  r <- irr::icc(x, model = "twoway", type = "agreement", unit = "single")
  cat(sprintf("%-34s ICC(2,1) = %.3f   95%% CI [%.3f, %.3f]   n = %d\n",
              label, r$value, r$lbound, r$ubound, r$subjects))
  invisible(r)
}

cat("HuSS rater agreement:", basename(file), "\n")
cat("Raters:", paste(unique(d$rater_r1), collapse = ", "), "(r1) and",
    paste(unique(d$rater_r2), collapse = ", "), "(r2);", nrow(d), "drawings scored by both\n\n")

icc_for(d$E_vertical_r1, d$E_vertical_r2, "E vertical (ceiling height)")
icc_for(d$E_horizontal_r1, d$E_horizontal_r2, "E horizontal (distance)")
icc_for(d$est_vertical_m_r1, d$est_vertical_m_r2, "Estimated ceiling height (m)")
icc_for(d$est_horizontal_m_r1, d$est_horizontal_m_r2, "Estimated distance (m)")

ex <- data.frame(r1 = as.integer(d$excluded_r1), r2 = as.integer(d$excluded_r2))
ex <- ex[stats::complete.cases(ex), , drop = FALSE]
same <- sum(ex$r1 == ex$r2)
if (nrow(ex) == 0) {
  cat("\nExclusion decisions: no drawings\n")
} else if (length(unique(c(ex$r1, ex$r2))) < 2) {
  cat(sprintf("\nExclusion decisions: both raters made the same decision on all %d drawings (kappa is not defined)\n", nrow(ex)))
} else {
  k <- irr::kappa2(ex, weight = "unweighted")
  cat(sprintf("\nExclusion decisions: Cohen's kappa = %.3f   z = %.2f   p = %.4f   agreement %d of %d\n",
              k$value, k$statistic, k$p.value, same, nrow(ex)))
}
