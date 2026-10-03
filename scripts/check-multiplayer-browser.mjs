import assert from "node:assert/strict"
import { createRequire } from "node:module"
import path from "node:path"
const require = createRequire(import.meta.url)
const { build } = require(process.env.ESBUILD_MODULE || "esbuild")
let chromium
try { ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright")) } catch {
  throw new Error("Optional browser test requires Playwright. See scripts/README-multiplayer-browser.md; PLAYWRIGHT_MODULE can point to a separate installation.")
}
const root = process.cwd()
const fixture = path.join(root, "scripts/fixtures/multiplayer-browser.tsx")
const mocked = new Set([
  "@/lib/multiplayer-service", "@/lib/supabase/client", "@/contexts/LanguageContext", "@/contexts/GameExperienceContext",
  "@/lib/sound", "framer-motion", "next/link", "@/components/layout/PageHeader",
  "@/components/multiplayer/CreateRoomModal", "@/components/multiplayer/RoomLobby", "@/components/multiplayer/QuizResults",
])
const bundle = await build({
  stdin: { contents: 'import React from "react"; import { createRoot } from "react-dom/client"; import Page from "./src/app/(app)/multiplayer/page"; sessionStorage.setItem("ilm-room:fixture-player", "fixture-room"); createRoot(document.getElementById("root")).render(<Page />);', resolveDir: root, loader: "tsx" },
  bundle: true, write: false, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "synthetic-services", setup(api) { api.onResolve({ filter: /.*/ }, args => mocked.has(args.path) ? { path: fixture } : undefined) } }],
})
let browser
try {
  browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), headless: true, args: ["--no-sandbox"] })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on("pageerror", error => errors.push(error.message))
  // All requests are intercepted. No listening preview server or real backend exists.
  await page.route("**/*", route => route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="en"><body><div id="root"></div></body></html>' }))
  await page.goto("http://multiplayer.synthetic.invalid/")
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  const first = page.getByRole("button", { name: "A Synthetic first choice" })
  const second = page.getByRole("button", { name: "B Synthetic second choice" })
  try { await first.waitFor() } catch (error) {
    console.error("Synthetic browser errors:", errors, "Rendered text:", await page.locator("body").innerText())
    throw error
  }
  await page.evaluate(() => window.__multiplayerFixture.setRecoveryOffline(true))
  await first.focus()
  await first.press("Enter")
  await page.waitForFunction(() => window.__multiplayerFixture.submitted.length === 1)
  await page.waitForFunction(() => !document.querySelector('[aria-keyshortcuts="2"]').disabled)
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Synthetic round 1", "A failed keyboard answer and failed recovery must return focus to the current question")
  await page.evaluate(() => window.__multiplayerFixture.setRecoveryOffline(false))
  await page.evaluate(() => window.__multiplayerFixture.finishInitialRead())
  await page.getByText("Restoring your room", { exact: false }).waitFor({ state: "hidden" })
  await page.keyboard.press("Tab")
  assert.equal(await first.evaluate(element => element === document.activeElement), true, "Normal Tab resumes at the first answer after failure")
  await page.keyboard.press("Tab")
  assert.equal(await second.evaluate(element => element === document.activeElement), true)
  await page.keyboard.press("Enter")
  await page.waitForFunction(() => window.__multiplayerFixture.submitted.length === 2)
  assert.deepEqual(await page.evaluate(() => window.__multiplayerFixture.submitted), [0, 0], "A late initial restore cannot discard an uncertain answer's original choice")
  await page.waitForFunction(() => document.querySelector('[aria-keyshortcuts="1"]').getAttribute("aria-pressed") === "true")
  assert.equal(await second.getAttribute("aria-pressed"), "false")
  if (process.env.MULTIPLAYER_SCREENSHOT_PATH) await page.screenshot({ path: process.env.MULTIPLAYER_SCREENSHOT_PATH, fullPage: true })

  // Moving focus while a request is pending is a deliberate choice. Failure
  // must preserve it rather than redirecting the player to the heading.
  await page.goto("http://multiplayer.synthetic.invalid/?scenario=manual-focus")
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  await first.waitFor()
  await page.evaluate(() => { window.__multiplayerFixture.setLate(); window.__multiplayerFixture.finishInitialRead() })
  await page.getByText("Restoring your room", { exact: false }).waitFor({ state: "hidden" })
  await first.focus()
  await first.press("Enter")
  await page.waitForFunction(() => window.__multiplayerFixture.submitted.length === 1)
  const questionGroup = page.getByRole("group")
  await questionGroup.focus()
  await page.evaluate(() => window.__multiplayerFixture.failLate())
  await page.waitForFunction(() => !document.querySelector('[aria-keyshortcuts="2"]').disabled)
  assert.equal(await questionGroup.evaluate(element => element === document.activeElement), true, "A same-round failure must preserve deliberate focus elsewhere")

  // A stale saved answer is equally unable to replace a newer confirmed result.
  await page.goto("http://multiplayer.synthetic.invalid/?scenario=stale-saved")
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  await first.click()
  await page.getByText("Correct!", { exact: true }).waitFor()
  await page.evaluate(() => window.__multiplayerFixture.finishInitialRead())
  await page.getByText("Restoring your room", { exact: false }).waitFor({ state: "hidden" })
  assert.equal(await first.getAttribute("aria-pressed"), "true", "A late saved answer cannot replace a newer confirmed choice")
  assert.equal(await second.getAttribute("aria-pressed"), "false")

  await page.goto("http://multiplayer.synthetic.invalid/?scenario=stale-rejection")
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  await first.click()
  await page.getByText("Correct!", { exact: true }).waitFor()
  await page.evaluate(() => window.__multiplayerFixture.finishInitialRead())
  await page.getByText("Restoring your room", { exact: false }).waitFor({ state: "hidden" })
  assert.equal(await page.getByRole("alert").count(), 0, "An obsolete lookup rejection cannot report failure after a newer successful answer")
  assert.equal(await first.getAttribute("aria-pressed"), "true")

  await page.goto("http://multiplayer.synthetic.invalid/?scenario=restore-error")
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  await first.waitFor()
  await page.evaluate(() => window.__multiplayerFixture.finishInitialRead())
  await page.getByRole("alert").waitFor()
  assert.equal(await page.getByRole("alert").count(), 1, "A current saved-answer lookup failure must still be reported")

  // A confirmed response arriving after the next round cannot lock its choices.
  await page.goto("http://multiplayer.synthetic.invalid/?scenario=late")
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  await first.waitFor()
  await page.evaluate(() => { window.__multiplayerFixture.setLate(); window.__multiplayerFixture.finishInitialRead() })
  await page.getByText("Restoring your room", { exact: false }).waitFor({ state: "hidden" })
  await first.click()
  await page.waitForFunction(() => window.__multiplayerFixture.submitted.length === 1)
  await page.evaluate(() => window.__multiplayerFixture.advance())
  await page.getByRole("heading", { name: "Synthetic round 2" }).waitFor()
  await page.evaluate(() => window.__multiplayerFixture.finishLate())
  await page.waitForFunction(() => !document.querySelector('[aria-keyshortcuts="1"]').disabled)
  assert.equal(await first.getAttribute("aria-pressed"), "false")
  assert.equal(await second.getAttribute("aria-pressed"), "false")

  // An old round's rejection must not move focus away from the player's
  // chosen control in the next round.
  await page.goto("http://multiplayer.synthetic.invalid/?scenario=late-failure")
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  await first.waitFor()
  await page.evaluate(() => { window.__multiplayerFixture.setLate(); window.__multiplayerFixture.finishInitialRead() })
  await page.getByText("Restoring your room", { exact: false }).waitFor({ state: "hidden" })
  await first.focus()
  await first.press("Enter")
  await page.waitForFunction(() => window.__multiplayerFixture.submitted.length === 1)
  await page.evaluate(() => window.__multiplayerFixture.advance())
  await page.getByRole("heading", { name: "Synthetic round 2" }).waitFor()
  await page.waitForFunction(() => !document.querySelector('[aria-keyshortcuts="2"]').disabled)
  await second.focus()
  await page.evaluate(() => window.__multiplayerFixture.failLate())
  // Await the rejected callback and its finally handler before checking focus.
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)))
  assert.equal(await second.evaluate(element => element === document.activeElement), true, "A prior question's late failure cannot steal the next question's focus")
  assert.equal(await second.isEnabled(), true)
  assert.deepEqual(errors, [], "Synthetic recovery must not produce uncaught browser errors")
  console.log("Chromium multiplayer recovery: keyboard retry focus, late-failure focus guard, slow restore, lost response and stale/late response checks passed")
} finally { await browser?.close() }
