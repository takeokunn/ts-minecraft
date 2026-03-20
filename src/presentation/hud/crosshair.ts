import { Effect, Ref } from 'effect'

// DOM abstraction for testability
export class DomOperationsService extends Effect.Service<DomOperationsService>()(
  '@minecraft/presentation/DomOperations',
  {
    effect: Effect.succeed({
      createElement: (tagName: string): HTMLElement => document.createElement(tagName),
      appendChild: (element: HTMLElement): void => { document.body.appendChild(element) },
      appendChildTo: (parent: HTMLElement, child: HTMLElement): void => { parent.appendChild(child) },
      removeChild: (element: HTMLElement): void => {
        if (element.parentNode) {
          element.parentNode.removeChild(element)
        }
      },
      getParentNode: (element: HTMLElement): HTMLElement | null =>
        element.parentNode as HTMLElement | null,
      setInnerHTML: (element: HTMLElement, html: string): void => { element.innerHTML = html },
      querySelector: <T extends HTMLElement>(element: HTMLElement, selector: string): T | null =>
        element.querySelector<T>(selector),
    })
  }
) {}
export class CrosshairService extends Effect.Service<CrosshairService>()(
  '@minecraft/presentation/Crosshair',
  {
    effect: Effect.gen(function* () {
      const dom = yield* DomOperationsService

      // Create crosshair element
      const element = dom.createElement('div') as HTMLDivElement
      element.id = 'crosshair'
      element.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 20px;
        height: 20px;
        pointer-events: none;
        z-index: 1000;
      `

      // Create crosshair lines (cross shape)
      const createLine = (isVertical: boolean) => {
        const line = dom.createElement('div') as HTMLDivElement
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

      const visibleRef = yield* Ref.make(false)

      return {
        show: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const vis = yield* Ref.get(visibleRef)
            if (!vis) {
              dom.appendChild(element)
              yield* Ref.set(visibleRef, true)
            }
          }),

        hide: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const vis = yield* Ref.get(visibleRef)
            if (vis && dom.getParentNode(element)) {
              dom.removeChild(element)
              yield* Ref.set(visibleRef, false)
            }
          }),

        toggle: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const vis = yield* Ref.get(visibleRef)
            if (vis) {
              dom.removeChild(element)
            } else {
              dom.appendChild(element)
            }
            yield* Ref.set(visibleRef, !vis)
          }),

        isVisible: (): Effect.Effect<boolean, never> => Ref.get(visibleRef),
      }
    }),
  }
) {}
export const CrosshairLive = CrosshairService.Default
export const DomOperationsLive = DomOperationsService.Default
