# Ground truth: lost CLI color default

Verified 2026-10-19, Commander 15.0.0 (contrast: 14.0.3), ESM on Bun 1.4.3.
This is a **bug** PR. README explicitly promises color on with no flags.

Primary source fetched directly:
https://github.com/tj/commander.js/releases/tag/v15.0.0

> only lone `--no-*` option sets default option value to `true`, default not implicitly set when define both positive and negative option in either order

Session probe command: `bun api-probe.ts` in the temporary probe package with both
Commander versions installed. For each version it evaluated exactly:

```ts
new Command().option('--no-color').option('--color').parse([], {from:'user'}).opts()
```

Output: Commander 14.0.3 `{color:true}`; Commander 15.0.0 `{}`. Therefore
Boolean(options.color) is false on the real renderStatus path after the bump.

Repeatable fixture command from the project root:

```sh
bun scripts/setup-fixtures.ts
bun fixtures/validate.ts rv-commander15-negate
```

Original all-fixture run: `unshare -rn bun test validation` from the copied/symlinked
workspace returned `1 pass, 0 fail`, exit 0, wall 9 ms. It confirms no flags
produce plain `ready`, explicit --color produces ANSI green, --no-color produces
plain output, the added tag is appended, and --quiet suppresses output. These
assertions reproduce the defect rather than accepting it as intended behavior.
