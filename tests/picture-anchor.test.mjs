import test from "node:test";
import assert from "node:assert/strict";
import { resolveQuote } from "../profile/picture-anchor.mjs";

test("an attached phrase survives an insertion before it", () => {
  assert.equal(
    resolveQuote("New introduction. Built the booking system.", {
      quote: "booking system",
      before: "Built the ",
      after: ".",
    }),
    28,
  );
});
test("context identifies the intended occurrence of a repeated phrase", () => {
  const text = "First project: design. Second project: design.";
  assert.equal(
    resolveQuote(text, {
      quote: "design",
      before: "Second project: ",
      after: ".",
    }),
    text.lastIndexOf("design"),
  );
});
test("removed and ambiguous text falls back to its section instead of guessing", () => {
  assert.equal(
    resolveQuote("The description has changed.", { quote: "booking system" }),
    -1,
  );
  assert.equal(resolveQuote("design and design", { quote: "design" }), -1);
});
