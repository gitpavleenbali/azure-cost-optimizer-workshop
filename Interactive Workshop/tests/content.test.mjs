import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  content,
  workshopRoot,
  stepIds,
  validUnits,
} from "../server/content.mjs";

test("README sections, prompts, diagrams and tasks survive conversion", () => {
  const markdown = fs.readFileSync(
    path.join(workshopRoot, "README.md"),
    "utf8",
  );
  assert.equal(
    content.sections.length,
    [...markdown.matchAll(/^#{1,2} /gm)].length,
  );
  assert.equal(
    new Set(content.sections.map((section) => section.id)).size,
    content.sections.length,
  );
  assert.deepEqual(
    content.sections
      .filter((section) => section.step)
      .map((section) => section.step),
    Array.from({ length: 15 }, (_, index) => index + 1),
  );
  assert.equal(stepIds.length, 15);
  const combined = content.sections
    .map((section) => section.markdown)
    .join("\n");
  assert.equal(
    [...combined.matchAll(/```text/g)].length,
    [...markdown.matchAll(/```text/g)].length,
  );
  assert.equal([...combined.matchAll(/```mermaid/g)].length, 2);
  assert.equal(
    [...combined.matchAll(/!\[/g)].length,
    [...markdown.matchAll(/!\[/g)].length,
  );
  assert.equal(
    content.sections.flatMap((section) => section.tasks).length,
    [...markdown.matchAll(/^- \[ \]/gm)].length,
  );
  assert(validUnits.size > content.sections.length);
  assert(
    content.sections.some((section) =>
      section.markdown.includes(
        "Before Sprint 1: Arrange Foundry Model Access",
      ),
    ),
  );
});
