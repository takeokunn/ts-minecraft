import { Deferred, Effect, Option } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'

// Each show() builds a fresh DOM overlay (no collision with concurrent dialogs).
// Higher z-index (6000) than main menu overlay (5000) and pause menu (1050) so dialogs always stack above their caller.
const DIALOG_Z_INDEX = 6000
let nextDialogId = 0

// Same classic-Minecraft treatment as the main menu (see main-menu-styles.ts):
// dark panel, bevelled buttons, system-ui.
const SANS_FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif'

const BACKDROP_STYLE = [
  'position:fixed',
  'inset:0',
  'box-sizing:border-box',
  'padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))',
  'background:rgba(0,0,0,0.6)',
  'display:flex',
  'align-items:center',
  'justify-content:center',
  `z-index:${DIALOG_Z_INDEX}`,
  `font-family:${SANS_FONT}`,
].join(';')

const PANEL_STYLE = [
  'box-sizing:border-box',
  'width:100%',
  'background:rgba(30,30,30,0.96)',
  'color:#e0e0e0',
  'padding:24px 28px',
  'min-width:0',
  'max-width:480px',
  'max-height:100%',
  'overflow:auto',
  'border:2px solid #000',
  'box-shadow:inset 2px 2px 0 rgba(255,255,255,0.15),inset -2px -2px 0 rgba(0,0,0,0.5),0 12px 28px rgba(0,0,0,0.55)',
  'text-shadow:1px 1px 0 #1a1a1a',
].join(';')

const MESSAGE_STYLE = [
  'font-size:14px',
  'line-height:1.5',
  'margin-bottom:20px',
  'white-space:pre-wrap',
].join(';')

const BUTTON_ROW_STYLE = [
  'display:flex',
  'gap:12px',
  'justify-content:flex-end',
].join(';')

const BUTTON_BASE_STYLE = [
  'box-sizing:border-box',
  'padding:9px 20px',
  'min-height:40px',
  'border:2px solid #000',
  'border-radius:0',
  'cursor:pointer',
  `font-family:${SANS_FONT}`,
  'font-size:14px',
  'font-weight:600',
  'min-width:96px',
  'text-shadow:1px 1px 0 #383838',
  'box-shadow:inset 2px 2px 0 rgba(255,255,255,0.3),inset -2px -2px 0 rgba(0,0,0,0.38)',
].join(';')

// WCAG AA: white on the darker gradient (5.36:1 lightest stop); #e0e0e0-on-#7e7e7e was 3.92:1.
const BUTTON_CANCEL_STYLE = `${BUTTON_BASE_STYLE};background-color:#5c5c5c;background-image:linear-gradient(180deg,#6d6d6d 0%,#5c5c5c 52%,#4a4a4a 100%);color:#ffffff`
const BUTTON_CONFIRM_STYLE = `${BUTTON_BASE_STYLE};background-color:#8f3a3a;background-image:linear-gradient(180deg,#a24a4a 0%,#8f3a3a 52%,#7a2f2f 100%);color:#ffffff;text-shadow:1px 1px 0 #3a1414`

export class ConfirmDialogService extends Effect.Service<ConfirmDialogService>()(
  '@minecraft/presentation/ConfirmDialog',
  {
    effect: Effect.gen(function* () {
      const dom = yield* DomOperationsService
      return {
        // Short-circuits to false in SSR / non-DOM environments.
        show: (
          message: string,
          confirmLabel: string,
          cancelLabel: string = 'Cancel',
          onConfirm?: () => void,
        ): Effect.Effect<boolean, never> =>
          Effect.gen(function* () {
            if (typeof document === 'undefined') {
              return false
            }

            const result = yield* Deferred.make<boolean, never>()
            const previouslyFocused = document.activeElement as HTMLElement | null

            // Build DOM ----------------------------------------------------
            const backdrop = dom.createElement('div')
            backdrop.className = 'confirm-dialog-backdrop'
            backdrop.style.cssText = BACKDROP_STYLE

            const panel = dom.createElement('div')
            panel.style.cssText = PANEL_STYLE
            panel.setAttribute('role', 'dialog')
            panel.setAttribute('aria-modal', 'true')

            const messageEl = dom.createElement('div')
            messageEl.id = `confirm-dialog-message-${nextDialogId++}`
            messageEl.style.cssText = MESSAGE_STYLE
            messageEl.textContent = message
            panel.setAttribute('aria-labelledby', messageEl.id)
            dom.appendChildTo(panel, messageEl)

            const row = dom.createElement('div')
            row.style.cssText = BUTTON_ROW_STYLE

            const cancelBtn = dom.createElement('button')
            cancelBtn.textContent = cancelLabel
            cancelBtn.style.cssText = BUTTON_CANCEL_STYLE
            cancelBtn.dataset['role'] = 'cancel'

            const confirmBtn = dom.createElement('button')
            confirmBtn.textContent = confirmLabel
            confirmBtn.style.cssText = BUTTON_CONFIRM_STYLE
            confirmBtn.dataset['role'] = 'confirm'

            dom.appendChildTo(row, cancelBtn)
            dom.appendChildTo(row, confirmBtn)
            dom.appendChildTo(panel, row)
            dom.appendChildTo(backdrop, panel)
            dom.appendChild(backdrop)

            // Focus the confirm button by default (Enter activates it).
            confirmBtn.focus()

            // Handlers close over `result` Deferred. Completion is idempotent, so
            // duplicate click/key signals are ignored after the first value wins.
            // Use the Effect runtime to resume the fiber waiting on `Deferred.await`.
            const settle = (value: boolean): void => {
              if (value) onConfirm?.()
              Effect.runFork(Deferred.succeed(result, value).pipe(Effect.asVoid))
            }

            const handleConfirmClick = () => settle(true)
            const handleCancelClick = () => settle(false)

            const handleKeyDown = (event: KeyboardEvent) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.stopPropagation()
                settle(true)
              } else if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                settle(false)
              } else if (event.key === 'Tab') {
                // Cycle focus between cancel and confirm.
                event.preventDefault()
                const active = document.activeElement
                if (active === confirmBtn) cancelBtn.focus()
                else confirmBtn.focus()
              }
            }

            // Backdrop click (not panel click) cancels.
            const handleBackdropClick = (event: MouseEvent) => {
              if (event.target === backdrop) {
                settle(false)
              }
            }

            // Acquire/release pairs listener+DOM lifecycle with the await —
            // finalizer runs even if the awaiter is interrupted.
            yield* Effect.acquireRelease(
              Effect.sync(() => {
                confirmBtn.addEventListener('click', handleConfirmClick)
                cancelBtn.addEventListener('click', handleCancelClick)
                backdrop.addEventListener('click', handleBackdropClick)
                document.addEventListener('keydown', handleKeyDown, true)
              }),
              () =>
                Effect.sync(() => {
                  confirmBtn.removeEventListener('click', handleConfirmClick)
                  cancelBtn.removeEventListener('click', handleCancelClick)
                  backdrop.removeEventListener('click', handleBackdropClick)
                  document.removeEventListener('keydown', handleKeyDown, true)
                  Option.map(dom.getParentNode(backdrop), () => dom.removeChild(backdrop))
                  if (previouslyFocused?.isConnected !== false) previouslyFocused?.focus()
                }),
            )
            return yield* Deferred.await(result)
          }).pipe(Effect.scoped),
      }
    }),
  },
) {}
