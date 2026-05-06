import { Effect, MutableRef, Ref } from 'effect'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/kernel'
import type { DeltaTimeSecs, Position } from '@ts-minecraft/kernel'

export const physicsStage = (
  deps: Pick<FrameHandlerDeps, 'respawnPosition'>,
  services: Pick<
    FrameHandlerServices,
    'gameState' | 'healthService' | 'soundManager' | 'entityManager' | 'gameMode' | 'debugFeatureFlags'
  >,
  refs: Pick<FrameStageRefs, 'lastHealthRef'>,
  inputs: {
    readonly deltaTime: DeltaTimeSecs
    readonly initialPlayerPos: Position
    readonly healthValueElementOrNull: HTMLElement | null
    readonly healthMaxElementOrNull: HTMLElement | null
  },
): Effect.Effect<{ readonly playerPos: Position }, never> =>
  Effect.gen(function* () {
    const debugFlags = yield* services.debugFeatureFlags.getFlags()

    // Update game state (input -> movement -> physics -> position sync)
    yield* logErrors(services.gameState.update(inputs.deltaTime), 'Physics update error')

    // Health: fall damage processing and HUD update
    const finalPosRef = yield* Ref.make(inputs.initialPlayerPos)

    yield* logErrors(
      Effect.gen(function* () {
        const refreshedPos = yield* services.gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
          Effect.catchAllCause(() => Effect.succeed(inputs.initialPlayerPos)),
        )
        yield* Ref.set(finalPosRef, refreshedPos)

        const tryApplyPlayerDamage = (amount: number): Effect.Effect<boolean, never> =>
          amount <= 0
            ? Effect.succeed(false)
            : services.healthService.getHealth().pipe(
                Effect.flatMap((health) =>
                  health.current <= 0 || health.invincibilityTicks > 0
                    ? Effect.succeed(false)
                    : services.healthService.applyDamage(amount).pipe(Effect.as(true)),
                ),
              )

        const isGrounded = yield* services.gameState.isPlayerGrounded()
        const fallDamage = yield* services.healthService.processFallDamage(refreshedPos.y, isGrounded)
        const tookFallDamage = yield* tryApplyPlayerDamage(fallDamage)
        if (tookFallDamage) {
          yield* services.soundManager.playEffect('playerHurt', { position: refreshedPos })
        }

        const hostileDamage = debugFlags['mobs.enabled'] && debugFlags['mobs.damage']
          ? yield* services.entityManager.getPlayerContactDamage(refreshedPos)
          : 0
        const tookHostileDamage = yield* tryApplyPlayerDamage(hostileDamage)
        if (tookHostileDamage) {
          yield* services.soundManager.playEffect('playerHurt', { position: refreshedPos })
        }

        const isDead = yield* services.healthService.isDead()
        if (isDead) {
          // FR-1.3: in SURVIVAL, the death-screen overlay (DeathScreenService)
          // owns respawn — it shows "YOU DIED" and waits for the player to click
          // Respawn or Quit-to-Title. Auto-respawning here would race the overlay
          // and produce a 1-frame flicker where the player snaps back to spawn
          // before the screen renders.
          // CREATIVE uses immediate auto-respawn (no death screen).
          const isCreative = yield* services.gameMode.isCreative()
          if (isCreative) {
            yield* services.healthService.reset()
            yield* services.gameState.respawn(deps.respawnPosition)
            yield* Ref.set(finalPosRef, deps.respawnPosition)
          }
        } else {
          yield* services.healthService.tick()
        }

        const health = yield* services.healthService.getHealth()
        // Pre-cached element refs (resolved once at startup in FrameHandlerDeps)
        // FR-006: Only write DOM when health values actually change
        const lastHealth = MutableRef.get(refs.lastHealthRef)
        if (lastHealth.current !== health.current || lastHealth.max !== health.max) {
          MutableRef.set(refs.lastHealthRef, { current: health.current, max: health.max })
          yield* Effect.sync(() => {
            /* c8 ignore next 2 */
            if (inputs.healthValueElementOrNull) inputs.healthValueElementOrNull.textContent = String(health.current)
            if (inputs.healthMaxElementOrNull) inputs.healthMaxElementOrNull.textContent = String(health.max)
          })
        }
      }),
      'Health error',
    )

    const playerPos = yield* Ref.get(finalPosRef)
    return { playerPos }
  })
