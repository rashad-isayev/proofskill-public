import { build } from "esbuild";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { readFileSync, existsSync, readdirSync } from "node:fs";
const base = process.cwd();
const bundle = await build({
  entryPoints: [resolve(base, "tests/b2b/harness/entry.tsx")],
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [
    {
      name: "test-next-stubs",
      setup(build) {
        build.onResolve({ filter: /^next\/(link|navigation)$/ }, (args) => ({
          path: resolve(
            base,
            "tests/b2b/harness/" +
              (args.path.endsWith("link") ? "link.tsx" : "navigation.ts"),
          ),
        }));
      },
    },
  ],
});
function cssFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? cssFiles(resolve(dir, e.name))
      : e.name.endsWith(".css")
        ? [resolve(dir, e.name)]
        : [],
  );
}
const styles = cssFiles(resolve(base, ".next/static"))
  .map((p) => readFileSync(p, "utf8"))
  .join("\n");
const server = createServer((req, res) => {
  if (req.url === "/bundle.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(bundle.outputFiles[0].text);
  } else if (req.url === "/styles.css") {
    res.setHeader("Content-Type", "text/css");
    res.end(styles);
  } else if (req.url?.startsWith("/api/")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: { message: "API fixtures were not configured for this test." },
      }),
    );
  } else {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>',
    );
  }
});
server.listen(3200, "127.0.0.1");
