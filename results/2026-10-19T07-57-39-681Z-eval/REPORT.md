# Search API evaluation

Directional small-sample results; no blended score or claim of statistical superiority. Failures remain in every denominator. Costs distinguish estimates from returned dollars; unknown is not zero. Latencies include retries. No recommendation is inferred without completed evaluations.

## Retrieval

| Profile | url@1 / @3 / @5 | evidence@1 / @3 / @5 | evidence@5 Wilson 95% | read_ok | evidence_in_read | search p50/p90 ms | search+read p50/p90 ms | median visible tokens | USD/query est / metered | USD/evidenced query est / metered | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| brave:web | 8/24 (33.3%) / 13/24 (54.2%) / 15/24 (62.5%) | 14/24 (58.3%) / 19/24 (79.2%) / 21/24 (87.5%) | 69.0%–95.7% | 22/24 (91.7%) | 20/24 (83.3%) | 516.5 / 559.1 | 806.0 / 1586.1 | 4211 | $0.00500 / unknown | $0.00571 / unknown | blocked:1, http_4xx:1 |
| exa:auto | 22/24 (91.7%) / 24/24 (100.0%) / 24/24 (100.0%) | 23/24 (95.8%) / 23/24 (95.8%) / 24/24 (100.0%) | 86.2%–100.0% | 24/24 (100.0%) | 24/24 (100.0%) | 4456.1 / 6185.0 | 4595.2 / 6298.6 | 5683 | $0.00800 / $0.00800 | $0.00800 / $0.00800 | none |
| firecrawl:search | 13/24 (54.2%) / 18/24 (75.0%) / 20/24 (83.3%) | 12/24 (50.0%) / 15/24 (62.5%) / 16/24 (66.7%) | 46.7%–82.0% | 24/24 (100.0%) | 17/24 (70.8%) | 942.2 / 1762.8 | 2383.5 / 5762.8 | 3761 | $0.00297 / unknown | $0.00445 / unknown | none |
| parallel:fast | 11/24 (45.8%) / 15/24 (62.5%) / 21/24 (87.5%) | 20/24 (83.3%) / 24/24 (100.0%) / 24/24 (100.0%) | 86.2%–100.0% | 24/24 (100.0%) | 19/24 (79.2%) | 531.3 / 624.2 | 1302.5 / 1518.5 | 5649 | $0.00200 / unknown | $0.00200 / unknown | none |
| tavily:advanced | 8/24 (33.3%) / 19/24 (79.2%) / 20/24 (83.3%) | 21/24 (87.5%) / 22/24 (91.7%) / 22/24 (91.7%) | 74.2%–97.7% | 24/24 (100.0%) | 21/24 (87.5%) | 3383.0 / 5475.7 | 3763.0 / 5864.7 | 4980 | $0.01767 / unknown | $0.01927 / unknown | none |

### Retrieval by case slice

Each cell: evidence@1 / evidence@5 / evidence_in_read, out of the slice size.

| Profile | Revera-like (r-) | OpenCode-like (o-) | Traps |
| --- | --- | --- | --- |
| brave:web | 6 / 9 / 11 of 12 | 8 / 12 / 9 of 12 | 3 / 4 / 5 of 6 |
| exa:auto | 11 / 12 / 12 of 12 | 12 / 12 / 12 of 12 | 6 / 6 / 6 of 6 |
| firecrawl:search | 4 / 5 / 9 of 12 | 8 / 11 / 8 of 12 | 2 / 3 / 5 of 6 |
| parallel:fast | 8 / 12 / 8 of 12 | 12 / 12 / 11 of 12 | 5 / 6 / 5 of 6 |
| tavily:advanced | 9 / 10 / 10 of 12 | 12 / 12 / 11 of 12 | 6 / 6 / 6 of 6 |

### Per-case paired evidence matrix

| Case | brave:web | exa:auto | firecrawl:search | parallel:fast | tavily:advanced |
| --- | --- | --- | --- | --- | --- |
| o-commander15-node-version | 1 | 1 | 1 | 1 | 1 |
| o-compose-watch-sync-restart | 1 | 1 | 1 | 1 | 1 |
| o-eslint10-eslintrc | 4 | 1 | ✗ | 1 | 1 |
| o-github-api-version-default | 1 | 1 | 1 | 1 | 1 |
| o-go124-tool-directive | 1 | 1 | 2 | 1 | 1 |
| o-next16-proxy-runtime | 2 | 1 | 4 | 1 | 1 |
| o-node-require-async-module | ERR | 1 | 3 | 1 | 1 |
| o-pg18-uuidv7 | 1 | 1 | 1 | 1 | 1 |
| o-python315-tomllib-version | 1 | 1 | 1 | 1 | 1 |
| o-rust2024-set-var-unsafe | 1 | 1 | 1 | 1 | 1 |
| o-tailwind4-theme-colors | 1 | 1 | 1 | 1 | 1 |
| o-vitest5-sequential-removed | 2 | 1 | 1 | 1 | 1 |
| r-chalk6-force-color | ERR | 1 | 2 | 2 | 1 |
| r-go-loopvar-go121-module | 1 | 1 | ✗ | 1 | 1 |
| r-got15-strict-content-length | 1 | 1 | ✗ | 3 | ✗ |
| r-got16-cross-origin-credentials | 1 | 1 | ✗ | 2 | ✗ |
| r-mise-untrusted-shell-args | ✗ | 4 | ✗ | 1 | 1 |
| r-pymongo-host-injection | 3 | 1 | ✗ | 1 | 2 |
| r-python-utcnow-deprecated | 1 | 1 | 1 | 1 | 1 |
| r-python312-tarfile-default-filter | 1 | 1 | 1 | 1 | 1 |
| r-quart-debug-print-version | ✗ | 1 | ✗ | 1 | 1 |
| r-rustls-handshake-encryption-level | 5 | 1 | 1 | 1 | 1 |
| r-strawberry-async-permission | 1 | 1 | 1 | 1 | 1 |
| r-uv-wheel-windows | ✗ | 1 | ✗ | 3 | 1 |

## Revera

| Arm | Bugs found / available | Reported FPs / clean PRs | Uncertain | Completion | Model calls | Tokens input/output/cache-read/cache-write | Model USD est | Search+read USD est / metered | Wall ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

### Revera task outcomes

| Task | Arm / rep | Bugs | FPs | Uncertain | Completion |
| --- | --- | --- | --- | --- | --- |

### Reported clean-task and unmatched bug-task findings

| Task | Arm | Kind | File:line | Title | Explanation | Confidence | Citations |
| --- | --- | --- | --- | --- | --- | --- | --- |

## OpenCode

| Arm | All-pass tasks | Violations | Timeouts | Tool calls | Model USD est | Search+read USD est / metered | Wall ms |
| --- | --- | --- | --- | --- | --- | --- | --- |

### OpenCode task outcomes

| Task | Arm / rep | Hidden tests pass/total | All pass | Violations | Completion | Model calls | Tokens input/output/cache-read/cache-write | Wall ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Optional blinded judge (does not override scores)

| Profile | Judgments | Supported | Contradicted | Insufficient | Errors |
| --- | --- | --- | --- | --- | --- |
| brave:web | 24 | 24 | 0 | 0 | 0 |
| exa:auto | 24 | 24 | 0 | 0 | 0 |
| firecrawl:search | 24 | 21 | 0 | 3 | 0 |
| parallel:fast | 24 | 24 | 0 | 0 | 0 |
| tavily:advanced | 24 | 22 | 0 | 2 | 0 |

Judgments require manual spot-checking; no independent verifier was run automatically.

## Limitations

Small, directional samples. Provider caches and changing documents can affect results. Model costs are list-price estimates, not proxy invoices. Unknown/failed calls are retained, and missing latencies are represented as zero elapsed only when no call was recorded. Clean-task findings are false positives under the frozen fixture truth; unmatched bug-task findings require manual adjudication. No reranker or embedding ablation is enabled. Absent cells mean not run, never a failure or success.
