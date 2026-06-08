import { Cause, Effect, Option } from 'effect'
import { MainLive } from '@ts-minecraft/app'
import { PerfHudService } from '@ts-minecraft/rendering'
import { TerrainWorkerPool } from '@ts-minecraft/worker'
import { StorageService } from '@ts-minecraft/world'
import {
  bootProgram,
  sessionProgram,
} from '@ts-minecraft/app'
import { TimeServicePort, InventoryServicePort } from '@ts-minecraft/entity'
import { MainMenuService } from '@ts-minecraft/presentation'
import type { BootContext } from '@ts-minecraft/app'
import type { GameMode } from '@ts-minecraft/game'

/**
 * `mainMenuLoop` — outer loop that owns world-selection + session lifecycle.
 *
 * Phase-1 Wave-2a wiring:
 *   1. Render the main menu, await the user's selection.
 *   2. Hide the menu and run a session for the chosen world (sessionProgram is
 *      `Effect.scoped` so its session-scoped GPU resources tear down cleanly
 *      when it returns from quit-to-title).
 *   3. Loop after the session returns to title.
 *
 * The boot context (`bootCtx`) is threaded through every iteration so the
 * renderer + workers + audio + settings/storage services persist across
 * sessions per FR-1.8.
 */
const mainMenuLoop = (bootCtx: BootContext) =>
  Effect.gen(function* () {
    const menu = yield* MainMenuService
    const storageService = yield* StorageService

    const iteration = Effect.gen(function* () {
      const choice = yield* menu.show()

      yield* menu.hide()

      const gameMode: GameMode = choice.action === 'newWorld'
        ? choice.gameMode
        : yield* storageService.loadWorldMetadata(choice.worldId).pipe(
            Effect.matchEffect({
              onFailure: () => Effect.succeed<GameMode>('survival'),
              onSuccess: (metaOpt) =>
                Effect.succeed<GameMode>(
                  Option.isSome(metaOpt) ? metaOpt.value.gameMode : 'survival',
                ),
            }),
          )

      yield* sessionProgram(bootCtx, choice.worldId, gameMode).pipe(
        Effect.scoped,
        Effect.catchAllCause((cause) => Effect.logError(`Session error: ${Cause.pretty(cause)}`)),
        Effect.asVoid,
      )
    })

    return yield* Effect.forever(iteration)
  })

// Run program with all layers provided.
// PerfHudService.Default and TerrainWorkerPool.Default are provided alongside
// MainLive — they live in infrastructure/ rather than under the layer groups
// in layers.ts to keep that file focused on game-logic layers.
const program = bootProgram.pipe(
  Effect.flatMap(mainMenuLoop),
  Effect.scoped,
  Effect.provide(MainLive),
  Effect.provide(PerfHudService.Default),
  Effect.provide(TerrainWorkerPool.Default),
  Effect.provide(TimeServicePort.Default),
  Effect.provide(InventoryServicePort.Default),
  Effect.catchAllCause((cause) =>
    Effect.logError(`Startup failed: ${Cause.pretty(cause)}`).pipe(Effect.asVoid),
  ),
)

Effect.runFork(program)
