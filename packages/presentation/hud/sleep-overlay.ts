import { Effect, MutableRef, Option } from 'effect'

import { DomOperationsService } from './crosshair'

// Sleep fade: black in → hold (the dawn skip happens under it) → fade out.
export const SLEEP_FADE_MS = 600
export const SLEEP_HOLD_MS = 900
// Transient message toast ("You can only sleep at night").
export const SLEEP_MESSAGE_MS = 1800

const baseCss = (opacity: number, background: string): string => [
  'position:fixed',
  'inset:0',
  'pointer-events:none',
  'z-index:950',
  'display:flex',
  'align-items:center',
  'justify-content:center',
  'color:#e8e8e8',
  'font:600 20px system-ui,sans-serif',
  'text-shadow:0 1px 3px rgba(0,0,0,0.8)',
  `opacity:${opacity}`,
  `transition:opacity ${SLEEP_FADE_MS}ms ease-in-out`,
  `background:${background}`,
].join(';')

export const SLEEP_OVERLAY_HIDDEN_CSS = baseCss(0, 'rgba(0,0,0,0.96)')
export const SLEEP_OVERLAY_VISIBLE_CSS = baseCss(1, 'rgba(0,0,0,0.96)')
export const SLEEP_MESSAGE_HIDDEN_CSS = baseCss(0, 'transparent')
export const SLEEP_MESSAGE_VISIBLE_CSS = baseCss(1, 'transparent')

export interface SleepOverlay {
  readonly element: HTMLElement
  // Full sleep sequence: fade to black with "Sleeping...", hold, fade out.
  readonly playSleepFade: () => Effect.Effect<void, never>
  // Transient centered toast without the blackout (e.g. daytime refusal).
  readonly showMessage: (text: string) => Effect.Effect<void, never>
  readonly hide: () => Effect.Effect<void, never>
}

export const makeSleepOverlay = (dom: DomOperationsService) =>
  Effect.gen(function* () {
    const element = dom.createElement('div')
    element.id = 'sleep-overlay'
    element.style.cssText = SLEEP_OVERLAY_HIDDEN_CSS

    const timeoutRef = MutableRef.make<ReturnType<typeof setTimeout> | null>(null)

    const clearTimer = () => {
      const timeout = MutableRef.get(timeoutRef)
      if (timeout !== null) {
        clearTimeout(timeout)
        MutableRef.set(timeoutRef, null)
      }
    }

    const hideOverlay = () => {
      clearTimer()
      element.style.cssText = SLEEP_OVERLAY_HIDDEN_CSS
      element.textContent = ''
    }

    const overlay: SleepOverlay = {
      element,
      playSleepFade: () =>
        Effect.sync(() => {
          clearTimer()
          element.textContent = 'Sleeping...'
          element.style.cssText = SLEEP_OVERLAY_VISIBLE_CSS
          MutableRef.set(timeoutRef, setTimeout(hideOverlay, SLEEP_FADE_MS + SLEEP_HOLD_MS))
        }),
      showMessage: (text) =>
        Effect.sync(() => {
          clearTimer()
          element.textContent = text
          element.style.cssText = SLEEP_MESSAGE_VISIBLE_CSS
          MutableRef.set(timeoutRef, setTimeout(hideOverlay, SLEEP_MESSAGE_MS))
        }),
      hide: () => Effect.sync(hideOverlay),
    }

    dom.appendChild(element)
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        hideOverlay()
        if (Option.isSome(dom.getParentNode(element))) dom.removeChild(element)
      }),
    )

    return overlay
  })

export class SleepOverlayService extends Effect.Service<SleepOverlayService>()(
  '@minecraft/presentation/SleepOverlay',
  {
    scoped: Effect.gen(function* () {
      const dom = yield* DomOperationsService
      return yield* makeSleepOverlay(dom)
    }),
  },
) {}
