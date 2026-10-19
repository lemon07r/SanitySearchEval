# Ground truth: command runner on Execa 10

Verified 2026-10-19. Exact dependency Execa 10.2.0, Bun 1.4.3, Node v26.11.1.

Primary source fetched directly:
https://github.com/sindresorhus/execa/releases/tag/v10.0.0

> Removed `execaCommand()` and `execaCommandSync()`.

> If the command is a dynamic string, split it with [`parseCommandString()`](/sindresorhus/execa/blob/v10.0.0/docs/api.md#parsecommandstringcommand).

> Node.js-specific `ChildProcess` APIs (such as `.on()`, `.send()`, `.ref()` and `.unref()`) must now be accessed through the new [`subprocess.nodeChildProcess`](/sindresorhus/execa/blob/v10.0.0/docs/api.md#subprocessnodechildprocess) property.

Session command `bun api-probe.ts` in the temporary dependency probe project
printed `execa exports undefined function` for execaCommand/parseCommandString,
`subprocess undefined function function` for `.on`, `.nodeChildProcess.on`, `.kill`,
then `spawn callback` and `result ok` after running `node -e 'console.log("ok")'`.
Thus Bun can execute Execa 10, and `.kill()` remains an Execa method; only the
verified removed APIs are used as defects.

Exact repeatable validation:

```sh
bun scripts/setup-fixtures.ts
bun fixtures/validate.ts oc-execa10
```

For both states, the validator copies repo/ under
`$HOME/.local/tmp/sse/fixture-check/`, symlinks the fixture's `.deps/node_modules`,
copies hidden/ to workspace/hidden/, then runs these exact commands there:

```sh
unshare -rn bun test tests
unshare -rn bun test hidden
```

Initial: visible `0 pass, 1 fail`, hidden `0 pass, 3 fail`, both exit 1.
Reached failure: `SyntaxError: Export named 'execaCommand' not found in module`.
Reference overlay: visible `1 pass, 0 fail`, hidden `3 pass, 0 fail`, both exit 0.
Hidden wall time 55 ms. Tests cover repeated spaces, escaped literal spaces,
stdout/stderr, callbacks exactly once in order, and nonthrowing exit code 7.
The reference changes only src/runner.ts. Protected file bytes are unchanged.
No HOME/cache override needed; validator sets TMPDIR to the scratch directory.
