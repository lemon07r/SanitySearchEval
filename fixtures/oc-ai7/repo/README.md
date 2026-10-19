# Catalog assistant

The AI SDK dependency has been updated. Restore the assistant's behavior and
TypeScript build by editing `src/` only. Keep the injected model and lookup
callback: tests must not call any provider.

`answerQuestion` must request the lookup tool on the first model step, let the model
choose on later steps, and stop at the caller's maxSteps (default 3). The lookup
tool must call the supplied catalog lookup and forward toolCallId and messages to
the optional audit callback. Return the final text and number of model steps.
Do not replace the SDK orchestration with a custom loop or alter dependencies.

Run `bun test tests`; the project must also pass `bun run typecheck`.
