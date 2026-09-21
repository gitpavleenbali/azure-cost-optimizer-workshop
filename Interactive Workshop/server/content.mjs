import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";

export const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const workshopRoot = path.resolve(appRoot, "..");
const plain = (node) => node.value ?? (node.children ?? []).map(plain).join("");
export const slug = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

export function loadContent(root = workshopRoot) {
  const markdown = fs.readFileSync(path.join(root, "README.md"), "utf8");
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const headings = tree.children.filter(
    (node) => node.type === "heading" && node.depth <= 2,
  );
  let group = "tour";
  const sections = headings.map((heading, index) => {
    const title = plain(heading);
    if (title.startsWith("Part 2:")) group = "prepare";
    if (title.startsWith("Sprint 1:")) group = "sprint1";
    if (title.startsWith("Break And")) group = "sprint1";
    if (title.startsWith("Sprint 2:")) group = "sprint2";
    if (title.startsWith("Bonus:")) group = "bonus";
    const end = headings[index + 1]?.position.start.offset ?? markdown.length;
    const body = markdown.slice(heading.position.end.offset, end).trim();
    const id = slug(title);
    const tasks = [];
    const localTree = unified().use(remarkParse).use(remarkGfm).parse(body);
    const visit = (node) => {
      if (node.type === "listItem" && typeof node.checked === "boolean") {
        const label = plain(node).trim();
        tasks.push({ id: `${id}:${digest(label).slice(0, 12)}`, label });
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(localTree);
    const step = /^Step (\d+):/.exec(title);
    return {
      id,
      title,
      group,
      markdown: body,
      step: step ? Number(step[1]) : null,
      tasks,
      minutes: Math.max(1, Math.round(body.split(/\s+/).length / 200)),
    };
  });
  const readmeHash = digest(markdown);
  return {
    title: "Azure Cost Optimizer Workshop",
    revision: readmeHash.slice(0, 12),
    readmeHash,
    sections,
  };
}

export const content = loadContent();
export const validUnits = new Set(
  content.sections.flatMap((section) => [
    section.id,
    ...section.tasks.map((task) => task.id),
  ]),
);
export const stepIds = content.sections
  .filter((section) => section.step)
  .map((section) => section.id);
