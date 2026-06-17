import { Cause, Duration, Effect, Fiber, MutableRef, Option, Scope } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { GameStateService } from '@ts-minecraft/game'
import { GameModeService } from '@ts-minecraft/game'
import { HealthService } from '@ts-minecraft/entity'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import {
  type SessionControl,
  requestQuitToTitle,
  setPaused,
} from '@ts-minecraft/app/main/session-control'
import type { Position } from '@ts-minecraft/core'
import { buildDeathScreenDOM } from './death-screen-dom'
import type { DeathScreenDom } from './death-screen-types'

// FR-1.3 — death screen overlay. Subscribes to healthService.awaitDeath() on attach().
// Suppressed in CREATIVE: frame-handler auto-respawns before this listener runs.
// Phase-1: inventory cleared on respawn instead of world-entity drops (Phase 3 will add drops).
// Esc routes to Respawn (not pause menu) to avoid stale menu state mid-death.

export class DeathScreenService extends Effect.Service<DeathScreenService>()(
  '@minecraft/presentation/DeathScreen',
  {
    scoped: Effect.gen(function* () {
      const dom = yield* DomOperationsService
      const gameState = yield* GameStateService
      const gameMode = yield* GameModeService
      const healthService = yield* HealthService
      const { backdropEl, respawnBtn, quitBtn } = yield* Effect.acquireRelease(
        Effect.sync((): DeathScreenDom => buildDeathScreenDOM(dom)),
        ({ backdropEl }) =>
          Effect.sync(() => {
            const el = Option.getOrNull(backdropEl)
            if (el !== null && Option.isSome(dom.getParentNode(el))) dom.removeChild(el)
          }),
      )
      {
        const isOpenRef = MutableRef.make(false)

            const showOverlay = (): void => {
              const el = Option.getOrNull(backdropEl)
              if (el !== null) el.style.display = 'flex'
              // Default-focus Respawn so Enter respawns immediately.
              Option.getOrNull(respawnBtn)?.focus()
            }

            const hideOverlay = (): void => {
              const el = Option.getOrNull(backdropEl)
              if (el !== null) el.style.display = 'none'
            }

            // Snapshot the player's death position. Currently used only for
            // logging; Phase-3 will replace `inventoryService.clear()` (in
            // GameStateService.respawn) with world-entity drops at this point.
            const captureDeathContext = (): Effect.Effect<
              { readonly deathPos: Position },
              never
            > =>
              Effect.gen(function* () {
                const deathPos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID)
                return { deathPos }
              }).pipe(
                Effect.catchAllCause(() =>
                  Effect.succeed({ deathPos: { x: 0, y: 64, z: 0 } as Position }),
                ),
              )

            const performRespawn = (
              spawnPosition: Position,
            ): Effect.Effect<void, never> =>
              Effect.gen(function* () {
                const { deathPos } = yield* captureDeathContext()
                yield* Effect.log(`Player died at (${deathPos.x}, ${deathPos.y}, ${deathPos.z}); respawning at (${spawnPosition.x}, ${spawnPosition.y}, ${spawnPosition.z})`)
                yield* healthService.reset()
                // `gameState.respawn` is mode-aware: clears inventory in
                // survival, preserves it in creative.
                yield* gameState.respawn(spawnPosition).pipe(
                  Effect.catchAllCause((cause) =>
                    Effect.logError(`Death-screen respawn error: ${Cause.pretty(cause)}`),
                  ),
                )
              })

            return {
              // Scope-managed: fiber is interrupted and DOM torn down when the surrounding session scope closes.
              attach: (
                control: SessionControl,
                // Read the respawn point LIVE on each respawn (not captured once at
                // attach) so a bed-set spawn (FR-4) is honored in survival, matching
                // the creative auto-respawn path in physics-stage.
                respawnPositionRef: MutableRef.MutableRef<Position>,
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
                      Effect.runFork(performRespawn(MutableRef.get(respawnPositionRef)))
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
                          const quitFocused = Option.exists(quitBtn, (btn) => focused === btn)
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

                    Option.getOrNull(respawnBtn)?.addEventListener('click', handleRespawnClick)
                    Option.getOrNull(quitBtn)?.addEventListener('click', handleQuitClick)
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
                      Option.getOrNull(respawnBtn)?.removeEventListener('click', handlers.handleRespawnClick)
                      Option.getOrNull(quitBtn)?.removeEventListener('click', handlers.handleQuitClick)
                      if (typeof document !== 'undefined') {
                        document.removeEventListener('keydown', handlers.handleKeyDown, true)
                      }
                      hideOverlay()
                      MutableRef.set(isOpenRef, false)
                      yield* Effect.raceFirst(
                        Fiber.interrupt(handlers.fiber).pipe(
                          Effect.asVoid,
                          Effect.catchAllCause(() => Effect.void),
                        ),
                        Effect.sleep(Duration.millis(250)),
                      )
                    }),
                ).pipe(Effect.asVoid),

              isOpen: (): Effect.Effect<boolean, never> =>
                Effect.sync(() => MutableRef.get(isOpenRef)),
            }
          }
        }),
  },
) {}
