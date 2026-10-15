import test from "node:test";
import assert from "node:assert/strict";
import {
  findCompanies,
  visibleProfiles,
  companySections,
  summarizeActivity,
} from "../mockup/sharing-model.mjs";
test("company search tolerates typos, accents and pasted domains", () => {
  assert.equal(findCompanies("Siemns")[0].name, "Siemens");
  assert.equal(findCompanies("eth zurich")[0].name, "ETH Zürich");
  assert.equal(findCompanies("https://www.siemens.com")[0].name, "Siemens");
  assert.deepEqual(findCompanies("no such company xyz"), []);
});
test("previous companies are searchable without duplicate directory entries", () => {
  const recent = [
    { name: "My studio", domain: "" },
    { name: "Siemens", domain: "siemens.com" },
  ];
  assert.equal(findCompanies("my studo", recent)[0].name, "My studio");
  assert.equal(
    findCompanies("sie", recent).filter((company) => company.name === "Siemens")
      .length,
    1,
  );
});
test("the sender is always included; other CV owners must grant sharing themselves", () => {
  const profiles = [
    { id: "osman", shareWith: [] },
    { id: "diellza", shareWith: ["osman"] },
    { id: "drilona", shareWith: ["diellza"] },
  ];
  assert.deepEqual(
    visibleProfiles(profiles, "osman").map((p) => p.id),
    ["osman", "diellza"],
  );
  profiles[1].shareWith = [];
  assert.deepEqual(
    visibleProfiles(profiles, "osman").map((p) => p.id),
    ["osman"],
  );
});
test("company links include contact details, interests, documents and extras", () => {
  for (const section of ["contact", "interests", "documents", "extras"])
    assert.ok(companySections.includes(section));
});
test("link opens and actual clicks are counted separately", () => {
  assert.deepEqual(
    summarizeActivity([
      { type: "visit", at: "one" },
      { type: "cv", at: "two" },
      { type: "document", at: "three" },
      { type: "visit", at: "four" },
    ]),
    { opens: 2, lastOpened: "four", clicks: 2 },
  );
  assert.deepEqual(summarizeActivity([]), {
    opens: 0,
    lastOpened: null,
    clicks: 0,
  });
});
