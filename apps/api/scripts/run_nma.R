# Deterministic network meta-analysis via R netmeta. Fail closed if R/netmeta missing.
# Usage: Rscript run_nma.R <workspace_dir>
# Reads nma_input.json; writes nma_result.json + network.svg

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 1) {
  stop("Usage: Rscript run_nma.R <workspace_dir>")
}
workspace <- args[[1]]
input_path <- file.path(workspace, "nma_input.json")
result_path <- file.path(workspace, "nma_result.json")
svg_path <- file.path(workspace, "network.svg")

`%||%` <- function(a, b) if (!is.null(a) && length(a) > 0 && !(length(a) == 1 && is.na(a))) a else b

if (!requireNamespace("jsonlite", quietly = TRUE)) {
  stop("R package 'jsonlite' is required. Install with install.packages('jsonlite')")
}
if (!requireNamespace("netmeta", quietly = TRUE)) {
  stop("R package 'netmeta' is required. Install with install.packages('netmeta')")
}

library(jsonlite)
library(netmeta)

payload <- fromJSON(input_path, simplifyDataFrame = TRUE)
rows <- payload$rows
df <- as.data.frame(rows, stringsAsFactors = FALSE)
if (is.null(df) || nrow(df) < 2) {
  stop("Network meta-analysis needs at least 2 computable effect rows with arm labels")
}

needed <- c("studlab", "treat1", "treat2", "TE", "seTE")
missing <- setdiff(needed, names(df))
if (length(missing) > 0) {
  stop(paste("Missing NMA columns:", paste(missing, collapse = ", ")))
}

df$TE <- as.numeric(df$TE)
df$seTE <- as.numeric(df$seTE)
df$treat1 <- as.character(df$treat1)
df$treat2 <- as.character(df$treat2)
df$studlab <- as.character(df$studlab)
df <- df[is.finite(df$TE) & is.finite(df$seTE) & df$seTE > 0 & nzchar(df$treat1) & nzchar(df$treat2), , drop = FALSE]
if (nrow(df) < 2) stop("Fewer than 2 valid contrasts after filtering")

arms <- unique(c(df$treat1, df$treat2))
if (length(arms) < 3) {
  stop(paste0(
    "Network meta-analysis needs >= 3 distinct arms across studies (found ",
    length(arms), ": ", paste(arms, collapse = ", "),
    "). Set armT/armC on effect rows to form a network."
  ))
}

sm <- as.character(payload$measure %||% "OR")
if (!(sm %in% c("OR", "RR", "MD", "SMD", "HR"))) sm <- "OR"
common <- isTRUE(identical(as.character(payload$model %||% "random"), "fixed"))

nma <- netmeta(
  TE = df$TE,
  seTE = df$seTE,
  treat1 = df$treat1,
  treat2 = df$treat2,
  studlab = df$studlab,
  sm = sm,
  common = common,
  random = !common,
  reference.group = arms[[1]]
)

tryCatch({
  svg(svg_path, width = 8, height = 6)
  netgraph(nma, plastic = FALSE, thickness = "number.of.studies", multiarm = FALSE)
  dev.off()
}, error = function(e) {
  writeLines(
    c(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">',
      '<rect width="100%" height="100%" fill="#fbfcfb"/>',
      '<text x="24" y="40" font-family="sans-serif" font-size="14">Network plot unavailable</text>',
      paste0('<text x="24" y="70" font-family="sans-serif" font-size="12">', gsub("<", "", e$message), '</text>'),
      '</svg>'
    ),
    svg_path
  )
})

league_mat <- if (!common) nma$TE.random else nma$TE.common
league_lower <- if (!common) nma$lower.random else nma$lower.common
league_upper <- if (!common) nma$upper.random else nma$upper.common
trts <- nma$trts

league <- list()
for (i in seq_along(trts)) {
  for (j in seq_along(trts)) {
    if (i == j) next
    te <- league_mat[i, j]
    if (!is.finite(te)) next
    league[[length(league) + 1]] <- list(
      treat1 = trts[[i]],
      treat2 = trts[[j]],
      te = te,
      lower = league_lower[i, j],
      upper = league_upper[i, j]
    )
  }
}

q_val <- tryCatch(unname(nma$Q), error = function(e) NA_real_)
df_q <- tryCatch(unname(nma$df.Q), error = function(e) NA_real_)
p_q <- tryCatch(unname(nma$pval.Q), error = function(e) NA_real_)
i2_val <- tryCatch(unname(nma$I2), error = function(e) NA_real_)
tau_val <- tryCatch(unname(nma$tau), error = function(e) NA_real_)

result <- list(
  schema = "qiuzheng.meta.nma.v1",
  engine = "netmeta",
  measure = sm,
  model = if (common) "fixed" else "random",
  k = nrow(df),
  nArms = length(trts),
  arms = as.character(trts),
  reference = arms[[1]],
  consistency = list(
    Q = q_val,
    df = df_q,
    pvalue = p_q,
    I2 = i2_val,
    tau = tau_val
  ),
  league = league,
  summary = list(
    model = if (common) "fixed" else "random",
    measure = sm,
    k = nrow(df),
    yi = 0,
    sei = 0,
    ciLow = 0,
    ciHigh = 0,
    yiDisplay = NULL,
    ciLowDisplay = NULL,
    ciHighDisplay = NULL,
    q = if (is.finite(q_val)) q_val else 0,
    i2 = if (is.finite(i2_val)) i2_val * 100 else 0,
    tau2 = if (is.finite(tau_val)) tau_val^2 else 0,
    pQ = if (is.finite(p_q)) p_q else NULL,
    totalN = NULL
  )
)

write_json(result, result_path, auto_unbox = TRUE, pretty = TRUE, null = "null")
