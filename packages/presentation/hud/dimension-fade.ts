import { Effect, MutableRef, Option } from 'effect'

import { DomOperationsService } from './crosshair'

// Dimension-travel fade: switching dimensions rebuilds the whole chunk scene,
// which stalls rendering for up to ~1s. A full-screen fade held over that window
// turns a visible hitch into an intentional transition (vanilla shows a loading
// screen here).
export const DIMENSION_FADE_IN_MS = 120
export const DIMENSION_FADE_HOLD_MS = 1400
export const DIMENSION_FADE_OUT_MS = 400

const fadeCss = (opacity: number, transitionMs: number): string => [
  'position:fixed',
  'inset:0',
  'background:#000',
  'pointer-events:none',
  'z-index:940',
  `opacity:${opacity}`,
  `transition:opacity ${transitionMs}ms ease`,
].join(';')

export interface DimensionFade {
  readonly element: HTMLElement
  // Fade to black, hold while the destination dimension's chunks build, fade out.
  readonly flash: () => Effect.Effect<void, never>
  readonly hide: () => Effect.Effect<void, never>
}

export const makeDimensionFade = (dom: DomOperationsService) =>
  Effect.gen(function* () {
    const element = dom.createElement('div')
    element.id = 'dimension-fade'
    element.setAttribute('aria-hidden', 'true')
    element.style.cssText = fadeCss(0, DIMENSION_FADE_OUT_MS)

    const timerRef = MutableRef.make<ReturnType<typeof setTimeout> | null>(null)
    const clearTimer = () => {
      const timer = MutableRef.get(timerRef)
      if (timer !== null) {
        clearTimeout(timer)
        MutableRef.set(timerRef, null)
      }
    }

    const fade: DimensionFade = {
      element,
      flash: () =>
        Effect.sync(() => {
          clearTimer()
          element.style.cssText = fadeCss(1, DIMENSION_FADE_IN_MS)
          MutableRef.set(timerRef, setTimeout(() => {
            element.style.cssText = fadeCss(0, DIMENSION_FADE_OUT_MS)
            MutableRef.set(timerRef, null)
          }, DIMENSION_FADE_HOLD_MS))
        }),
      hide: () =>
        Effect.sync(() => {
          clearTimer()
          element.style.cssText = fadeCss(0, DIMENSION_FADE_OUT_MS)
        }),
    }

    dom.appendChild(element)
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        clearTimer()
        if (Option.isSome(dom.getParentNode(element))) dom.removeChild(element)
      }),
    )

    return fade
  })

export class DimensionFadeService extends Effect.Service<DimensionFadeService>()(
  '@minecraft/presentation/DimensionFade',
  {
    scoped: Effect.gen(function* () {
      const dom = yield* DomOperationsService
      return yield* makeDimensionFade(dom)
    }),
  },
) {}
