export const SCREENSHOT_CANVAS_ID = 'game-canvas'

export const createScreenshotFilename = (now = new Date()): string => {
  const stamp = now.toISOString().replace(/\.\d{3}Z$/, '').replace(/[:T]/g, '-')
  return `ts-minecraft-${stamp}.png`
}

export const resolveScreenshotCanvas = (doc: Document = document): HTMLCanvasElement | null => {
  const element = doc.getElementById(SCREENSHOT_CANVAS_ID)
  return element instanceof HTMLCanvasElement ? element : null
}

const clickDownloadLink = (href: string, doc: Document, now: Date, revoke?: () => void): void => {
  const link = doc.createElement('a')
  link.href = href
  link.download = createScreenshotFilename(now)
  link.style.display = 'none'
  doc.body?.appendChild(link)
  link.click()
  link.remove()
  revoke?.()
}

export const downloadCanvasScreenshot = (
  canvas: HTMLCanvasElement | null = resolveScreenshotCanvas(),
  doc: Document = document,
  now = new Date(),
): boolean => {
  if (canvas === null) return false

  try {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => {
        if (blob === null) return
        const url = URL.createObjectURL(blob)
        clickDownloadLink(url, doc, now, () => URL.revokeObjectURL(url))
      }, 'image/png')
      return true
    }

    if (typeof canvas.toDataURL === 'function') {
      clickDownloadLink(canvas.toDataURL('image/png'), doc, now)
      return true
    }
  } catch (error) {
    console.warn('Screenshot capture failed', error)
  }

  return false
}
