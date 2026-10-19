## Manual adjudication (2026-10-19)

Confirmation reps: Exa, Firecrawl and `none` on the four discriminating tasks, two
extra reps each. See `PROTOCOL.md` (Amendments) for how they were selected. The
strict tables above are not changed by this section.

- `rv-got16-migrate` / Firecrawl rep 2 (strict FP) and Exa rep 2 (uncertain, low):
  both raise the same `agent: {http2: false}` pooling point adjudicated in
  `results/2026-10-19T08-07-51-071Z-eval/ADJUDICATION.md`. It is a defensible
  non-blocking comment, not a hallucination.
- `rv-got16-http2-agent` / Firecrawl rep 1 (unmatched): the leftover
  `request: http2wrapper.auto` override. It is a valid secondary observation.
- `rv-got16-http2-agent` / `none` reps 1 and 2 (uncertain, low): the arm
  correctly suspected Got 16 might reject the HTTP/2 options, but had no source to
  confirm it. Not counted as finding the bug.
- `rv-commander15-negate` / `none` rep 1 (uncertain): no color-default bug was
  identified. In the quick pass, the no-search arm said outright that colors stay on
  by default, which is wrong under Commander 15.

Stability across the quick pass plus these reps (3 runs per arm per task):

| Task | exa:auto | firecrawl:search | none |
| --- | --- | --- | --- |
| rv-commander15-negate (bug found) | 3/3 | 3/3 | 0/3 |
| rv-got16-http2-agent (bug found) | 3/3 | 3/3 | 0/3 |
| rv-got16-migrate (strict FP / uncertain) | 0 FP, 1 uncertain | 1 FP, 1 uncertain | 0 / 0 |
| oc-ai7 (all hidden tests pass) | 2/3 | 1/3 | 2/3 |