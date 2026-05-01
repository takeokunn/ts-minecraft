import { Deferred, Effect, Option } from 'effect'
import { DomOperationsService } from '@/presentation/hud/crosshair'

/**
 * Reusable modal confirmation dialog.
 *
 * Lifecycle: each `show()` call constructs a fresh DOM overlay (so multiple
 * dialogs cannot collide), wires keyboard/click handlers, and tears the DOM
 * down via `Effect.acquireRelease`'s finalizer when the user resolves the
 * dialog (Enter / button click) or dismisses it (Escape / cancel click).
 *
 * Returns `true` on confirm, `false` on cancel/Esc. Never fails.
 *
 * Used by:
 *   - PauseMenuService — "Save & Quit" confirmation (FR-1.4)
 *   - W2a MainMenuService — world-delete confirmation (planned reuse)
 *
 * Higher z-index (1100) than the pause menu (1050) so it stacks visually
 * above any caller's overlay.
 */
const DIALOG_Z_INDEX = 1100

const BACKDROP_STYLE = [
  'position:fixed',
  'top:0',
  'left:0',
  'width:100vw',
  'height:100vh',
  'background:rgba(0,0,0,0.6)',
  'display:flex',
  'align-items:center',
  'justify-content:center',
  `z-index:${DIALOG_Z_INDEX}`,
  'font-family:monospace',
].join(';')

const PANEL_STYLE = [
  'background:rgba(20,20,20,0.96)',
  'color:#fff',
  'padding:24px 32px',
  'border-radius:8px',
  'min-width:320px',
  'max-width:480px',
  'border:1px solid #4d4d4d',
  'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
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
  'padding:8px 20px',
  'border:none',
  'border-radius:4px',
  'cursor:pointer',
  'font-family:monospace',
  'font-size:13px',
  'min-width:80px',
].join(';')

const BUTTON_CANCEL_STYLE = `${BUTTON_BASE_STYLE};background:#555;color:#fff`
const BUTTON_CONFIRM_STYLE = `${BUTTON_BASE_STYLE};background:#a04040;color:#fff`

export class ConfirmDialogService extends Effect.Service<ConfirmDialogService>()(
  '@minecraft/presentation/ConfirmDialog',
  {
    effect: Effect.flatMap(DomOperationsService, (dom) =>
      Effect.succeed({
        /**
         * Display a modal confirmation dialog and await the user's choice.
         *
         * Returns `true` if the user clicks the confirm button or presses Enter,
         * `false` if the user clicks the cancel button or presses Escape.
         *
         * In SSR / non-DOM environments the dialog short-circuits to `false`.
         */
        show: (
          message: string,
          confirmLabel: string,
          cancelLabel: string = 'Cancel',
        ): Effect.Effect<boolean, never> =>
          Effect.gen(function* () {
            if (typeof document === 'undefined') {
              return false
            }

            const result = yield* Deferred.make<boolean, never>()

            // Build DOM ----------------------------------------------------
            const backdrop = dom.createElement('div')
            backdrop.className = 'confirm-dialog-backdrop'
            backdrop.style.cssText = BACKDROP_STYLE

            const panel = dom.createElement('div')
            panel.style.cssText = PANEL_STYLE
            panel.setAttribute('role', 'dialog')
            panel.setAttribute('aria-modal', 'true')

            const messageEl = dom.createElement('div')
            messageEl.style.cssText = MESSAGE_STYLE
            messageEl.textContent = message
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

            // Handlers — close over `result` Deferred. Idempotent (Deferred only
            // fulfills once), so if user clicks then presses Esc the second
            // signal is silently dropped. `unsafeDone` synchronously wakes any
            // awaiter — necessary inside DOM event listeners, where running
            // an Effect via `runFork` would defer completion past the awaiter
            // expecting an immediate resolution.
            const settle = (value: boolean): void => {
              Deferred.unsafeDone(result, Effect.succeed(value))
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
            return yield* Effect.acquireRelease(
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
                  Option.match(dom.getParentNode(backdrop), {
                    onNone: () => {},
                    onSome: () => dom.removeChild(backdrop),
                  })
                }),
            ).pipe(
              Effect.andThen(Deferred.await(result)),
              Effect.scoped,
            )
          }),
      }),
    ),
  },
) {}

export const ConfirmDialogLive = ConfirmDialogService.Default
