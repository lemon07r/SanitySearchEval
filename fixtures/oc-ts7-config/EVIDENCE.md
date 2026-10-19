# Ground truth: removed TypeScript configuration options

Verified 2026-10-19, installed TypeScript **7.0.2** (`tsc --version`), Bun 1.4.3,
Node v26.11.1. This task needs config edits, not source edits.

Primary sources fetched directly:

https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/

> TypeScript 7.0 adopts 6.0’s new defaults, and provides hard errors in the face of any flags and constructs deprecated in TypeScript 6.0.

> `target: es5` is no longer supported.

> `moduleResolution: node/node10` are no longer supported, with `nodenext` and `bundler` being recommended instead.

https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html

> Developers who used `baseUrl` as a prefix for path-mapping entries can simply remove `baseUrl` and add the prefix to their `paths` entries:

https://github.com/microsoft/TypeScript/releases/tag/v7.0.2 links the official 7.0
announcement and the original typescript-go release. Ground truth uses installed
compiler diagnostics, not assumptions from those earlier deprecations.

Exact commands:

```sh
bun scripts/setup-fixtures.ts
bun fixtures/validate.ts oc-ts7-config
```

Copied workspaces under `$HOME/.local/tmp/sse/fixture-check/` use the required
external node_modules symlink; hidden tests are copied to workspace/hidden/.
For both initial and reference states, from the workspace root:

```sh
unshare -rn bun test tests
unshare -rn bun test hidden
```

Tests spawn the project's installed compiler through
`node <workspace>/node_modules/typescript/bin/tsc --noEmit --pretty false`.
Initial visible `0 pass, 1 fail`; hidden `1 pass, 3 fail`; both exit 1. Reached:

```text
tsconfig.json(3,15): error TS5108: Option 'target=ES5' has been removed. Please remove it from your configuration.
tsconfig.json(5,25): error TS5108: Option 'moduleResolution=node10' has been removed. Please remove it from your configuration.
tsconfig.json(6,5): error TS5102: Option 'baseUrl' has been removed. Please remove it from your configuration.
tsconfig.json(7,26): error TS5090: Non-relative paths are not allowed. Did you forget a leading './'?
```

Reference: visible `1 pass, 0 fail`, hidden `4 pass, 0 fail`; both exit 0. Hidden
wall 522 ms including five compiler invocations. New temporary src files exercise
valid alias imports, a deliberate string-in-number-field error (TS2322), implicit
any (TS7006) and nullability (TS2322). The hidden tests demand those specific
diagnostics on the new file, so excluding new source, noCheck, weakening strictness,
or making the alias resolve to any cannot silently pass. They inspect effective
--showConfig settings, not just the text of tsconfig. skipLibCheck cannot suppress
source errors. Reference changes only tsconfig.json; protected bytes are unchanged.
No HOME/cache override needed; TMPDIR is scratch. No network is used by tsc.
