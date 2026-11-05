import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
const directory = resolve(process.cwd(), "src/messages");
const files = readdirSync(directory).filter((file) => file.endsWith(".json"));
const banned =
  /(guaranteed|certainly|will definitely|risk-free|100% accurate|fraud|fraudulent)/i;
function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([key, entry]) =>
      strings(entry, `${path}.${key}`),
    );
  return [];
}
test("both locales exist and have identical message keys", () => {
  expect(files).toEqual(expect.arrayContaining(["en.json", "zh-HK.json"]));
  const keys = files.map((file) =>
    strings(JSON.parse(readFileSync(resolve(directory, file), "utf8")))
      .map(([key]) => key)
      .sort(),
  );
  for (const localeKeys of keys) expect(localeKeys).toEqual(keys[0]);
});
for (const file of files)
  test(`${file} contains no banned user-facing words`, () => {
    for (const [key, value] of strings(
      JSON.parse(readFileSync(resolve(directory, file), "utf8")),
    ))
      expect(value, `${file}${key}`).not.toMatch(banned);
  });
