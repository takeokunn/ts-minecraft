import { test, type PlaywrightTestArgs } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'

type Page = PlaywrightTestArgs['page']

// Automated accessibility gate. Encodes the two audits validated live in the
// 2026-07-05 a11y pass so their fixes can't silently regress:
//   1. every visible interactive control has a programmatic accessible name
//      (WCAG 4.1.2) — caught the unlabeled keyboard-rebind inputs.
//   2. every visible text node meets WCAG AA contrast (4.5:1 normal / 3:1 large)
//      — caught the settings "Done" button at 3.92:1.
// Runs in the browser (no axe-core dependency) so it works fully offline.

type Finding = { readonly kind: 'name' | 'contrast'; readonly detail: string }

// The auditor is injected as a string and run via page.evaluate — it cannot
// close over Node-side values, so it is fully self-contained.
const AUDIT_FN = `(rootSelectors) => {
  const srgb = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
  const lum = (r, g, b) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)
  const parse = (s) => { const m = s.match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null }
  const ratio = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  const effBg = (el) => { let n = el; while (n && n !== document.documentElement) { const bg = parse(getComputedStyle(n).backgroundColor); if (bg && bg.a >= 0.9) return bg; n = n.parentElement } return { r: 20, g: 24, b: 30 } }
  const isVisible = (el) => el.offsetParent !== null
  // Visually-hidden (screen-reader-only) spans are exempt from contrast — the
  // visible UI carries the meaning (e.g. icon-based HUD numbers).
  const isVisuallyHidden = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.clip === 'rect(0px, 0px, 0px, 0px)' || (r.width <= 1 && r.height <= 1) }
  const accessibleName = (el) => {
    const aria = el.getAttribute('aria-label'); if (aria && aria.trim()) return aria.trim()
    const lb = el.getAttribute('aria-labelledby'); if (lb) { const l = document.getElementById(lb); if (l && l.textContent.trim()) return l.textContent.trim() }
    if (el.id) { const lbl = document.querySelector('label[for="' + el.id + '"]'); if (lbl && lbl.textContent.trim()) return lbl.textContent.trim() }
    const pl = el.closest('label'); if (pl && pl.textContent.trim()) return pl.textContent.trim()
    const txt = (el.textContent || '').trim(); if (txt) return txt
    const title = el.getAttribute('title'); if (title && title.trim()) return title.trim()
    return null
  }
  const findings = []
  const scope = rootSelectors.flatMap((s) => Array.from(document.querySelectorAll(s)))
  const within = (el) => scope.some((root) => root === el || root.contains(el))
  // 1. interactive controls need an accessible name
  const interactive = Array.from(document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])'))
    .filter((el) => isVisible(el) && within(el) && !isVisuallyHidden(el))
  for (const el of interactive) {
    if (!accessibleName(el)) findings.push({ kind: 'name', detail: el.tagName + '#' + (el.id || '(no-id)') + ' type=' + (el.getAttribute('type') || '') })
  }
  // 2. visible text nodes need AA contrast
  const seen = new Set()
  const textNodes = Array.from(document.querySelectorAll('button, a, span, p, label, div, li, h1, h2, h3, select, option'))
    .filter((el) => isVisible(el) && within(el) && (el.textContent || '').trim() && el.childElementCount === 0 && !isVisuallyHidden(el))
  for (const el of textNodes) {
    const cs = getComputedStyle(el); const fg = parse(cs.color); if (!fg || fg.a < 0.5) continue
    const bg = effBg(el); const cr = ratio(lum(fg.r, fg.g, fg.b), lum(bg.r, bg.g, bg.b))
    const fontPx = parseFloat(cs.fontSize); const bold = (parseInt(cs.fontWeight) || 400) >= 700
    const large = fontPx >= 24 || (fontPx >= 18.66 && bold); const threshold = large ? 3.0 : 4.5
    const key = (el.id || el.className) + '|' + (el.textContent || '').trim().slice(0, 16); if (seen.has(key)) continue; seen.add(key)
    if (cr < threshold) findings.push({ kind: 'contrast', detail: (el.id || '.' + String(el.className).split(' ')[0]) + ' "' + (el.textContent || '').trim().slice(0, 20) + '" ' + cr.toFixed(2) + ':1 < ' + threshold })
  }
  return findings
}`

const audit = (page: Page, rootSelectors: ReadonlyArray<string>): Promise<Finding[]> =>
  page.evaluate(`(${AUDIT_FN})(${JSON.stringify(rootSelectors)})`) as Promise<Finding[]>

// Throwing fails the test with every finding listed — clearer than a deep-equal
// diff, and sidesteps the Playwright expect() array-matcher typing.
const assertNoFindings = (findings: ReadonlyArray<Finding>): void => {
  if (findings.length > 0) {
    throw new Error(`WCAG a11y gate: ${findings.length} finding(s)\n` + findings.map((f) => `  [${f.kind}] ${f.detail}`).join('\n'))
  }
}

test.describe('accessibility gate', () => {
  test('main menu: all controls named and AA-contrasted', async ({ page }) => {
    const game = new GamePage(page)
    await game.gotoMainMenuOnly()
    await page.waitForSelector('#mm-new-world', { state: 'visible', timeout: 60_000 })
    const findings = await audit(page, ['#app', '#main-menu', 'body > div'])
    assertNoFindings(findings)
  })

  test('in-session HUD + settings overlay: all controls named and AA-contrasted', async ({ page }) => {
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()
    // Reveal the settings overlay (starts display:none) so its form is audited.
    await page.evaluate(() => {
      const el = document.getElementById('settings-overlay')
      if (el) el.style.display = 'block'
    })
    await page.waitForTimeout(300)
    const findings = await audit(page, ['#survival-hud', '#fps-counter', '#settings-overlay', '#effects-display'])
    assertNoFindings(findings)
  })
})
