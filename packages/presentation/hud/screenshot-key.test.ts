import { describe, expect, it, vi } from 'vitest'
import { screenshotFileName, triggerDownload } from './screenshot-key'

describe('screenshotFileName', () => {
  it('formats a sortable local timestamp with the game prefix', () => {
    // 2026-07-10 09:05:03 local time
    const nowMs = new Date(2026, 6, 10, 9, 5, 3).getTime()
    expect(screenshotFileName(nowMs)).toBe('ts-minecraft-2026-07-10_09-05-03.png')
  })

  it('zero-pads single-digit fields', () => {
    const nowMs = new Date(2026, 0, 2, 3, 4, 5).getTime()
    expect(screenshotFileName(nowMs)).toBe('ts-minecraft-2026-01-02_03-04-05.png')
  })
})

describe('triggerDownload', () => {
  it('creates an anchor with the data url and file name and clicks it', () => {
    const click = vi.fn()
    const anchor: { href: string; download: string; click: () => void } = { href: '', download: '', click }
    const documentLike = { createElement: vi.fn(() => anchor) }
    triggerDownload(documentLike as unknown as Pick<Document, 'createElement'>, 'data:image/png;base64,AAAA', 'shot.png')
    expect(documentLike.createElement).toHaveBeenCalledWith('a')
    expect(anchor.href).toBe('data:image/png;base64,AAAA')
    expect(anchor.download).toBe('shot.png')
    expect(click).toHaveBeenCalledOnce()
  })
})
