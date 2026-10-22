import test from "node:test";
import assert from "node:assert/strict";
import { validatePDF } from "../profile/pdf-store.mjs";

test("accepts PDF bytes independently of the filename and browser MIME label", async () => {
  await validatePDF(
    new File(["%PDF-1.7\nfixture"], "reference.pdf", { type: "" }),
  );
});
test("rejects renamed HTML and empty files before storing or displaying them", async () => {
  await assert.rejects(
    validatePDF(
      new File(["<html>not a PDF</html>"], "reference.pdf", {
        type: "application/pdf",
      }),
    ),
    /not a PDF/,
  );
  await assert.rejects(
    validatePDF(new File([], "reference.pdf")),
    /Choose a PDF/,
  );
});
test("refuses oversized documents before reading their contents", async () => {
  await assert.rejects(
    validatePDF({
      size: 10 * 1024 * 1024 + 1,
      slice() {
        throw Error("Must not read");
      },
    }),
    /smaller than 10 MB/,
  );
});
