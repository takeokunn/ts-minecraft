import { Effect, Option } from 'effect'
import { MutableRef } from 'effect'
import { getHudScale } from './hud-scale'

const CROSSHAIR_PULSE_MS = 120

const createCrosshairCss = (
  pulseScale = 1,
  filter = 'drop-shadow(0 0 2px rgba(0, 0, 0, 0.9))',
) => `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(${getHudScale() * pulseScale});
        width: 20px;
        height: 20px;
        pointer-events: none;
        z-index: 1000;
        mix-blend-mode: difference;
        filter: ${filter};
        transition: transform 80ms ease-out, filter 120ms ease-out;
      `

const getCrosshairBaseCss = () => createCrosshairCss()
const getCrosshairPulseCss = () => createCrosshairCss(
  1.45,
  'drop-shadow(0 0 4px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 10px rgba(255, 70, 70, 0.85))',
)

// DOM abstraction for testability
export class DomOperationsService extends Effect.Service<DomOperationsService>()(
  '@minecraft/presentation/DomOperations',
  {
    /* c8 ignore next 22 */
    effect: Effect.succeed({
      createElement: <K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K] =>
        document.createElement(tagName),
      appendChild: (element: HTMLElement): void => { document.body.appendChild(element) },
      appendChildTo: (parent: HTMLElement, child: HTMLElement): void => { parent.appendChild(child) },
      removeChild: (element: HTMLElement): void => {
        if (element.parentNode) {
          element.parentNode.removeChild(element)
        }
      },
      getParentNode: (element: HTMLElement): Option.Option<HTMLElement> =>
        Option.fromNullable(element.parentElement),
      setInnerHTML: (element: HTMLElement, html: string): void => { element.innerHTML = html },
      querySelector: <T extends HTMLElement>(element: HTMLElement, selector: string): Option.Option<T> =>
        Option.fromNullable(element.querySelector<T>(selector)),
    })
  }
) {}
export class CrosshairService extends Effect.Service<CrosshairService>()(
  '@minecraft/presentation/Crosshair',
  {
    effect: Effect.gen(function* () {
      const dom = yield* DomOperationsService
      // Create crosshair element
      const element = dom.createElement('div')
      element.id = 'crosshair'
      element.style.cssText = getCrosshairBaseCss()

      // Create crosshair lines (cross shape)
      const createLine = (isVertical: boolean) => {
        const line = dom.createElement('div')
        line.style.cssText = isVertical
          ? `
            position: absolute;
            background-color: white;
            width: 2px;
            height: 100%;
            left: 50%;
            transform: translateX(-50%);
          `
          : `
            position: absolute;
            background-color: white;
            height: 2px;
            width: 100%;
            top: 50%;
            transform: translateY(-50%);
          `
        return line
      }

      element.appendChild(createLine(true))  // Vertical
      element.appendChild(createLine(false)) // Horizontal

      const visibleRef = MutableRef.make(false)
      const pulseTimeoutRef = MutableRef.make<ReturnType<typeof setTimeout> | null>(null)

      const clearPulseTimer = () => {
        const pulseTimeout = MutableRef.get(pulseTimeoutRef)
        if (pulseTimeout === null) return
        clearTimeout(pulseTimeout)
        MutableRef.set(pulseTimeoutRef, null)
      }

      const resetPulse = () => {
        element.style.cssText = getCrosshairBaseCss()
        MutableRef.set(pulseTimeoutRef, null)
      }

      return {
        show: (): Effect.Effect<void, never> =>
          Effect.sync(() => {
            if (MutableRef.get(visibleRef)) return
            MutableRef.set(visibleRef, true)
            element.style.cssText = getCrosshairBaseCss()
            dom.appendChild(element)
          }),

        hide: (): Effect.Effect<void, never> =>
          Effect.sync(() => {
            if (!MutableRef.get(visibleRef)) return
            MutableRef.set(visibleRef, false)
            clearPulseTimer()
            element.style.cssText = getCrosshairBaseCss()
            if (Option.isSome(dom.getParentNode(element))) dom.removeChild(element)
          }),

        toggle: (): Effect.Effect<void, never> =>
          Effect.sync(() => {
            const wasVisible = MutableRef.get(visibleRef)
            MutableRef.set(visibleRef, !wasVisible)
            if (wasVisible) {
              clearPulseTimer()
              element.style.cssText = getCrosshairBaseCss()
              dom.removeChild(element)
            } else {
              element.style.cssText = getCrosshairBaseCss()
              dom.appendChild(element)
            }
          }),

        pulse: (): Effect.Effect<void, never> =>
          Effect.sync(() => {
            if (!MutableRef.get(visibleRef)) return
            clearPulseTimer()
            element.style.cssText = getCrosshairPulseCss()
            MutableRef.set(pulseTimeoutRef, setTimeout(resetPulse, CROSSHAIR_PULSE_MS))
          }),

        isVisible: (): Effect.Effect<boolean, never> => Effect.sync(() => MutableRef.get(visibleRef)),
      }
    }),
  }
) {}
