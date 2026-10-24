# Search API evaluation

Directional small-sample results; no blended score or claim of statistical superiority. Failures remain in every denominator. Costs distinguish estimates from returned dollars; unknown is not zero. Latencies include retries. No recommendation is inferred without completed evaluations.

## Retrieval

| Profile | url@1 / @3 / @5 | evidence@1 / @3 / @5 | evidence@5 Wilson 95% | read_ok | evidence_in_read | search p50/p90 ms | search+read p50/p90 ms | median visible tokens | USD/query est / metered | USD/evidenced query est / metered | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

### Per-case paired evidence matrix

| Case |
| --- |

## Revera

| Arm | Bugs found / available | Reported FPs / clean PRs | Uncertain | Completion | Model calls | Tokens input/output/cache-read/cache-write | Model USD est | Search+read USD est / metered | Wall ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| exa:auto-objective | 2/2 | 0 / 2 | 0 | {"complete":4} | 13 | 34 / 4922 / 48924 / 38018 | $0.29845 | $0.02900 / $0.02900 | 147874 |
| firecrawl:developer | 2/2 | 0 / 2 | 1 | {"complete":4} | 18 | 44 / 6150 / 86334 / 57332 | $0.42710 | $0.01485 / unknown | 201922 |

### Revera task outcomes

| Task | Arm / rep | Bugs | FPs | Uncertain | Completion |
| --- | --- | --- | --- | --- | --- |
| rv-ky2-migrate | exa:auto-objective / 1 | 0/0 | 0 | 0 | complete |
| rv-got16-migrate | firecrawl:developer / 1 | 0/0 | 0 | 1 | complete |
| rv-got16-migrate | exa:auto-objective / 1 | 0/0 | 0 | 0 | complete |
| rv-got16-http2-agent | firecrawl:developer / 1 | 1/1 | 0 | 0 | complete |
| rv-got16-http2-agent | exa:auto-objective / 1 | 1/1 | 0 | 0 | complete |
| rv-commander15-negate | firecrawl:developer / 1 | 1/1 | 0 | 0 | complete |
| rv-ky2-migrate | firecrawl:developer / 1 | 0/0 | 0 | 0 | complete |
| rv-commander15-negate | exa:auto-objective / 1 | 1/1 | 0 | 0 | complete |

### Reported clean-task and unmatched bug-task findings

| Task | Arm | Kind | File:line | Title | Explanation | Confidence | Citations |
| --- | --- | --- | --- | --- | --- | --- | --- |

## OpenCode

| Arm | All-pass tasks | Violations | Timeouts | Tool calls | Model USD est | Search+read USD est / metered | Wall ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| exa:auto-objective | 0/4 | 0 | 0 | 56 | $0.54758 | $0.03600 / $0.03600 | 223555 |
| firecrawl:developer | 0/4 | 0 | 0 | 58 | $0.63728 | $0.01683 / unknown | 332452 |

### OpenCode task outcomes

| Task | Arm / rep | Hidden tests pass/total | All pass | Violations | Completion | Model calls | Tokens input/output/cache-read/cache-write | Wall ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| oc-ky2 | exa:auto-objective / 1 | 0/1 | false | none | complete | 7 | 16 / 2111 / 27374 / 11630 | 53219 |
| oc-ky2 | firecrawl:developer / 1 | 0/1 | false | none | complete | 9 | 20 / 2271 / 83235 / 21543 | 77531 |
| oc-ai7 | firecrawl:developer / 1 | 0/1 | false | none | complete | 10 | 22 / 2610 / 114071 / 29441 | 106785 |
| oc-ts7-config | exa:auto-objective / 1 | 0/4 | false | none | complete | 6 | 14 / 1602 / 26162 / 14791 | 55133 |
| oc-execa10 | exa:auto-objective / 1 | 0/3 | false | none | complete | 7 | 16 / 2201 / 29479 / 11683 | 54992 |
| oc-execa10 | firecrawl:developer / 1 | 0/3 | false | none | complete | 9 | 20 / 2423 / 75828 / 24280 | 105404 |
| oc-ts7-config | firecrawl:developer / 1 | 0/4 | false | none | complete | 6 | 14 / 1329 / 17909 / 5957 | 42732 |
| oc-ai7 | exa:auto-objective / 1 | 0/1 | false | none | complete | 10 | 22 / 2917 / 123517 / 27773 | 60211 |

## Limitations

Small, directional samples. Provider caches and changing documents can affect results. Model costs are list-price estimates, not proxy invoices. Unknown/failed calls are retained, and missing latencies are represented as zero elapsed only when no call was recorded. Clean-task findings are false positives under the frozen fixture truth; unmatched bug-task findings require manual adjudication. No reranker or embedding ablation is enabled. Absent cells mean not run, never a failure or success.
