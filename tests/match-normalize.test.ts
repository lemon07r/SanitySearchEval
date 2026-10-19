import { test, expect } from "bun:test";
import { matchesGroups } from "../src/score";
test("markdown formatting does not block evidence patterns", () => {
  expect(matchesGroups("The edge runtime is **NOT** supported in `proxy`.", [["edge runtime is not supported"]])).toBe(true);
  expect(matchesGroups("std::env::set\\_var is now `unsafe`", [["set_var", "unsafe"]])).toBe(true);
  expect(matchesGroups("use `/*splat` instead of `/*`", [["\\*splat"]])).toBe(true);
  expect(matchesGroups("unrelated text", [["set_var"]])).toBe(false);
});
