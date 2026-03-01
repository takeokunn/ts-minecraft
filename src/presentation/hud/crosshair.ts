import { Effect, Layer } from 'effect'

// DOM abstraction for testability
export class DomOperations extends Effect.Service<DomOperations>()(
  '@minecraft/layer/DomOperations',
  {
    effect: Effect.sync(() => ({
      createElement: (tagName: string): HTMLElement => document.createElement(tagName),
      appendChild: (element: HTMLElement): void => { document.body.appendChild(element) },
      removeChild: (element: HTMLElement): void => {
        if (element.parentNode) {
          element.parentNode.removeChild(element)
        }
      },
      getParentNode: (element: HTMLElement): HTMLElement | null =>
        element.parentNode as HTMLElement | null,
    }))
  }
) {}

export class Crosshair extends Effect.Service<Crosshair>()(
  '@minecraft/layer/Crosshair',
  {
    effect: Effect.gen(function* () {
      const dom = yield* DomOperations

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

      let visible = false

      return {
        show: (): Effect.Effect<void, never> =>
          Effect.sync(() => {
            if (!visible) {
              dom.appendChild(element)
              visible = true
            }
          }),

        hide: (): Effect.Effect<void, never> =>
          Effect.sync(() => {
            if (visible && dom.getParentNode(element)) {
              dom.removeChild(element)
              visible = false
            }
          }),

        toggle: (): Effect.Effect<void, never> =>
          Effect.sync(() => {
            if (visible) {
              dom.removeChild(element)
              visible = false
            } else {
              dom.appendChild(element)
              visible = true
            }
          }),

        isVisible: (): Effect.Effect<boolean, never> => Effect.sync(() => visible),
      }
    }),
    dependencies: [DomOperations.Default],
  }
) {}
export { Crosshair as CrosshairLive }
export { DomOperations as DomOperationsLive }
