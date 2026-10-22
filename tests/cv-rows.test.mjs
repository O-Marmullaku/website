import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRows, rowText, moveRow } from "../profile/cv-rows.mjs";
const makeId = () => crypto.randomUUID();
test("existing paragraphs migrate into editable rows without losing their text", () => {
  const rows = normalizeRows(
    null,
    {
      experience: "Developer\nCompany\n\nBuilt a tool",
      skills: "JavaScript\nPython",
    },
    makeId,
  );
  assert.equal(rows.experience[0].title, "Developer");
  assert.equal(rows.experience[0].detail, "Company");
  assert.equal(rows.experience[0].body, "\nBuilt a tool");
  assert.equal(rows.skills.length, 2);
  assert.ok(rowText(rows.experience).includes("Built a tool"));
});
test("saved empty sections stay empty and row identity survives reload", () => {
  const id = makeId();
  const rows = normalizeRows(
    { experience: [{ id, title: "One" }], skills: [] },
    { skills: "Old content" },
    makeId,
  );
  assert.equal(rows.experience[0].id, id);
  assert.deepEqual(rows.skills, []);
  assert.equal(normalizeRows(rows, {}, makeId).experience[0].id, id);
});
test("invalid row data cannot introduce remote images or duplicate attachment identities", () => {
  const id = makeId(),
    rows = normalizeRows(
      {
        experience: [
          { id, logo: "https://tracking.example/img", level: 99 },
          { id, title: 4 },
        ],
      },
      {},
      makeId,
    );
  assert.equal(rows.experience[0].logo, "");
  assert.equal(rows.experience[0].level, 5);
  assert.notEqual(rows.experience[1].id, id);
  assert.equal(rows.experience[1].title, "");
});
test("reordering keeps row data and attached identities together and respects boundaries", () => {
  const rows = [
    { id: "a", title: "A" },
    { id: "b", title: "B" },
  ];
  assert.deepEqual(moveRow(rows, "b", -1), [rows[1], rows[0]]);
  assert.equal(moveRow(rows, "a", -1), rows);
  assert.equal(moveRow(rows, "missing", 1), rows);
  assert.deepEqual(
    rows.map((row) => row.id),
    ["a", "b"],
  );
});
