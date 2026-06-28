import { Effect, Option } from 'effect'
import { MutableRef } from 'effect'

import { DomOperationsService } from './crosshair'

const controlsHintDismissedStorageKey = 'minecraft-controls-hint-dismissed'

const readDismissedFlag = (): boolean => {
  try {
    return globalThis.localStorage?.getItem(controlsHintDismissedStorageKey) === '1'
  } catch {
    return false
  }
}

const persistDismissedFlag = (): void => {
  try {
    globalThis.localStorage?.setItem(controlsHintDismissedStorageKey, '1')
  } catch {
    return
  }
}

export class ControlsHintService extends Effect.Service<ControlsHintService>()(
  '@minecraft/presentation/ControlsHint',
  {
    scoped: Effect.gen(function* () {
      const dom = yield* DomOperationsService
      const visibleRef = MutableRef.make(false)
      const dismissedRef = MutableRef.make(readDismissedFlag())

      const { element, hideButton } = yield* Effect.acquireRelease(
        Effect.sync(() => {
          const element = dom.createElement('section')
          element.id = 'controls-hint'
          element.setAttribute('role', 'note')
          element.setAttribute('aria-label', 'Quick controls help')
          element.style.cssText = [
            'position:fixed',
            'left:16px',
            'bottom:16px',
            'max-width:min(360px,calc(100vw - 32px))',
            'padding:12px 56px 12px 14px',
            'border:1px solid rgba(255,255,255,0.16)',
            'border-radius:12px',
            'background:rgba(10,14,18,0.88)',
            'box-shadow:0 12px 30px rgba(0,0,0,0.32)',
            'color:#f3f6f8',
            'font-size:13px',
            'line-height:1.45',
            'z-index:1300',
            'pointer-events:none',
          ].join(';')

          dom.setInnerHTML(element, `
            <strong style="display:block;margin:0 0 6px;font-size:14px;letter-spacing:0.04em">Quick Controls</strong>
            <p style="margin:0 0 6px">Move with WASD or the left stick, look with the mouse or right stick, and jump with Space or a face button.</p>
            <p style="margin:0">Break and place blocks with click or triggers. Press Esc to pause. Keyboard, mouse, and gamepad are supported.</p>
          `)

          const hideButton = dom.createElement('button')
          hideButton.type = 'button'
          hideButton.textContent = 'Hide'
          hideButton.setAttribute('aria-label', 'Hide quick controls help')
          hideButton.style.cssText = [
            'position:absolute',
            'top:10px',
            'right:10px',
            'pointer-events:auto',
            'border:1px solid rgba(255,255,255,0.18)',
            'border-radius:999px',
            'background:rgba(255,255,255,0.12)',
            'color:#f3f6f8',
            'padding:4px 10px',
            'font-size:12px',
            'line-height:1',
            'cursor:pointer',
          ].join(';')
          dom.appendChildTo(element, hideButton)
          return { element, hideButton }
        }),
        ({ element }) =>
          Effect.sync(() => {
            MutableRef.set(visibleRef, false)
            if (Option.isSome(dom.getParentNode(element))) dom.removeChild(element)
          }),
      )

      const dismissElement = (): void => {
        if (MutableRef.get(dismissedRef)) return
        MutableRef.set(dismissedRef, true)
        persistDismissedFlag()
      }

      const hideElement = (): void => {
        dismissElement()
        if (!MutableRef.get(visibleRef)) return
        MutableRef.set(visibleRef, false)
        if (Option.isSome(dom.getParentNode(element))) dom.removeChild(element)
      }

      const toggleElement = (): void => {
        const wasVisible = MutableRef.get(visibleRef)
        if (!wasVisible && MutableRef.get(dismissedRef)) return
        MutableRef.set(visibleRef, !wasVisible)
        if (wasVisible) dom.removeChild(element)
        else dom.appendChild(element)
      }

      hideButton.addEventListener('click', hideElement)
      return {
        show: (): Effect.Effect<void, never> =>
          Effect.sync(() => {
            if (MutableRef.get(visibleRef) || MutableRef.get(dismissedRef)) return
            MutableRef.set(visibleRef, true)
            dom.appendChild(element)
          }),

        hide: (): Effect.Effect<void, never> =>
          Effect.sync(hideElement),

        toggle: (): Effect.Effect<void, never> =>
          Effect.sync(toggleElement),

        isVisible: (): Effect.Effect<boolean, never> => Effect.sync(() => MutableRef.get(visibleRef)),
      }
    }),
  },
) {}
