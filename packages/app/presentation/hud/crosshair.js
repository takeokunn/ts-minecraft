import { Effect, Option, Ref } from 'effect';
// DOM abstraction for testability
export class DomOperationsService extends Effect.Service()('@minecraft/presentation/DomOperations', {
    /* c8 ignore next 22 */
    effect: Effect.succeed({
        createElement: (tagName) => document.createElement(tagName),
        appendChild: (element) => { document.body.appendChild(element); },
        appendChildTo: (parent, child) => { parent.appendChild(child); },
        removeChild: (element) => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        },
        getParentNode: (element) => Option.fromNullable(element.parentElement),
        setInnerHTML: (element, html) => { element.innerHTML = html; },
        querySelector: (element, selector) => Option.fromNullable(element.querySelector(selector)),
    })
}) {
}
export class CrosshairService extends Effect.Service()('@minecraft/presentation/Crosshair', {
    effect: Effect.flatMap(DomOperationsService, (dom) => {
        // Create crosshair element
        const element = dom.createElement('div');
        element.id = 'crosshair';
        element.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 20px;
        height: 20px;
        pointer-events: none;
        z-index: 1000;
      `;
        // Create crosshair lines (cross shape)
        const createLine = (isVertical) => {
            const line = dom.createElement('div');
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
          `;
            return line;
        };
        element.appendChild(createLine(true)); // Vertical
        element.appendChild(createLine(false)); // Horizontal
        return Ref.make(false).pipe(Effect.map((visibleRef) => ({
            // Ref.modify returns the OLD state atomically, then the side-effect runs on that old value.
            // This eliminates the Ref.get → Ref.set TOCTOU window.
            show: () => Ref.modify(visibleRef, (vis) => [vis, true]).pipe(Effect.flatMap((wasVisible) => wasVisible ? Effect.void : Effect.sync(() => dom.appendChild(element)))),
            hide: () => Ref.modify(visibleRef, (vis) => [vis, false]).pipe(Effect.flatMap((wasVisible) => !wasVisible ? Effect.void : Option.match(dom.getParentNode(element), {
                onSome: () => Effect.sync(() => dom.removeChild(element)),
                onNone: () => Effect.void,
            }))),
            toggle: () => Ref.modify(visibleRef, (vis) => [vis, !vis]).pipe(Effect.tap((wasVisible) => Effect.sync(() => {
                if (wasVisible)
                    dom.removeChild(element);
                else
                    dom.appendChild(element);
            })), Effect.asVoid),
            isVisible: () => Ref.get(visibleRef),
        })));
    }),
}) {
}
export const CrosshairLive = CrosshairService.Default;
export const DomOperationsLive = DomOperationsService.Default;
//# sourceMappingURL=../../../../dist/packages/app/presentation/hud/crosshair.js.map