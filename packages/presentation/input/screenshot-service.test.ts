import { describe, it, expect } from '@effect/vitest'
import { afterEach, vi } from 'vitest'
import { createScreenshotFilename, downloadCanvasScreenshot } from './screenshot-service'

const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

type TestLink = {
  href: string
  download: string
  clicked: boolean
  style: { display: string }
  click: () => void
  remove: ReturnType<typeof vi.fn>
}

const createDocumentMock = () => {
  const links: TestLink[] = []
  const body = { appendChild: vi.fn() }
  const doc = {
    body,
    createElement: (tag: string) => {
      expect(tag).toBe('a')
      const link: TestLink = {
        href: '',
        download: '',
        clicked: false,
        style: { display: '' },
        click: () => {
          link.clicked = true
        },
        remove: vi.fn(),
      }
      links.push(link)
      return link
    },
    getElementById: () => null,
  }

  return { doc: doc as unknown as Document, links, body }
}

afterEach(() => {
  if (originalCreateObjectURL === undefined) {
    Reflect.deleteProperty(URL, 'createObjectURL')
  } else {
    Reflect.set(URL, 'createObjectURL', originalCreateObjectURL)
  }

  if (originalRevokeObjectURL === undefined) {
    Reflect.deleteProperty(URL, 'revokeObjectURL')
  } else {
    Reflect.set(URL, 'revokeObjectURL', originalRevokeObjectURL)
  }

  vi.restoreAllMocks()
})

describe('screenshot service', () => {
  const timestamp = new Date('2026-06-28T01:02:03.456Z')

  it('creates a stable screenshot filename from the timestamp', () => {
    expect(createScreenshotFilename(timestamp)).toBe('ts-minecraft-2026-06-28-01-02-03.png')
  })

  it('returns false when no canvas is available', () => {
    const { doc } = createDocumentMock()
    expect(downloadCanvasScreenshot(null, doc, timestamp)).toBe(false)
  })

  it('downloads a PNG blob with an object URL', () => {
    const { doc, links, body } = createDocumentMock()
    const createObjectURL = vi.fn(() => 'blob:screenshot')
    const revokeObjectURL = vi.fn()
    Reflect.set(URL, 'createObjectURL', createObjectURL)
    Reflect.set(URL, 'revokeObjectURL', revokeObjectURL)

    const canvas = {
      toBlob: (callback: BlobCallback, type?: string) => {
        expect(type).toBe('image/png')
        callback(new Blob(['png'], { type: 'image/png' }))
      },
    } as HTMLCanvasElement

    expect(downloadCanvasScreenshot(canvas, doc, timestamp)).toBe(true)
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(links[0]?.href).toBe('blob:screenshot')
    expect(links[0]?.download).toBe('ts-minecraft-2026-06-28-01-02-03.png')
    expect(links[0]?.style.display).toBe('none')
    expect(links[0]?.clicked).toBe(true)
    expect(body.appendChild).toHaveBeenCalledWith(links[0])
    expect(links[0]?.remove).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:screenshot')
  })

  it('falls back to a data URL when toBlob is unavailable', () => {
    const { doc, links } = createDocumentMock()
    const canvas = {
      toDataURL: vi.fn((type: string) => {
        expect(type).toBe('image/png')
        return 'data:image/png;base64,abc'
      }),
    } as unknown as HTMLCanvasElement

    expect(downloadCanvasScreenshot(canvas, doc, timestamp)).toBe(true)
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/png')
    expect(links[0]?.href).toBe('data:image/png;base64,abc')
    expect(links[0]?.download).toBe('ts-minecraft-2026-06-28-01-02-03.png')
    expect(links[0]?.clicked).toBe(true)
  })
})
