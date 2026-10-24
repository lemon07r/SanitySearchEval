# Search API evaluation

Directional small-sample results; no blended score or claim of statistical superiority. Failures remain in every denominator. Costs distinguish estimates from returned dollars; unknown is not zero. Latencies include retries. No recommendation is inferred without completed evaluations.

## Retrieval

| Profile | url@1 / @3 / @5 | evidence@1 / @3 / @5 | evidence@5 Wilson 95% | read_ok | evidence_in_read | search p50/p90 ms | search+read p50/p90 ms | median visible tokens | USD/query est / metered | USD/evidenced query est / metered | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| exa:auto-objective-uncached | 22/24 (91.7%) / 24/24 (100.0%) / 24/24 (100.0%) | 23/24 (95.8%) / 23/24 (95.8%) / 24/24 (100.0%) | 86.2%–100.0% | 24/24 (100.0%) | 24/24 (100.0%) | 462.0 / 508.7 | 568.1 / 630.7 | 5682 | $0.00800 / $0.00800 | $0.00800 / $0.00800 | none |
| exa:auto-uncached | 22/24 (91.7%) / 24/24 (100.0%) / 24/24 (100.0%) | 23/24 (95.8%) / 23/24 (95.8%) / 24/24 (100.0%) | 86.2%–100.0% | 24/24 (100.0%) | 24/24 (100.0%) | 468.0 / 510.2 | 574.4 / 622.0 | 5693 | $0.00800 / $0.00800 | $0.00800 / $0.00800 | none |

### Retrieval by case slice

Each cell: evidence@1 / evidence@5 / evidence_in_read, out of the slice size.

| Profile | Revera-like (r-) | OpenCode-like (o-) | Traps |
| --- | --- | --- | --- |
| exa:auto-objective-uncached | 11 / 12 / 12 of 12 | 12 / 12 / 12 of 12 | 6 / 6 / 6 of 6 |
| exa:auto-uncached | 11 / 12 / 12 of 12 | 12 / 12 / 12 of 12 | 6 / 6 / 6 of 6 |

### Per-case paired evidence matrix

| Case | exa:auto-objective-uncached | exa:auto-uncached |
| --- | --- | --- |
| o-commander15-node-version | 1 | 1 |
| o-compose-watch-sync-restart | 1 | 1 |
| o-eslint10-eslintrc | 1 | 1 |
| o-github-api-version-default | 1 | 1 |
| o-go124-tool-directive | 1 | 1 |
| o-next16-proxy-runtime | 1 | 1 |
| o-node-require-async-module | 1 | 1 |
| o-pg18-uuidv7 | 1 | 1 |
| o-python315-tomllib-version | 1 | 1 |
| o-rust2024-set-var-unsafe | 1 | 1 |
| o-tailwind4-theme-colors | 1 | 1 |
| o-vitest5-sequential-removed | 1 | 1 |
| r-chalk6-force-color | 1 | 1 |
| r-go-loopvar-go121-module | 1 | 1 |
| r-got15-strict-content-length | 1 | 1 |
| r-got16-cross-origin-credentials | 1 | 1 |
| r-mise-untrusted-shell-args | 5 | 5 |
| r-pymongo-host-injection | 1 | 1 |
| r-python-utcnow-deprecated | 1 | 1 |
| r-python312-tarfile-default-filter | 1 | 1 |
| r-quart-debug-print-version | 1 | 1 |
| r-rustls-handshake-encryption-level | 1 | 1 |
| r-strawberry-async-permission | 1 | 1 |
| r-uv-wheel-windows | 1 | 1 |

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

## Limitations

Small, directional samples. Provider caches and changing documents can affect results. Model costs are list-price estimates, not proxy invoices. Unknown/failed calls are retained, and missing latencies are represented as zero elapsed only when no call was recorded. Clean-task findings are false positives under the frozen fixture truth; unmatched bug-task findings require manual adjudication. No reranker or embedding ablation is enabled. Absent cells mean not run, never a failure or success.
