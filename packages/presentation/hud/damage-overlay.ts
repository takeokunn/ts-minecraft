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
  // Redundant visual channel for damage direction: flashes a red wedge on the
  // screen edge toward the attacker (bearing in radians, 0 = ahead,
  // positive = clockwise).
  readonly flashDirectional: (bearingRadians: number) => Effect.Effect<void, never>
  readonly hide: () => Effect.Effect<void, never>
}

export const DAMAGE_DIRECTION_FLASH_MS = 600

const DAMAGE_DIRECTION_CONTAINER_CSS = [
  'position:fixed',
  'inset:0',
  'display:flex',
  'align-items:center',
  'justify-content:center',
  'pointer-events:none',
  'z-index:901',
].join(';')

const damageDirectionWedgeCss = (opacity: number, bearingRadians: number): string => [
  'width:0',
  'height:0',
  'border-left:26px solid transparent',
  'border-right:26px solid transparent',
  'border-bottom:34px solid rgba(226,36,36,0.85)',
  `opacity:${opacity}`,
  `transition:opacity ${DAMAGE_DIRECTION_FLASH_MS}ms ease-out`,
  // Rotate around screen centre, then push the wedge out toward the edge.
  `transform:rotate(${bearingRadians}rad) translateY(-140px)`,
].join(';')

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

    // Directional wedge lives in its own centred container.
    const directionContainer = dom.createElement('div')
    directionContainer.id = 'damage-direction'
    directionContainer.style.cssText = DAMAGE_DIRECTION_CONTAINER_CSS
    const directionWedge = dom.createElement('div')
    directionWedge.style.cssText = damageDirectionWedgeCss(0, 0)
    directionContainer.appendChild(directionWedge)
    const directionTimeoutRef = MutableRef.make<ReturnType<typeof setTimeout> | null>(null)

    const hideDirection = () => {
      const timeout = MutableRef.get(directionTimeoutRef)
      if (timeout !== null) {
        clearTimeout(timeout)
        MutableRef.set(directionTimeoutRef, null)
      }
      directionWedge.style.opacity = '0'
    }

    const overlay: DamageOverlay = {
      element,
      flash: () =>
        Effect.sync(() => {
          clearFlashTimer()
          element.style.cssText = DAMAGE_OVERLAY_VISIBLE_CSS
          MutableRef.set(timeoutRef, setTimeout(hideOverlay, DAMAGE_OVERLAY_FLASH_MS))
        }),
      flashDirectional: (bearingRadians: number) =>
        Effect.sync(() => {
          hideDirection()
          directionWedge.style.cssText = damageDirectionWedgeCss(1, bearingRadians)
          MutableRef.set(directionTimeoutRef, setTimeout(hideDirection, DAMAGE_DIRECTION_FLASH_MS))
        }),
      hide: () =>
        Effect.sync(() => {
          hideOverlay()
          hideDirection()
        }),
    }

    dom.appendChild(element)
    dom.appendChild(directionContainer)
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        hideOverlay()
        hideDirection()
        if (Option.isSome(dom.getParentNode(element))) dom.removeChild(element)
        if (Option.isSome(dom.getParentNode(directionContainer))) dom.removeChild(directionContainer)
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
