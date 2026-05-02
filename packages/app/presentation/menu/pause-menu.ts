import { Cause, Effect, MutableRef, Option, Scope } from 'effect'
import { DomOperationsService } from '@ts-minecraft/app/presentation/hud/crosshair'
import { SettingsOverlayService } from '@ts-minecraft/app/presentation/settings/settings-overlay'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { ConfirmDialogService } from '@ts-minecraft/app/presentation/menu/confirm-dialog'
import {
  type SessionControl,
  requestQuitToTitle,
  setPaused,
} from '@ts-minecraft/app/main/session-control'

// FR-1.4/FR-1.10/FR-1.12 — in-session pause menu. ESC from frame-handler input stage calls
// `openIfClosed`; once open, the keyboard listener owns further ESC presses to avoid racing
// `consumeKeyPress`. Settings button hides this menu and re-shows it when settings closes.
const Z_INDEX = 1050

const BACKDROP_STYLE = [
  'position:fixed',
  'top:0',
  'left:0',
  'width:100vw',
  'height:100vh',
  'background:rgba(0,0,0,0.55)',
  'display:none',
  'align-items:center',
  'justify-content:center',
  `z-index:${Z_INDEX}`,
  'font-family:monospace',
].join(';')

const PANEL_STYLE = [
  'background:rgba(20,20,20,0.92)',
  'color:#fff',
  'padding:32px 40px',
  'border-radius:10px',
  'min-width:280px',
  'border:1px solid #4d4d4d',
  'box-shadow:0 12px 48px rgba(0,0,0,0.6)',
  'display:flex',
  'flex-direction:column',
  'align-items:stretch',
  'gap:12px',
].join(';')

const TITLE_STYLE = [
  'font-size:22px',
  'font-weight:bold',
  'text-align:center',
  'margin-bottom:8px',
  'letter-spacing:2px',
].join(';')

const BUTTON_STYLE = [
  'padding:10px 16px',
  'background:#3a3a3a',
  'color:#fff',
  'border:1px solid #5a5a5a',
  'border-radius:4px',
  'cursor:pointer',
  'font-family:monospace',
  'font-size:14px',
  'min-width:200px',
  'text-align:center',
].join(';')

const SAVE_QUIT_CONFIRM_MESSAGE =
  'Save and return to title?\nLast 5s of progress will be flushed first.'

type PauseMenuDom = {
  readonly backdropEl: Option.Option<HTMLDivElement>
  readonly resumeBtn: Option.Option<HTMLButtonElement>
  readonly settingsBtn: Option.Option<HTMLButtonElement>
  readonly saveQuitBtn: Option.Option<HTMLButtonElement>
}

export class PauseMenuService extends Effect.Service<PauseMenuService>()(
  '@minecraft/presentation/PauseMenu',
  {
    scoped: Effect.flatMap(
      Effect.all(
        [DomOperationsService, SettingsOverlayService, ChunkManagerService, ConfirmDialogService],
        { concurrency: 'unbounded' },
      ),
      ([dom, settingsOverlay, chunkManager, confirmDialog]) =>
        Effect.acquireRelease(
          Effect.sync((): PauseMenuDom => {
            if (typeof document === 'undefined') {
              return {
                backdropEl: Option.none(),
                resumeBtn: Option.none(),
                settingsBtn: Option.none(),
                saveQuitBtn: Option.none(),
              }
            }

            const backdrop = dom.createElement('div')
            backdrop.id = 'pause-menu-backdrop'
            backdrop.style.cssText = BACKDROP_STYLE

            const panel = dom.createElement('div')
            panel.style.cssText = PANEL_STYLE
            panel.setAttribute('role', 'dialog')
            panel.setAttribute('aria-modal', 'true')
            panel.setAttribute('aria-label', 'Pause Menu')

            const title = dom.createElement('div')
            title.textContent = 'PAUSED'
            title.style.cssText = TITLE_STYLE
            dom.appendChildTo(panel, title)

            const resumeBtn = dom.createElement('button')
            resumeBtn.textContent = 'Resume'
            resumeBtn.style.cssText = BUTTON_STYLE
            resumeBtn.dataset['role'] = 'resume'
            dom.appendChildTo(panel, resumeBtn)

            const settingsBtn = dom.createElement('button')
            settingsBtn.textContent = 'Settings'
            settingsBtn.style.cssText = BUTTON_STYLE
            settingsBtn.dataset['role'] = 'settings'
            dom.appendChildTo(panel, settingsBtn)

            const saveQuitBtn = dom.createElement('button')
            saveQuitBtn.textContent = 'Save & Quit to Title'
            saveQuitBtn.style.cssText = BUTTON_STYLE
            saveQuitBtn.dataset['role'] = 'save-quit'
            dom.appendChildTo(panel, saveQuitBtn)

            dom.appendChildTo(backdrop, panel)
            dom.appendChild(backdrop)

            return {
              backdropEl: Option.some(backdrop),
              resumeBtn: Option.some(resumeBtn),
              settingsBtn: Option.some(settingsBtn),
              saveQuitBtn: Option.some(saveQuitBtn),
            }
          }),
          ({ backdropEl }) =>
            Effect.sync(() => {
              Option.match(backdropEl, {
                onNone: () => {},
                onSome: (el) => {
                  Option.match(dom.getParentNode(el), {
                    onNone: () => {},
                    onSome: () => dom.removeChild(el),
                  })
                },
              })
            }),
        ).pipe(
          Effect.map(({ backdropEl, resumeBtn, settingsBtn, saveQuitBtn }) => {
            const isOpenRef = MutableRef.make(false)
            // Active SessionControl set by `attach`; cleared when the attach
            // scope closes. `openIfClosed` reads this so the frame-handler
            // input stage doesn't have to thread the control through.
            const activeControlRef = MutableRef.make<Option.Option<SessionControl>>(Option.none())

            const showMenu = (): void => {
              Option.match(backdropEl, {
                onNone: () => {},
                onSome: (el) => {
                  el.style.display = 'flex'
                },
              })
              // Default-focus Resume so Enter resumes immediately.
              Option.match(resumeBtn, { onNone: () => {}, onSome: (btn) => btn.focus() })
            }

            const hideMenu = (): void => {
              Option.match(backdropEl, {
                onNone: () => {},
                onSome: (el) => {
                  el.style.display = 'none'
                },
              })
            }

            // Save failures are logged but do NOT prevent quit — user chose to leave,
            // and requestQuitToTitle is idempotent so a retry path remains.
            const performSaveAndQuit = (
              control: SessionControl,
              persistSessionState: () => Effect.Effect<void, unknown>,
            ): Effect.Effect<void, never> =>
              Effect.all(
                [
                  chunkManager.saveDirtyChunks(),
                  persistSessionState(),
                ],
                { concurrency: 'unbounded', discard: true },
              ).pipe(
                Effect.catchAllCause((cause) =>
                  Effect.logError(`Save & Quit save error: ${Cause.pretty(cause)}`),
                ),
                Effect.andThen(requestQuitToTitle(control)),
              )

            return {
              // Scope-managed: listeners and DOM are torn down when the surrounding scoped Effect closes.
              attach: (
                control: SessionControl,
                persistSessionState: () => Effect.Effect<void, unknown>,
              ): Effect.Effect<void, never, Scope.Scope> =>
                Effect.acquireRelease(
                  Effect.sync(() => {
                    MutableRef.set(activeControlRef, Option.some(control))
                    const handleResumeClick = (): void => {
                      if (!MutableRef.get(isOpenRef)) return
                      MutableRef.set(isOpenRef, false)
                      hideMenu()
                      setPaused(control, false)
                    }

                    const openSettingsFromMenu = (): void => {
                      // Hide pause menu, open settings overlay. When settings
                      // closes (its own toggle/handler), we re-show pause menu
                      // by listening for the next animation frame check below.
                      hideMenu()
                      Effect.runFork(
                        settingsOverlay.isOpen().pipe(
                          Effect.flatMap((open) =>
                            open ? Effect.void : settingsOverlay.toggle().pipe(Effect.asVoid),
                          ),
                          Effect.catchAllCause((cause) =>
                            Effect.logError(`Pause→Settings open error: ${Cause.pretty(cause)}`),
                          ),
                        ),
                      )
                      // Poll for settings close while we remain paused. The
                      // SettingsOverlayService handles its own Esc/close button;
                      // when it transitions back to !isOpen, we re-show ourselves.
                      const watchdog = (): void => {
                        if (!MutableRef.get(isOpenRef)) return
                        Effect.runFork(
                          settingsOverlay.isOpen().pipe(
                            Effect.tap((open) =>
                              Effect.sync(() => {
                                if (!open && MutableRef.get(isOpenRef)) {
                                  showMenu()
                                } else {
                                  // Re-poll on next frame.
                                  if (typeof requestAnimationFrame !== 'undefined') {
                                    requestAnimationFrame(watchdog)
                                  }
                                }
                              }),
                            ),
                            Effect.catchAllCause(() => Effect.void),
                          ),
                        )
                      }
                      if (typeof requestAnimationFrame !== 'undefined') {
                        requestAnimationFrame(watchdog)
                      }
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
                        confirmDialog
                          .show(SAVE_QUIT_CONFIRM_MESSAGE, 'Save & Quit', 'Cancel')
                          .pipe(
                            Effect.flatMap((confirmed) =>
                              confirmed
                                ? Effect.sync(() => {
                                    MutableRef.set(isOpenRef, false)
                                  }).pipe(
                                    Effect.andThen(performSaveAndQuit(control, persistSessionState)),
                                  )
                                : Effect.sync(() => {
                                    if (MutableRef.get(isOpenRef)) showMenu()
                                  }),
                            ),
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

                    Option.match(resumeBtn, {
                      onNone: () => {},
                      onSome: (btn) => btn.addEventListener('click', handleResumeClick),
                    })
                    Option.match(settingsBtn, {
                      onNone: () => {},
                      onSome: (btn) => btn.addEventListener('click', handleSettingsClick),
                    })
                    Option.match(saveQuitBtn, {
                      onNone: () => {},
                      onSome: (btn) => btn.addEventListener('click', handleSaveQuitClick),
                    })
                    if (typeof document !== 'undefined') {
                      document.addEventListener('keydown', handleKeyDown, true)
                    }

                    return {
                      handleResumeClick,
                      handleSettingsClick,
                      handleSaveQuitClick,
                      handleKeyDown,
                    }
                  }),
                  (handlers) =>
                    Effect.sync(() => {
                      Option.match(resumeBtn, {
                        onNone: () => {},
                        onSome: (btn) => btn.removeEventListener('click', handlers.handleResumeClick),
                      })
                      Option.match(settingsBtn, {
                        onNone: () => {},
                        onSome: (btn) => btn.removeEventListener('click', handlers.handleSettingsClick),
                      })
                      Option.match(saveQuitBtn, {
                        onNone: () => {},
                        onSome: (btn) => btn.removeEventListener('click', handlers.handleSaveQuitClick),
                      })
                      if (typeof document !== 'undefined') {
                        document.removeEventListener('keydown', handlers.handleKeyDown, true)
                      }
                      // Hide the menu in case the scope closes while it's open
                      // (e.g. the session is torn down by quit-to-title).
                      hideMenu()
                      MutableRef.set(isOpenRef, false)
                      MutableRef.set(activeControlRef, Option.none())
                    }),
                ).pipe(Effect.asVoid),

              // Sets session pause flag synchronously so frame stages skip simulation on the same tick.
              // No-op when no SessionControl is attached (called outside session).
              openIfClosed: (): Effect.Effect<void, never> =>
                Effect.sync(() => {
                  if (MutableRef.get(isOpenRef)) return
                  Option.match(MutableRef.get(activeControlRef), {
                    onNone: () => {},
                    onSome: (control) => {
                      MutableRef.set(isOpenRef, true)
                      setPaused(control, true)
                      showMenu()
                    },
                  })
                }),

              isOpen: (): Effect.Effect<boolean, never> =>
                Effect.sync(() => MutableRef.get(isOpenRef)),
            }
          }),
        ),
    ),
  },
) {}

export const PauseMenuLive = PauseMenuService.Default
