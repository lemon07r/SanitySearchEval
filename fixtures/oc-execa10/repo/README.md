# Release command runner

`runCommand(command, callbacks)` executes a command string without a shell and
returns stdout, stderr, exitCode and failed. Commands use Execa's command-string
syntax: spaces separate arguments and a backslash escapes a literal space; shell
quoting and shell operators are not supported. Leading/trailing spaces are allowed.
The optional onSpawn/onExit callbacks must run once for a successfully spawned
process, in that order, before the promise resolves. Nonzero exits return a failed
result rather than throwing. Preserve stderr and exit status.

The dependency update is already installed. Fix `src/` without changing dependencies
or tests. Run `bun test tests`.
