// Tooling-only loader: reuse repository TypeScript/JSON modules without new dependencies.
import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import ts from "typescript";
const root = resolve(import.meta.dirname, "..");
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only")
      return { url: "data:text/javascript,export {};", shortCircuit: true };
    let path;
    if (specifier.startsWith("@/"))
      path = resolve(root, "src", specifier.slice(2));
    else if (specifier === "@schemas")
      path = resolve(root, "src/schemas/index.ts");
    else if (
      specifier.startsWith(".") &&
      context.parentURL?.startsWith("file:")
    )
      path = resolve(dirname(fileURLToPath(context.parentURL)), specifier);
    if (path) {
      for (const candidate of [path, path + ".ts", path + "/index.ts"])
        if (existsSync(candidate) && /\.(ts|json)$/.test(candidate))
          return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (
      url.startsWith(pathToFileURL(root).href) &&
      url.endsWith(".ts") &&
      !url.includes("/node_modules/")
    )
      return {
        format: "module",
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
          },
        }).outputText,
        shortCircuit: true,
      };
    if (
      url.startsWith(pathToFileURL(root).href) &&
      url.endsWith(".json") &&
      !url.includes("/node_modules/")
    )
      return {
        format: "module",
        source: "export default " + readFileSync(new URL(url), "utf8") + ";",
        shortCircuit: true,
      };
    return next(url, context);
  },
});
