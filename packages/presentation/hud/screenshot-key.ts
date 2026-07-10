import { Effect, Scope } from 'effect'

// F2 screenshot (vanilla parity). The WebGL context renders without
// preserveDrawingBuffer, so toDataURL is only valid in the same frame slice as
// the game's render — the double-rAF defers capture until after the game loop's
// earlier-registered rAF callback has drawn the next frame.
export const screenshotFileName = (nowMs: number): string => {
  const d = new Date(nowMs)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `ts-minecraft-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.png`
}

export const triggerDownload = (
  documentLike: Pick<Document, 'createElement'>,
  dataUrl: string,
  fileName: string,
): void => {
  const anchor = documentLike.createElement('a')
  anchor.href = dataUrl
  anchor.download = fileName
  anchor.click()
}

export class ScreenshotKeyService extends Effect.Service<ScreenshotKeyService>()(
  '@minecraft/presentation/ScreenshotKey',
  {
    effect: Effect.sync(() => ({
      // Scope-managed: the F2 listener is removed when the session scope closes.
      // The canvas is resolved at press time (id set by the boot DOM), so the
      // listener survives renderer restarts without re-attachment.
      attach: (): Effect.Effect<void, never, Scope.Scope> =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const keyHandler = (event: KeyboardEvent): void => {
              if (event.key !== 'F2') return
              event.preventDefault()
              const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null
              if (canvas === null || typeof canvas.toDataURL !== 'function') return
              requestAnimationFrame(() => requestAnimationFrame(() => {
                triggerDownload(document, canvas.toDataURL('image/png'), screenshotFileName(Date.now()))
              }))
            }
            window.addEventListener('keydown', keyHandler)
            return keyHandler
          }),
          (keyHandler) => Effect.sync(() => window.removeEventListener('keydown', keyHandler)),
        ).pipe(Effect.asVoid),
    })),
  },
) {}
