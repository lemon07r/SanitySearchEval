# Warehouse typecheck

This Bun application has been upgraded to TypeScript 7.0.2. Make its typecheck
pass by updating `tsconfig.json` only. Source, dependencies and tests must remain
unchanged. Preserve strict checking of all source files (including future files
under `src/`) and the `@app/*` import alias. Do not disable checking, weaken
individual strictness flags or suppress diagnostics. No JavaScript emit is needed.

Run `bun test tests` or `bun run typecheck`.
