import { Cause, Duration, Effect, Fiber, MutableRef, Option, Schedule, Scope } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { SettingsOverlayService } from '@ts-minecraft/presentation/settings/settings-overlay'
import { ConfirmDialogService } from '@ts-minecraft/presentation/menu/confirm-dialog'
import {
  type SessionControl,
  requestQuitToTitle,
  setPaused,
} from '@ts-minecraft/app/main/session-control'
import { SAVE_QUIT_CONFIRM_MESSAGE } from './pause-menu-styles'
import { buildPauseMenuDOM } from './pause-menu-dom'
import type { PauseMenuDom } from './pause-menu-types'

// FR-1.4/FR-1.10/FR-1.12 — in-session pause menu. Opened by OPEN_MENU_KEY (the frame-handler
// input stage calls `openIfClosed`); ESC is decoupled and only releases the pointer lock during
// play. Once the menu IS open, the keyboard listener owns ESC presses (ESC resumes/backs out)
// to avoid racing `consumeKeyPress`. Settings button hides this menu and re-shows it when
// settings closes.

export class PauseMenuService extends Effect.Service<PauseMenuService>()(
  '@minecraft/presentation/PauseMenu',
  {
    scoped: Effect.gen(function* () {
      const dom = yield* DomOperationsService
      const settingsOverlay = yield* SettingsOverlayService
      const confirmDialog = yield* ConfirmDialogService
      const { backdropEl, resumeBtn, settingsBtn, saveQuitBtn } = yield* Effect.acquireRelease(
        Effect.sync((): PauseMenuDom => buildPauseMenuDOM(dom)),
        ({ backdropEl }) =>
          Effect.sync(() => {
            Option.map(backdropEl, (el) => {
              Option.map(dom.getParentNode(el), () => dom.removeChild(el))
            })
          }),
      )

      const isOpenRef = MutableRef.make(false)
      // Active SessionControl set by `attach`; cleared when the attach
      // scope closes. `openIfClosed` reads this so the frame-handler
      // input stage doesn't have to thread the control through.
      const activeControlRef = MutableRef.make<Option.Option<SessionControl>>(Option.none())

      const showMenu = (): void => {
        Option.map(backdropEl, (el) => { el.style.display = 'flex' })
        // Default-focus Resume so Enter resumes immediately.
        Option.map(resumeBtn, (btn) => btn.focus())
      }

      const hideMenu = (): void => {
        Option.map(backdropEl, (el) => { el.style.display = 'none' })
      }

      return {
        // Scope-managed: listeners and DOM are torn down when the surrounding scoped Effect closes.
        attach: (
          control: SessionControl,
        ): Effect.Effect<void, never, Scope.Scope> =>
          Effect.gen(function* () {
            yield* Effect.acquireRelease(
              Effect.sync(() => {
                MutableRef.set(activeControlRef, Option.some(control))

                const handleResumeClick = (): void => {
                  if (!MutableRef.get(isOpenRef)) return
                  MutableRef.set(isOpenRef, false)
                  hideMenu()
                  setPaused(control, false)
                }

                const isSettingsOverlayVisible = (): boolean => {
                  if (typeof document === 'undefined') return false
                  const settingsEl = document.getElementById('settings-overlay')
                  return settingsEl?.style.display === 'block'
                }

                // Watchdog fiber: checks every 100ms whether the settings overlay
                // has closed while we were waiting, and re-shows the pause menu.
                // Stored so it can be interrupted when settings are not open or
                // when the attach scope closes.
                const watchdogFiberRef = MutableRef.make<Option.Option<Fiber.RuntimeFiber<number, never>>>(Option.none())

                const stopWatchdog = (): Effect.Effect<void, never> =>
                  Effect.gen(function* () {
                    const fiberOpt = Option.getOrNull(MutableRef.get(watchdogFiberRef))
                    MutableRef.set(watchdogFiberRef, Option.none())
                    if (fiberOpt !== null) yield* Fiber.interrupt(fiberOpt)
                  })

                const startWatchdog = (): Effect.Effect<void, never> =>
                  Effect.gen(function* () {
                    // Interrupt any existing watchdog before starting a new one.
                    yield* stopWatchdog()
                    const fiber = yield* Effect.gen(function* () {
                      const isSettingsOpen = yield* settingsOverlay.isOpen()
                      if (!isSettingsOpen && MutableRef.get(isOpenRef)) {
                        yield* Effect.sync(() => { showMenu() })
                        yield* stopWatchdog()
                      }
                    }).pipe(
                      Effect.catchAllCause(() => Effect.void),
                      Effect.repeat(Schedule.spaced(Duration.millis(100))),
                      // forkDaemon: the watchdog must outlive the ephemeral Effect.runFork call
                      // that invoked openSettingsFromMenu. Effect.fork would tie the fiber's
                      // lifetime to that parent scope, which resolves immediately, interrupting
                      // the watchdog before it polls even once. The acquireRelease finalizer
                      // in `attach` calls Fiber.interrupt(fiber) for proper cleanup.
                      Effect.forkDaemon,
                    )
                    MutableRef.set(watchdogFiberRef, Option.some(fiber))
                  })

                const openSettingsFromMenu = (): void => {
                  // Hide pause menu, open settings overlay. When settings
                  // closes (its own toggle/handler), we re-show pause menu
                  // via the watchdog fiber below.
                  hideMenu()
                  Effect.runFork(
                    Effect.gen(function* () {
                      const open = yield* settingsOverlay.isOpen()
                      if (!open) yield* settingsOverlay.toggle()
                      yield* startWatchdog()
                    }).pipe(
                      Effect.catchAllCause((cause) =>
                        Effect.logError(`Pause→Settings open error: ${Cause.pretty(cause)}`),
                      ),
                    ),
                  )
                }

                const handleSettingsClick = (): void => {
                  if (!MutableRef.get(isOpenRef)) return
                  openSettingsFromMenu()
                }

                const handleSaveQuitClick = (): void => {
                  if (!MutableRef.get(isOpenRef)) return
                  // Hide pause menu while dialog is open so the dialog
                  // owns the visible focus. We keep isOpenRef true so a
                  // stray Esc routes through the dialog's own handler.
                  hideMenu()
                  Effect.runFork(
                    Effect.gen(function* () {
                      const confirmed = yield* confirmDialog.show(SAVE_QUIT_CONFIRM_MESSAGE, 'Save & Quit', 'Cancel')
                      if (confirmed) {
                        yield* Effect.sync(() => { MutableRef.set(isOpenRef, false) })
                        // Session teardown already performs the authoritative
                        // save flush after the quit signal is observed. Signaling
                        // first avoids blocking the title transition on a redundant
                        // pre-quit save path here.
                        yield* requestQuitToTitle(control)
                      } else {
                        yield* Effect.sync(() => { if (MutableRef.get(isOpenRef)) showMenu() })
                      }
                    }).pipe(
                      Effect.catchAllCause((cause) =>
                        Effect.logError(`Save & Quit dialog error: ${Cause.pretty(cause)}`),
                      ),
                    ),
                  )
                }

                // Keyboard handler — only acts while menu is open.
                const handleKeyDown = (event: KeyboardEvent): void => {
                  if (!MutableRef.get(isOpenRef)) return
                  if (event.key === 'Escape') {
                    if (isSettingsOverlayVisible()) return
                    event.preventDefault()
                    event.stopPropagation()
                    handleResumeClick()
                  } else if (event.key === 'Enter') {
                    // Let the button's native Enter activation handle it
                    // — but stop propagation so it doesn't bleed into the
                    // game's input service.
                    event.stopPropagation()
                  } else if (event.key === 'Tab') {
                    // Browser default tab cycling between visible buttons
                    // is sufficient; we just guard against escape into
                    // the rest of the page.
                    event.stopPropagation()
                  }
                }

                Option.map(resumeBtn, (btn) => btn.addEventListener('click', handleResumeClick))
                Option.map(settingsBtn, (btn) => btn.addEventListener('click', handleSettingsClick))
                Option.map(saveQuitBtn, (btn) => btn.addEventListener('click', handleSaveQuitClick))
                if (typeof document !== 'undefined') {
                  document.addEventListener('keydown', handleKeyDown, true)
                }

                return {
                  handleResumeClick,
                  handleSettingsClick,
                  handleSaveQuitClick,
                  handleKeyDown,
                  watchdogFiberRef,
                }
              }),
              (handlers) =>
                Effect.gen(function* () {
                  Option.map(resumeBtn, (btn) => btn.removeEventListener('click', handlers.handleResumeClick))
                  Option.map(settingsBtn, (btn) => btn.removeEventListener('click', handlers.handleSettingsClick))
                  Option.map(saveQuitBtn, (btn) => btn.removeEventListener('click', handlers.handleSaveQuitClick))
                  if (typeof document !== 'undefined') {
                    document.removeEventListener('keydown', handlers.handleKeyDown, true)
                  }
                  // Interrupt any active watchdog fiber before tearing down.
                  const fiberOpt = Option.getOrNull(MutableRef.get(handlers.watchdogFiberRef))
                  if (fiberOpt !== null) yield* Fiber.interrupt(fiberOpt)
                  // Hide the menu in case the scope closes while it's open
                  // (e.g. the session is torn down by quit-to-title).
                  hideMenu()
                  MutableRef.set(isOpenRef, false)
                  MutableRef.set(activeControlRef, Option.none())
                }),
            )
          }),

        // Sets session pause flag synchronously so frame stages skip simulation on the same tick.
        // No-op when no SessionControl is attached (called outside session).
        openIfClosed: (): Effect.Effect<void, never> =>
          Effect.sync(() => {
            if (MutableRef.get(isOpenRef)) return
            Option.map(MutableRef.get(activeControlRef), (control) => {
              MutableRef.set(isOpenRef, true)
              setPaused(control, true)
              showMenu()
            })
          }),

        isOpen: (): Effect.Effect<boolean, never> =>
          Effect.sync(() => MutableRef.get(isOpenRef)),
      }
    }),
  },
) {}

export const PauseMenuLive = PauseMenuService.Default
