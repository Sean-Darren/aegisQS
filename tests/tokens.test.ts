import { readFileSync } from "node:fs";
import { test, expect } from "vitest";
test("every DESIGN section 3 token has its prescribed value", () => {
  const design = readFileSync("DESIGN.md", "utf8")
    .split("```css\n")[1]
    .split("```")[0];
  const actual = readFileSync("src/app/globals.css", "utf8");
  function declarations(css: string) {
    return new Map(
      [...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [
        match[1],
        match[2].replace(/\s/g, "").toLowerCase(),
      ]),
    );
  }
  const tokens = declarations(actual);
  for (const [name, value] of declarations(design))
    expect(tokens.get(name), name).toBe(value);
});
