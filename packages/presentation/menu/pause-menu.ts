import { Cause, Duration, Effect, Fiber, MutableRef, Option, Schedule, Scope } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { SettingsOverlayService } from '@ts-minecraft/presentation/settings/settings-overlay'
import { ConfirmDialogService } from '@ts-minecraft/presentation/menu/confirm-dialog'
import { AchievementService } from '@ts-minecraft/entity/application/achievement-service'
import { StatisticsService } from '@ts-minecraft/entity/application/statistics-service'
import { ACHIEVEMENT_REGISTRY } from '@ts-minecraft/entity/domain/achievement/achievement-registry'
import { renderAchievementsPanelHtml } from './pause-menu-achievements'
import {
  type SessionControl,
  requestQuitToTitle,
  setPaused,
} from '@ts-minecraft/app/main/session-control'
import { SAVE_QUIT_CONFIRM_MESSAGE } from './pause-menu-styles'
import { buildPauseMenuDOM } from './pause-menu-dom'
import type { PauseMenuDom } from './pause-menu-types'
import { trapPauseMenuFocus, visiblePauseMenuControls } from './pause-menu-focus'

// FR-1.4/FR-1.10/FR-1.12 — in-session pause menu. Opened by Escape or
// OPEN_MENU_KEY through the frame-handler input stage. Once the menu is open,
// this keyboard listener owns Esc presses (resume/back out) to avoid racing
// `consumeKeyPress`. Settings hides this menu and re-shows it when settings closes.

export class PauseMenuService extends Effect.Service<PauseMenuService>()(
  '@minecraft/presentation/PauseMenu',
  {
    scoped: Effect.gen(function* () {
      const dom = yield* DomOperationsService
      const settingsOverlay = yield* SettingsOverlayService
      const confirmDialog = yield* ConfirmDialogService
      const achievementService = yield* AchievementService
      const statisticsService = yield* StatisticsService
      const {
        backdropEl,
        resumeBtn,
        settingsBtn,
        howToPlayBtn,
        howToPlayPanel,
        howToPlayCloseBtn,
        achievementsBtn,
        achievementsPanel,
        achievementsContentEl,
        achievementsCloseBtn,
        saveQuitBtn,
      } = yield* Effect.acquireRelease(
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
      const restoreFocusRef = MutableRef.make<Option.Option<HTMLElement>>(Option.none())

      const focusIfAvailable = (element: Element | null): boolean => {
        const focusable = element as (HTMLElement & { readonly focus?: () => void }) | null
        if (focusable === null || typeof focusable.focus !== 'function') return false
        if (focusable.isConnected === false) return false
        focusable.focus()
        return true
      }

      const captureFocusBeforeOpen = (): void => {
        if (typeof document === 'undefined') return
        const activeElement = document.activeElement
        const focusable = activeElement as (HTMLElement & { readonly focus?: () => void }) | null
        MutableRef.set(
          restoreFocusRef,
          focusable !== null && typeof focusable.focus === 'function'
            ? Option.some(focusable)
            : Option.none(),
        )
      }

      const restoreFocusAfterClose = (): void => {
        const previousFocus = Option.getOrNull(MutableRef.get(restoreFocusRef))
        MutableRef.set(restoreFocusRef, Option.none())
        if (focusIfAvailable(previousFocus)) return
        if (typeof document !== 'undefined') {
          focusIfAvailable(document.getElementById('game-canvas'))
        }
      }

      const isHowToPlayVisible = (): boolean => {
        const panel = Option.getOrNull(howToPlayPanel)
        return panel !== null && panel.style.display !== 'none'
      }

      const showHowToPlay = (): void => {
        Option.map(howToPlayPanel, (el) => { el.style.display = 'block' })
        Option.map(howToPlayCloseBtn, (btn) => btn.focus())
      }

      const hideHowToPlay = (): void => {
        Option.map(howToPlayPanel, (el) => { el.style.display = 'none' })
      }

      const isAchievementsVisible = (): boolean => {
        const panel = Option.getOrNull(achievementsPanel)
        return panel !== null && panel.style.display !== 'none'
      }

      // Rebuilds the content from live unlock + statistics state on every open.
      const showAchievements = (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const unlocked = yield* achievementService.getUnlocked()
          const stats = yield* statisticsService.getStatistics()
          yield* Effect.sync(() => {
            Option.map(achievementsContentEl, (el) => {
              el.innerHTML = renderAchievementsPanelHtml(ACHIEVEMENT_REGISTRY, new Set(unlocked), stats)
            })
            Option.map(achievementsPanel, (el) => { el.style.display = 'block' })
            Option.map(achievementsCloseBtn, (btn) => btn.focus())
          })
        })

      const hideAchievements = (): void => {
        Option.map(achievementsPanel, (el) => { el.style.display = 'none' })
      }

      // The floating settings gear is hidden during pointer-lock gameplay (see
      // main-menu.ts) and only surfaced while an overlay context — the pause menu —
      // is open, giving a visible route to Options alongside the menu's own entry.
      const setSettingsGearVisible = (visible: boolean): void => {
        if (typeof document === 'undefined') return
        const gear = document.getElementById('settings-gear-btn')
        if (gear !== null) gear.style.display = visible ? '' : 'none'
      }

      const showMenu = (): void => {
        Option.map(backdropEl, (el) => { el.style.display = 'flex' })
        setSettingsGearVisible(true)
        // Default-focus Resume so Enter resumes immediately.
        Option.map(resumeBtn, (btn) => btn.focus())
      }

      const hideMenu = (): void => {
        hideHowToPlay()
        hideAchievements()
        setSettingsGearVisible(false)
        Option.map(backdropEl, (el) => { el.style.display = 'none' })
      }

      const closeMenu = (): void => {
        hideMenu()
        restoreFocusAfterClose()
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
                  closeMenu()
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

                const handleHowToPlayClick = (): void => {
                  if (!MutableRef.get(isOpenRef)) return
                  showHowToPlay()
                }

                const handleHowToPlayCloseClick = (): void => {
                  if (!MutableRef.get(isOpenRef)) return
                  hideHowToPlay()
                  Option.map(howToPlayBtn, (btn) => btn.focus())
                }

                const handleAchievementsClick = (): void => {
                  if (!MutableRef.get(isOpenRef)) return
                  Effect.runFork(
                    showAchievements().pipe(
                      Effect.catchAllCause((cause) =>
                        Effect.logError(`Achievements panel error: ${Cause.pretty(cause)}`),
                      ),
                    ),
                  )
                }

                const handleAchievementsCloseClick = (): void => {
                  if (!MutableRef.get(isOpenRef)) return
                  hideAchievements()
                  Option.map(achievementsBtn, (btn) => btn.focus())
                }

                const handleSaveQuitClick = (): void => {
                  if (!MutableRef.get(isOpenRef)) return
                  // Hide pause menu while dialog is open so the dialog
                  // owns the visible focus. We keep isOpenRef true so a
                  // stray Esc routes through the dialog's own handler.
                  hideMenu()
                  const signalQuitToTitle = (): void => {
                    if (!MutableRef.get(isOpenRef)) return
                    MutableRef.set(isOpenRef, false)
                    Effect.runSync(requestQuitToTitle(control))
                  }
                  Effect.runFork(
                    Effect.gen(function* () {
                      const confirmed = yield* confirmDialog.show(
                        SAVE_QUIT_CONFIRM_MESSAGE,
                        'Save & Quit',
                        'Cancel',
                        signalQuitToTitle,
                      )
                      if (confirmed) {
                        // The dialog callback already sent the quit signal from
                        // the DOM event handler. Keep this branch idempotent for
                        // non-browser tests and future dialog implementations.
                        yield* Effect.sync(signalQuitToTitle)
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
                    if (isHowToPlayVisible()) {
                      handleHowToPlayCloseClick()
                      return
                    }
                    if (isAchievementsVisible()) {
                      handleAchievementsCloseClick()
                      return
                    }
                    handleResumeClick()
                  } else if (event.key === 'Enter') {
                    // Let the button's native Enter activation handle it
                    // — but stop propagation so it doesn't bleed into the
                    // game's input service.
                    event.stopPropagation()
                  } else if (event.key === 'Tab') {
                    if (isSettingsOverlayVisible()) return
                    event.stopPropagation()
                    trapPauseMenuFocus(
                      event,
                      visiblePauseMenuControls([
                        resumeBtn,
                        settingsBtn,
                        howToPlayBtn,
                        ...(isHowToPlayVisible() ? [howToPlayCloseBtn] : []),
                        achievementsBtn,
                        ...(isAchievementsVisible() ? [achievementsCloseBtn] : []),
                        saveQuitBtn,
                      ]),
                      typeof document === 'undefined' ? null : document.activeElement,
                    )
                  }
                }

                Option.map(resumeBtn, (btn) => btn.addEventListener('click', handleResumeClick))
                Option.map(settingsBtn, (btn) => btn.addEventListener('click', handleSettingsClick))
                Option.map(howToPlayBtn, (btn) => btn.addEventListener('click', handleHowToPlayClick))
                Option.map(howToPlayCloseBtn, (btn) =>
                  btn.addEventListener('click', handleHowToPlayCloseClick),
                )
                Option.map(achievementsBtn, (btn) => btn.addEventListener('click', handleAchievementsClick))
                Option.map(achievementsCloseBtn, (btn) => btn.addEventListener('click', handleAchievementsCloseClick))
                Option.map(saveQuitBtn, (btn) => btn.addEventListener('click', handleSaveQuitClick))
                if (typeof document !== 'undefined') {
                  document.addEventListener('keydown', handleKeyDown, true)
                }

                return {
                  handleResumeClick,
                  handleSettingsClick,
                  handleHowToPlayClick,
                  handleHowToPlayCloseClick,
                  handleAchievementsClick,
                  handleAchievementsCloseClick,
                  handleSaveQuitClick,
                  handleKeyDown,
                  watchdogFiberRef,
                }
              }),
              (handlers) =>
                Effect.gen(function* () {
                  Option.map(resumeBtn, (btn) => btn.removeEventListener('click', handlers.handleResumeClick))
                  Option.map(settingsBtn, (btn) => btn.removeEventListener('click', handlers.handleSettingsClick))
                  Option.map(howToPlayBtn, (btn) =>
                    btn.removeEventListener('click', handlers.handleHowToPlayClick),
                  )
                  Option.map(howToPlayCloseBtn, (btn) =>
                    btn.removeEventListener('click', handlers.handleHowToPlayCloseClick),
                  )
                  Option.map(achievementsBtn, (btn) => btn.removeEventListener('click', handlers.handleAchievementsClick))
                  Option.map(achievementsCloseBtn, (btn) => btn.removeEventListener('click', handlers.handleAchievementsCloseClick))
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
              captureFocusBeforeOpen()
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
