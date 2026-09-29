/**
 * Horizontal-overflow check at real phone widths.
 *
 * Most players are on phones, and a page that scrolls sideways is the most
 * visible way to get that wrong. This drives headless Chrome with device
 * emulation over CDP — emulation matters, because without it Chrome ignores
 * the viewport meta and reports a layout that no phone ever sees.
 *
 * For each width it loads each route and asserts `scrollWidth == clientWidth`,
 * naming the first offending elements when it does not. `position: fixed`
 * elements are excluded: they are laid out against the viewport and routinely
 * sit at its edge without causing a scroll.
 *
 * The widths are chosen from the real range: 320 is the smallest still in use
 * (iPhone SE 1st gen), 390 an iPhone 14/15/16, 430 an iPhone Pro Max. Note
 * that none of them reach Tailwind's `sm` breakpoint, which is 640px — any
 * `sm:` class in this codebase is desktop-only.
 *
 * Only routes reachable without signing in are listed. The authenticated pages
 * need a session and are not covered here.
 *
 *   # start Chrome with a debugging port, then:
 *   node scripts/check-mobile-overflow.mjs 9350 https://www.ilmhunt.app
 */
const PORT = Number(process.argv[2])
const BASE = process.argv[3]
const WIDTHS = [320, 390, 430]
const ROUTES = ['/', '/login', '/signup', '/language', '/onboarding/age', '/onboarding/name', '/onboarding/avatar']

const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
const page = (await res.json()).find(t => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0; const pending = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
await new Promise(r => ws.addEventListener('open', r))
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result) }
})
await send('Page.enable'); await send('Runtime.enable')

const rows = []
for (const w of WIDTHS) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: 844, deviceScaleFactor: 2, mobile: true })
  for (const route of ROUTES) {
    await send('Page.navigate', { url: BASE + route })
    await new Promise(r => setTimeout(r, 2200))
    const probe = await send('Runtime.evaluate', {
      expression: `(() => {
        const d = document.documentElement;
        const over = [...document.querySelectorAll('*')]
          .filter(e => e.getBoundingClientRect().right > d.clientWidth + 1 && getComputedStyle(e).position !== 'fixed')
          .slice(0, 3)
          .map(e => (e.tagName + '.' + String(e.className).slice(0, 40)));
        return JSON.stringify({ sw: d.scrollWidth, cw: d.clientWidth, over });
      })()`, returnByValue: true,
    })
    const r = JSON.parse(probe.result.value)
    const bad = r.sw > r.cw + 1
    rows.push(`${bad ? 'OVERFLOW' : 'ok      '} ${String(w).padEnd(4)} ${route.padEnd(22)} sw=${r.sw} cw=${r.cw}${bad ? ' :: ' + r.over.join(' | ') : ''}`)
  }
}
console.log(rows.join('\n'))
ws.close(); process.exit(0)
