# Isolated browser UI regression check

Run `node scripts/check-mobile-ui.cjs` from the repository. This optional check needs
Playwright, Chromium, and permission to open loopback sockets/browser processes.
No test route is added to the application and no browser service is public.

If Playwright is installed outside this repository, set `ILM_PLAYWRIGHT_MODULE` to
its module directory. For example:

```sh
ILM_PLAYWRIGHT_MODULE=/path/to/node_modules/playwright \
ILM_CHROMIUM_BIN=/usr/bin/chromium \
ILM_UI_OUTPUT_DIR=/tmp/ilm-hunt-ui-review \
node scripts/check-mobile-ui.cjs
```

Set `ILM_CHROMIUM_BIN` if Chromium is not `/usr/bin/chromium`.
Set `ILM_UI_OUTPUT_DIR` to retain screenshots and `results.json` in a chosen directory
(the default is `/tmp/ilm-hunt-mobile-verification`).

The script bundles actual quiz, multiplayer, results, prayer, and reduced-effects
components with the actual Tailwind stylesheet. It uses synthetic question text,
choices, grades, and players; profile/quiz server actions and optional AI UI are
replaced with isolated fixtures. The loopback-only static server stops on completion.
All browser requests outside that server are blocked, except prayer service URLs
which are fulfilled locally with synthetic responses. No Supabase data, notifications,
owner balances/progress, published questions, or paid API calls are accessed.

Assertions cover 320/390/430px phone, 768px tablet, and 1280px desktop viewports:
long text wrapping, document overflow, visible text clipping, keyboard answer selection,
explanation scrolling, question progression, result focus, late leaderboard updates,
prayer location/service errors and recovery, setting/refresh focus, and changed method
requests. Reduced-motion is checked separately from persisted calm with the system
preference disabled; actual celebration canvases and rank progress animation are checked.

This is Chromium viewport/keyboard emulation with system fallback fonts, synthetic
server results, and mocked geolocation. It does not establish physical-device,
assistive-technology, authenticated multiplayer, or live-service correctness.
