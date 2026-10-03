# Synthetic daily hadith display check

Run `node scripts/check-hadith-display.cjs` from the repository root. This optional check needs esbuild, Playwright, and Chromium. It detects `/usr/bin/chromium` when present, otherwise uses Playwright's installed browser. `ILM_PLAYWRIGHT_MODULE`, `ILM_ESBUILD_MODULE`, and `ILM_CHROMIUM_BIN` can select separate installations. `ILM_HADITH_OUTPUT_DIR` selects an evidence directory; the default is a unique directory under the system temp directory.

To install optional tools without changing repository dependencies:

```sh
npm install --prefix /tmp/ilm-hadith-tools playwright esbuild
/tmp/ilm-hadith-tools/node_modules/.bin/playwright install chromium
ILM_PLAYWRIGHT_MODULE=/tmp/ilm-hadith-tools/node_modules/playwright \
ILM_ESBUILD_MODULE=/tmp/ilm-hadith-tools/node_modules/esbuild \
node scripts/check-hadith-display.cjs
```

The actual DailyHadith component, narration parser, and Tailwind stylesheet run with synthetic English/Arabic strings, including long unbroken body/reference tokens. The fixture replaces home actions and language context. Its loopback server stops after testing, and all other browser requests are blocked. No published content, Supabase data, models, or notifications are used.

Checks cover 320/390/768/1280px viewports, full text retention, quotation/reference clipping, English default, Arabic language/direction, absent-locale English fallback (including English inside an Arabic page), and one fetch across all six language selections. Screenshots and results.json contain synthetic content only. System fallback fonts and browser viewport emulation do not establish physical-device or assistive-technology behavior, stored text completeness, or translation accuracy.
