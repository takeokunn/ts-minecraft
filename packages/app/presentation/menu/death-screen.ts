import { Cause, Effect, Fiber, MutableRef, Option, Scope } from 'effect'
import { DomOperationsService } from '@ts-minecraft/app/presentation/hud/crosshair'
import { GameStateService } from '@ts-minecraft/game'
import { GameModeService } from '@ts-minecraft/game'
import { HealthService } from '@ts-minecraft/player'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/kernel'
import {
  type SessionControl,
  requestQuitToTitle,
  setPaused,
} from '@ts-minecraft/app/main/session-control'
import type { Position } from '@ts-minecraft/kernel'

// FR-1.3 — death screen overlay. Subscribes to healthService.awaitDeath() on attach().
// Suppressed in CREATIVE: frame-handler auto-respawns before this listener runs.
// Phase-1: inventory cleared on respawn instead of world-entity drops (Phase 3 will add drops).
// Esc routes to Respawn (not pause menu) to avoid stale menu state mid-death.
const Z_INDEX = 1100

const BACKDROP_STYLE = [
  'position:fixed',
  'top:0',
  'left:0',
  'width:100vw',
  'height:100vh',
  // Red tint conveys death without obscuring the world too much.
  'background:rgba(85,8,8,0.55)',
  'display:none',
  'align-items:center',
  'justify-content:center',
  `z-index:${Z_INDEX}`,
  'font-family:monospace',
].join(';')

const PANEL_STYLE = [
  'background:rgba(10,10,10,0.92)',
  'color:#fff',
  'padding:36px 48px',
  'border-radius:10px',
  'min-width:320px',
  'border:1px solid #5a1a1a',
  'box-shadow:0 12px 48px rgba(0,0,0,0.7)',
  'display:flex',
  'flex-direction:column',
  'align-items:stretch',
  'gap:14px',
].join(';')

const TITLE_STYLE = [
  'font-size:32px',
  'font-weight:bold',
  'text-align:center',
  'color:#ff5555',
  'margin-bottom:12px',
  'letter-spacing:4px',
  'text-shadow:0 2px 6px rgba(0,0,0,0.8)',
].join(';')

const BUTTON_STYLE = [
  'padding:10px 18px',
  'background:#3a1f1f',
  'color:#fff',
  'border:1px solid #6a2a2a',
  'border-radius:4px',
  'cursor:pointer',
  'font-family:monospace',
  'font-size:14px',
  'min-width:220px',
  'text-align:center',
].join(';')

type DeathScreenDom = {
  readonly backdropEl: Option.Option<HTMLDivElement>
  readonly respawnBtn: Option.Option<HTMLButtonElement>
  readonly quitBtn: Option.Option<HTMLButtonElement>
}

export class DeathScreenService extends Effect.Service<DeathScreenService>()(
  '@minecraft/presentation/DeathScreen',
  {
    scoped: Effect.flatMap(
      Effect.all(
        [DomOperationsService, GameStateService, GameModeService, HealthService],
        { concurrency: 'unbounded' },
      ),
      ([dom, gameState, gameMode, healthService]) =>
        Effect.acquireRelease(
          Effect.sync((): DeathScreenDom => {
            if (typeof document === 'undefined') {
              return {
                backdropEl: Option.none(),
                respawnBtn: Option.none(),
                quitBtn: Option.none(),
              }
            }

            const backdrop = dom.createElement('div')
            backdrop.id = 'death-screen-backdrop'
            backdrop.style.cssText = BACKDROP_STYLE

            const panel = dom.createElement('div')
            panel.style.cssText = PANEL_STYLE
            panel.setAttribute('role', 'dialog')
            panel.setAttribute('aria-modal', 'true')
            panel.setAttribute('aria-label', 'Death Screen')

            const title = dom.createElement('div')
            title.textContent = 'YOU DIED'
            title.style.cssText = TITLE_STYLE
            dom.appendChildTo(panel, title)

            const respawnBtn = dom.createElement('button')
            respawnBtn.textContent = 'Respawn'
            respawnBtn.style.cssText = BUTTON_STYLE
            respawnBtn.dataset['role'] = 'respawn'
            dom.appendChildTo(panel, respawnBtn)

            const quitBtn = dom.createElement('button')
            quitBtn.textContent = 'Quit to Title'
            quitBtn.style.cssText = BUTTON_STYLE
            quitBtn.dataset['role'] = 'quit-to-title'
            dom.appendChildTo(panel, quitBtn)

            dom.appendChildTo(backdrop, panel)
            dom.appendChild(backdrop)

            return {
              backdropEl: Option.some(backdrop),
              respawnBtn: Option.some(respawnBtn),
              quitBtn: Option.some(quitBtn),
            }
          }),
          ({ backdropEl }) =>
            Effect.sync(() => {
              Option.map(backdropEl, (el) => {
                Option.map(dom.getParentNode(el), () => dom.removeChild(el))
              })
            }),
        ).pipe(
          Effect.map(({ backdropEl, respawnBtn, quitBtn }) => {
            const isOpenRef = MutableRef.make(false)

            const showOverlay = (): void => {
              Option.map(backdropEl, (el) => { el.style.display = 'flex' })
              // Default-focus Respawn so Enter respawns immediately.
              Option.map(respawnBtn, (btn) => btn.focus())
            }

            const hideOverlay = (): void => {
              Option.map(backdropEl, (el) => { el.style.display = 'none' })
            }

            // Snapshot the player's death position. Currently used only for
            // logging; Phase-3 will replace `inventoryService.clear()` (in
            // GameStateService.respawn) with world-entity drops at this point.
            const captureDeathContext = (): Effect.Effect<
              { readonly deathPos: Position },
              never
            > =>
              gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
                Effect.map((deathPos) => ({ deathPos })),
                Effect.catchAllCause(() =>
                  Effect.succeed({ deathPos: { x: 0, y: 64, z: 0 } as Position }),
                ),
              )

            const performRespawn = (
              spawnPosition: Position,
            ): Effect.Effect<void, never> =>
              captureDeathContext().pipe(
                Effect.flatMap(({ deathPos }) =>
                  Effect.log(`Player died at (${deathPos.x}, ${deathPos.y}, ${deathPos.z}); respawning at (${spawnPosition.x}, ${spawnPosition.y}, ${spawnPosition.z})`),
                ),
                Effect.andThen(healthService.reset()),
                // `gameState.respawn` is mode-aware: clears inventory in
                // survival, preserves it in creative.
                Effect.andThen(
                  gameState.respawn(spawnPosition).pipe(
                    Effect.catchAllCause((cause) =>
                      Effect.logError(`Death-screen respawn error: ${Cause.pretty(cause)}`),
                    ),
                  ),
                ),
                Effect.asVoid,
              )

            return {
              // Scope-managed: fiber is interrupted and DOM torn down when the surrounding session scope closes.
              attach: (
                control: SessionControl,
                spawnPosition: Position,
              ): Effect.Effect<void, never, Scope.Scope> =>
                Effect.acquireRelease(
                  Effect.gen(function* () {
                    const handleRespawnClick = (): void => {
                      if (!MutableRef.get(isOpenRef)) return
                      MutableRef.set(isOpenRef, false)
                      hideOverlay()
                      // Unblock the session in case anything paused it
                      // during the death state.
                      setPaused(control, false)
                      Effect.runFork(performRespawn(spawnPosition))
                    }

                    const handleQuitClick = (): void => {
                      if (!MutableRef.get(isOpenRef)) return
                      MutableRef.set(isOpenRef, false)
                      hideOverlay()
                      Effect.runFork(requestQuitToTitle(control))
                    }

                    const handleKeyDown = (event: KeyboardEvent): void => {
                      if (!MutableRef.get(isOpenRef)) return
                      if (event.key === 'Escape' || event.key === 'Enter') {
                        event.preventDefault()
                        event.stopPropagation()
                        // Esc and Enter both default to Respawn so the player
                        // can never accidentally fall through to the pause menu.
                        if (event.key === 'Enter') {
                          // Let the focused button native-activate first; if
                          // it's the quit button this still routes to its
                          // own handler. Fall through to Respawn only if no
                          // button has focus (rare on the death screen).
                          const focused = typeof document !== 'undefined' ? document.activeElement : null
                          const quitFocused = Option.match(quitBtn, {
                            onNone: () => false,
                            onSome: (btn) => focused === btn,
                          })
                          if (quitFocused) {
                            handleQuitClick()
                          } else {
                            handleRespawnClick()
                          }
                        } else {
                          handleRespawnClick()
                        }
                      } else if (event.key === 'Tab') {
                        // Browser-native tab cycle between visible buttons.
                        event.stopPropagation()
                      }
                    }

                    Option.map(respawnBtn, (btn) => btn.addEventListener('click', handleRespawnClick))
                    Option.map(quitBtn, (btn) => btn.addEventListener('click', handleQuitClick))
                    if (typeof document !== 'undefined') {
                      document.addEventListener('keydown', handleKeyDown, true)
                    }

                    // Death-watcher fiber: forever awaits next death, opens overlay
                    // (in survival only — creative auto-respawns via frame-handler).
                    const deathWatcher: Effect.Effect<void, never> = Effect.gen(function* () {
                      yield* healthService.awaitDeath()
                      const isCreative = yield* gameMode.isCreative()
                      if (isCreative) {
                        // Frame-handler already triggered auto-respawn — do nothing.
                        return
                      }
                      yield* Effect.sync(() => {
                        if (MutableRef.get(isOpenRef)) return
                        MutableRef.set(isOpenRef, true)
                        showOverlay()
                      })
                    }).pipe(
                      Effect.forever,
                      Effect.catchAllCause((cause) =>
                        Effect.logError(`Death-screen watcher error: ${Cause.pretty(cause)}`),
                      ),
                    )

                    const fiber = yield* Effect.forkDaemon(deathWatcher)

                    return {
                      handleRespawnClick,
                      handleQuitClick,
                      handleKeyDown,
                      fiber,
                    }
                  }),
                  (handlers) =>
                    Effect.gen(function* () {
                      Option.map(respawnBtn, (btn) => btn.removeEventListener('click', handlers.handleRespawnClick))
                      Option.map(quitBtn, (btn) => btn.removeEventListener('click', handlers.handleQuitClick))
                      if (typeof document !== 'undefined') {
                        document.removeEventListener('keydown', handlers.handleKeyDown, true)
                      }
                      hideOverlay()
                      MutableRef.set(isOpenRef, false)
                      yield* Fiber.interrupt(handlers.fiber)
                    }),
                ).pipe(Effect.asVoid),

              isOpen: (): Effect.Effect<boolean, never> =>
                Effect.sync(() => MutableRef.get(isOpenRef)),
            }
          }),
        ),
    ),
  },
) {}

export const DeathScreenLive = DeathScreenService.Default
