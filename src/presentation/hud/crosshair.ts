import { Effect, Option, Ref } from 'effect'

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
      getParentNode: (element: HTMLElement): Option.Option<HTMLElement> =>
        Option.fromNullable(element.parentNode as HTMLElement | null),
      setInnerHTML: (element: HTMLElement, html: string): void => { element.innerHTML = html },
      querySelector: <T extends HTMLElement>(element: HTMLElement, selector: string): Option.Option<T> =>
        Option.fromNullable(element.querySelector<T>(selector)),
    })
  }
) {}
export class CrosshairService extends Effect.Service<CrosshairService>()(
  '@minecraft/presentation/Crosshair',
  {
    effect: Effect.flatMap(DomOperationsService, (dom) => {
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

      return Ref.make(false).pipe(Effect.map((visibleRef) => ({
        // Ref.modify returns the OLD state atomically, then the side-effect runs on that old value.
        // This eliminates the Ref.get → Ref.set TOCTOU window.
        show: (): Effect.Effect<void, never> =>
          Ref.modify(visibleRef, (vis) => [vis, true] as const).pipe(
            Effect.flatMap((wasVisible) =>
              wasVisible ? Effect.void : Effect.sync(() => dom.appendChild(element))
            )
          ),

        hide: (): Effect.Effect<void, never> =>
          Ref.modify(visibleRef, (vis) => [vis, false] as const).pipe(
            Effect.flatMap((wasVisible) =>
              !wasVisible ? Effect.void : Option.match(dom.getParentNode(element), {
                onSome: () => Effect.sync(() => dom.removeChild(element)),
                onNone: () => Effect.void,
              })
            )
          ),

        toggle: (): Effect.Effect<void, never> =>
          Ref.modify(visibleRef, (vis) => [vis, !vis] as const).pipe(
            Effect.tap((wasVisible) => Effect.sync(() => {
              if (wasVisible) dom.removeChild(element)
              else dom.appendChild(element)
            })),
            Effect.asVoid,
          ),

        isVisible: (): Effect.Effect<boolean, never> => Ref.get(visibleRef),
      })))
    }),
  }
) {}
export const CrosshairLive = CrosshairService.Default
export const DomOperationsLive = DomOperationsService.Default
