import { Effect, MutableRef, Option } from 'effect'

import { DomOperationsService } from './crosshair'

export const DAMAGE_OVERLAY_FLASH_MS = 220

export const createDamageOverlayCss = (opacity: number): string => [
  'position:fixed',
  'inset:0',
  'pointer-events:none',
  'z-index:900',
  `opacity:${opacity}`,
  `transition:opacity ${DAMAGE_OVERLAY_FLASH_MS}ms ease-out`,
  'background:radial-gradient(circle at center, rgba(255,0,0,0) 46%, rgba(226,36,36,0.34) 76%, rgba(120,0,0,0.62) 100%)',
  'box-shadow:inset 0 0 140px rgba(200,0,0,0.45)',
  'mix-blend-mode:screen',
].join(';')

export const DAMAGE_OVERLAY_HIDDEN_CSS = createDamageOverlayCss(0)
export const DAMAGE_OVERLAY_VISIBLE_CSS = createDamageOverlayCss(1)

export interface DamageOverlay {
  readonly element: HTMLElement
  readonly flash: () => Effect.Effect<void, never>
  readonly hide: () => Effect.Effect<void, never>
}

export const makeDamageOverlay = (dom: DomOperationsService) =>
  Effect.gen(function* () {
    const element = dom.createElement('div')
    element.id = 'damage-overlay'
    element.className = 'damage-overlay'
    element.style.cssText = DAMAGE_OVERLAY_HIDDEN_CSS

    const timeoutRef = MutableRef.make<ReturnType<typeof setTimeout> | null>(null)

    const clearFlashTimer = () => {
      const timeout = MutableRef.get(timeoutRef)
      if (timeout !== null) {
        clearTimeout(timeout)
        MutableRef.set(timeoutRef, null)
      }
    }

    const hideOverlay = () => {
      clearFlashTimer()
      element.style.cssText = DAMAGE_OVERLAY_HIDDEN_CSS
    }

    const overlay: DamageOverlay = {
      element,
      flash: () =>
        Effect.sync(() => {
          clearFlashTimer()
          element.style.cssText = DAMAGE_OVERLAY_VISIBLE_CSS
          MutableRef.set(timeoutRef, setTimeout(hideOverlay, DAMAGE_OVERLAY_FLASH_MS))
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

export class DamageOverlayService extends Effect.Service<DamageOverlayService>()(
  '@minecraft/presentation/DamageOverlay',
  {
    scoped: Effect.gen(function* () {
      const dom = yield* DomOperationsService
      return yield* makeDamageOverlay(dom)
    }),
  },
) {}
