# Search API evaluation

Directional small-sample results; no blended score or claim of statistical superiority. Failures remain in every denominator. Costs distinguish estimates from returned dollars; unknown is not zero. Latencies include retries. No recommendation is inferred without completed evaluations.

## BLOCKED profiles (not evaluated)

These arms were not called and are excluded from outcome denominators, not scored as failures or losers.

| Profile | Status | Reason | Skipped units |
| --- | --- | --- | --- |
| brave:llm-context | BLOCKED | OPTION_NOT_IN_PLAN: the key's Brave plan ('Free AI') does not include LLM Context (checked 2026-10-19) | not scheduled |

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

### OpenCode task outcomes

| Task | Arm / rep | Hidden tests pass/total | All pass | Violations | Completion | Model calls | Tokens input/output/cache-read/cache-write | Wall ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Limitations

Small, directional samples. Provider caches and changing documents can affect results. Model costs are list-price estimates, not proxy invoices. Unknown/failed calls are retained, and missing latencies are represented as zero elapsed only when no call was recorded. Clean-task findings are false positives under the frozen fixture truth; unmatched bug-task findings require manual adjudication. No reranker or embedding ablation is enabled. Absent cells mean not run, never a failure or success.
