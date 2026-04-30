import { chromium } from 'playwright'

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--enable-webgl2',
    '--ignore-gpu-blocklist',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    '--disable-setuid-sandbox',
  ],
})
const page = await browser.newPage()

const consoleLogs = []
const networkErrors = []

page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text() }))
page.on('pageerror', err => consoleLogs.push({ type: 'pageerror', text: err.message }))
page.on('requestfailed', req => networkErrors.push({ url: req.url(), failure: req.failure()?.errorText }))

await page.goto('http://localhost:5175', { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.waitForTimeout(5000)

// Check if atlas loaded
const atlasStatus = await page.evaluate(async () => {
  const img = new Image()
  return new Promise((resolve) => {
    img.onload = () => resolve({ loaded: true, w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = (e) => resolve({ loaded: false, error: String(e) })
    img.src = '/textures/atlas.png'
  })
})

// Check WebGL canvas state
const canvasInfo = await page.evaluate(() => {
  const canvas = document.querySelector('canvas')
  if (!canvas) return { found: false }
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
  return {
    found: true,
    width: canvas.width,
    height: canvas.height,
    hasGL: !!gl,
  }
})

// Sample pixel color from canvas (top-center where terrain should be)
const pixelColor = await page.evaluate(() => {
  const canvas = document.querySelector('canvas')
  if (!canvas) return null
  const ctx = canvas.getContext('2d')
  if (!ctx) return 'no-2d-ctx'
  const d = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data
  return { r: d[0], g: d[1], b: d[2], a: d[3] }
})

console.log('Atlas load result:', JSON.stringify(atlasStatus))
console.log('Canvas info:', JSON.stringify(canvasInfo))
console.log('Center pixel:', JSON.stringify(pixelColor))
console.log('Network errors:', JSON.stringify(networkErrors))
console.log('Console errors:', JSON.stringify(consoleLogs.filter(l => l.type === 'error' || l.type === 'pageerror').slice(0, 20)))

await page.screenshot({ path: '/tmp/debug-screenshot.png', fullPage: true })
console.log('Screenshot saved to /tmp/debug-screenshot.png')

await browser.close()
