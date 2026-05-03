import { Cause, Effect, Option } from 'effect'
import { MainLive } from '@ts-minecraft/app'
import { PerfHudService } from '@ts-minecraft/rendering'
import { TerrainWorkerPool } from '@ts-minecraft/terrain'
import { StorageService } from '@ts-minecraft/world-state'
import {
  MainMenuService,
  SettingsOverlayService,
  bootProgram,
  sessionProgram,
} from '@ts-minecraft/app'
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
 *   3. Loop. The forever-loop is escaped only by the user clicking Quit, which
 *      attempts `window.close()` and falls back to a soft warning.
 *
 * The boot context (`bootCtx`) is threaded through every iteration so the
 * renderer + workers + audio + settings/storage services persist across
 * sessions per FR-1.8.
 */
const mainMenuLoop = (bootCtx: BootContext) =>
  Effect.gen(function* () {
    const menu = yield* MainMenuService
    const storageService = yield* StorageService
    const settingsOverlay = yield* SettingsOverlayService

    // Wire the Settings button on the main menu to toggle the existing overlay.
    yield* menu.onSettings(() => {
      Effect.runFork(settingsOverlay.toggle().pipe(Effect.catchAllCause(() => Effect.void)))
    })

    const iteration = Effect.gen(function* () {
      const choice = yield* menu.show()

      if (choice.action === 'quit') {
        yield* Effect.sync(() => window.close()).pipe(Effect.catchAllCause(() => Effect.void))
        yield* Effect.logInfo('Quit requested — please close this tab manually if it remains open.')
        // Block forever so the loop does not spin after a no-op window.close.
        yield* Effect.never
        return
      }

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
Effect.runFork(
  bootProgram.pipe(
    Effect.flatMap(mainMenuLoop),
    Effect.scoped,
    Effect.provide(MainLive),
    Effect.provide(PerfHudService.Default),
    Effect.provide(TerrainWorkerPool.Default),
    Effect.catchAllCause((cause): Effect.Effect<void, never, never> =>
      Effect.logError(`Startup failed: ${Cause.pretty(cause)}`).pipe(Effect.asVoid),
    ),
  ),
)
