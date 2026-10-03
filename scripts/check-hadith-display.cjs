const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { execFileSync } = require("node:child_process");
const { build } = require(process.env.ILM_ESBUILD_MODULE || "esbuild");
let chromium;
try { ({ chromium } = require(process.env.ILM_PLAYWRIGHT_MODULE || "playwright")); }
catch { throw new Error("Optional check requires Playwright. See scripts/hadith-display/README.md."); }

async function main() {
  const root = path.resolve(__dirname, "..");
  const output = process.env.ILM_HADITH_OUTPUT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), "ilm-hadith-display-"));
  fs.mkdirSync(output, { recursive: true });
  const sources = path.join(__dirname, "hadith-display/mock-sources.tsx");
  await build({
    entryPoints: [path.join(__dirname, "hadith-display/fixture.tsx")], bundle: true,
    outfile: path.join(output, "app.js"), platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "synthetic-hadith", setup(api) {
      api.onResolve({ filter: /^@\// }, args => {
        if (["@/contexts/LanguageContext", "@/app/(app)/home/actions"].includes(args.path)) return { path: sources };
        const base = path.join(root, "src", args.path.slice(2));
        return { path: [base, base + ".ts", base + ".tsx"].find(file => fs.existsSync(file)) };
      });
    } }],
  });
  execFileSync(process.execPath, [path.join(root, "node_modules/tailwindcss/lib/cli.js"), "-i", path.join(root, "src/app/globals.css"), "-o", path.join(output, "app.css"), "--config", path.join(root, "tailwind.config.ts")], { cwd: root, stdio: "inherit" });
  const html = '<!doctype html><html lang="en" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
  const server = http.createServer((request, response) => {
    const file = { "/app.js": "app.js", "/app.css": "app.css" }[new URL(request.url, "http://localhost").pathname];
    response.setHeader("Content-Type", file?.endsWith(".js") ? "text/javascript" : file ? "text/css" : "text/html");
    response.end(file ? fs.readFileSync(path.join(output, file)) : html);
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  let browser;
  const results = [], errors = [];
  try {
    const executablePath = process.env.ILM_CHROMIUM_BIN || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
    browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true, args: ["--no-sandbox"] });
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const width of [320, 390, 768, 1280]) {
      for (const scenario of ["translated", "missing-ar"]) {
        const page = await browser.newPage({ viewport: { width, height: 850 } });
        page.on("pageerror", error => errors.push(error.message));
        await page.route("**/*", route => route.request().url().startsWith(origin + "/") ? route.continue() : route.abort());
        await page.goto(origin + (scenario === "missing-ar" ? "/?missing-ar=1" : "/"));
        await page.locator("blockquote").waitFor();
        assert.equal(await page.locator("html").getAttribute("lang"), "en", "English is the default");
        for (const locale of scenario === "missing-ar" ? ["ar"] : ["en", "ar", "ha", "fr", "id", "ms"]) {
          await page.getByRole("button", { name: locale, exact: true }).click();
          await page.waitForFunction(expected => document.documentElement.lang === expected, locale);
          const result = await page.evaluate(locale => {
            const { payload } = window.__hadithFixture;
            const expected = payload.byLocale[locale] || payload.byLocale.en;
            const section = document.querySelector("section");
            const rect = section.getBoundingClientRect();
            return {
              locale, pageDirection: document.documentElement.dir, resolvedLocale: payload.byLocale[locale] ? locale : "en", width: innerWidth, fullBody: document.querySelector("blockquote").textContent === expected.text,
              fullAttribution: document.querySelector("cite").textContent === expected.attribution,
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              elements: ["blockquote", "cite"].map(tag => {
                const node = document.querySelector(tag), box = node.getBoundingClientRect();
                return { tag, clipped: node.scrollWidth > node.clientWidth + 1 || box.left < rect.left - 1 || box.right > rect.right + 1, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, lang: node.lang || document.documentElement.lang, dir: getComputedStyle(node).direction };
              }), reads: window.__hadithFixture.reads,
            };
          }, locale);
          result.scenario = scenario;
          results.push(result);
          if (width === 320 && ["en", "ar", "ms"].includes(locale)) await page.screenshot({ path: path.join(output, `${width}-${locale}-${scenario}.png`), fullPage: true });
        }
        await page.close();
      }
    }
    fs.writeFileSync(path.join(output, "results.json"), JSON.stringify({ results, errors }, null, 2));
    assert.deepEqual(errors, []);
    for (const result of results) {
      assert.ok(result.fullBody && result.fullAttribution, "All fixture text must remain present");
      assert.equal(result.reads, 1, "Changing locale must not refetch narration");
      assert.equal(result.pageDirection, result.locale === "ar" ? "rtl" : "ltr");
      assert.equal(result.overflow, false);
      for (const element of result.elements) {
        assert.equal(element.clipped, false, `${element.tag} clips synthetic text at ${result.width}px in ${result.locale}; evidence: ${output}`);
        assert.equal(element.lang, result.resolvedLocale);
        assert.equal(element.dir, result.resolvedLocale === "ar" ? "rtl" : "ltr");
      }
    }
    console.log(`Hadith display: ${results.length} full-text/wrapping/locale states passed; evidence ${output}`);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
