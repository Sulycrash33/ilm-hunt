# Optional synthetic multiplayer browser check

Run `node scripts/check-multiplayer-browser.mjs` from the repository root with
Playwright and Chromium available. This is separate from `test:multiplayer`;
it does not require Supabase credentials or an application server.

For a standalone installation that leaves the repository's package and lockfile
unchanged:

```sh
npm install --prefix /tmp/ilm-browser-tools playwright esbuild
/tmp/ilm-browser-tools/node_modules/.bin/playwright install chromium
PLAYWRIGHT_MODULE=/tmp/ilm-browser-tools/node_modules/playwright \
ESBUILD_MODULE=/tmp/ilm-browser-tools/node_modules/esbuild \
node scripts/check-multiplayer-browser.mjs
```

By default Playwright uses its installed Chromium. `CHROMIUM_PATH` can select a
system browser. `MULTIPLAYER_SCREENSHOT_PATH` optionally saves a screenshot of
the synthetic recovery at a 390 × 844 viewport.

The harness bundles the actual multiplayer page, LiveQuiz, and premium controls
with real React effects. Its questions, player, results, authentication, and
room service are synthetic. All browser requests are intercepted; no listening
preview server, account, live data, or published question content is involved.
Motion and ancillary screens are stubbed, and Tailwind styles are not loaded,
so screenshots show interaction state and are not a visual-style audit.

The checks cover a slow initial saved-answer lookup, a lost submission response,
a retry using a different button, an old saved answer or lookup failure arriving
after a confirmed result, a genuine initial lookup failure, and a submission
response arriving after the next question. Existing
`test:multiplayer` checks additionally cover failed snapshots, reconnect status,
countdown retries and cleanup; `test:multiplayer-db` uses local PGlite for RPC
grading, permissions and timer behavior.
