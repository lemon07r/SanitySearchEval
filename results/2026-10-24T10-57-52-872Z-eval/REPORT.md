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

### Revera task outcomes

| Task | Arm / rep | Bugs | FPs | Uncertain | Completion |
| --- | --- | --- | --- | --- | --- |

### Reported clean-task and unmatched bug-task findings

| Task | Arm | Kind | File:line | Title | Explanation | Confidence | Citations |
| --- | --- | --- | --- | --- | --- | --- | --- |

## OpenCode

| Arm | All-pass tasks | Violations | Timeouts | Tool calls | Model USD est | Search+read USD est / metered | Wall ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| exa:auto-objective | 3/4 | 0 | 0 | 51 | $0.42120 | $0.02400 / $0.02400 | 236297 |
| firecrawl:developer | 4/4 | 0 | 0 | 53 | $0.40805 | $0.00990 / unknown | 240184 |

### OpenCode task outcomes

| Task | Arm / rep | Hidden tests pass/total | All pass | Violations | Completion | Model calls | Tokens input/output/cache-read/cache-write | Wall ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| oc-ky2 | firecrawl:developer / 1 | 4/4 | true | none | complete | 7 | 16 / 2003 / 44142 / 19308 | 57142 |
| oc-ky2 | exa:auto-objective / 1 | 4/4 | true | none | complete | 7 | 18 / 2379 / 56235 / 20949 | 57800 |
| oc-ai7 | exa:auto-objective / 1 | 3/4 | false | none | complete | 7 | 16 / 2221 / 47763 / 18184 | 64800 |
| oc-ai7 | firecrawl:developer / 1 | 4/4 | true | none | complete | 9 | 20 / 2393 / 41729 / 8790 | 76287 |
| oc-ts7-config | firecrawl:developer / 1 | 4/4 | true | none | complete | 5 | 12 / 1219 / 13048 / 1282 | 39884 |
| oc-ts7-config | exa:auto-objective / 1 | 4/4 | true | none | complete | 5 | 12 / 879 / 12207 / 2163 | 41066 |
| oc-execa10 | firecrawl:developer / 1 | 3/3 | true | none | complete | 7 | 16 / 1964 / 38812 / 16353 | 66871 |
| oc-execa10 | exa:auto-objective / 1 | 3/3 | true | none | complete | 7 | 16 / 2064 / 28860 / 6919 | 72631 |

## Limitations

Small, directional samples. Provider caches and changing documents can affect results. Model costs are list-price estimates, not proxy invoices. Unknown/failed calls are retained, and missing latencies are represented as zero elapsed only when no call was recorded. Clean-task findings are false positives under the frozen fixture truth; unmatched bug-task findings require manual adjudication. No reranker or embedding ablation is enabled. Absent cells mean not run, never a failure or success.
