import { Cause, Effect, Exit, Layer, Option, Scope } from 'effect'
import { MainLayers } from '@ts-minecraft/app'
import { PerfHudService } from '@ts-minecraft/rendering'
import { TerrainWorkerPool } from '@ts-minecraft/worker'
import { StorageService } from '@ts-minecraft/world'
import {
  bootProgram,
  sessionProgram,
} from '@ts-minecraft/app'
import { HungerService, TimeServicePort, InventoryServicePort } from '@ts-minecraft/entity'
import { LoadingScreenService, MainMenuService, setGameplayHudHidden } from '@ts-minecraft/presentation'
import { WorldId, parseWorldParam, clearWorldParam } from '@ts-minecraft/core'
import type { BootContext } from '@ts-minecraft/app'
import type { GameMode } from '@ts-minecraft/game'

const runSessionToTitle = (
  bootCtx: BootContext,
  worldId: WorldId,
  gameMode: GameMode,
) =>
  Effect.gen(function* () {
    const scope = yield* Scope.make()
    const exit = yield* sessionProgram(bootCtx, worldId, gameMode).pipe(
      Scope.extend(scope),
      Effect.exit,
    )

    yield* Effect.forkDaemon(
      Scope.close(scope, Exit.asVoid(exit)).pipe(
        Effect.catchAllCause((cause) =>
          Effect.logWarning(`Session cleanup failed: ${Cause.pretty(cause)}`),
        ),
      ),
    )

    return yield* Exit.matchEffect(exit, {
      onFailure: (cause) => Effect.failCause(cause),
      onSuccess: () => Effect.void,
    })
  })

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
    const loadingScreen = yield* LoadingScreenService
    const menu = yield* MainMenuService
    const storageService = yield* StorageService

    const loadGameModeForWorld = (worldId: WorldId) =>
      storageService.loadWorldMetadata(worldId).pipe(
        Effect.matchEffect({
          onFailure: (e) =>
            Effect.logWarning(`Could not read world metadata, defaulting to survival: ${e}`).pipe(
              Effect.as('survival' as GameMode),
            ),
          onSuccess: (metaOpt) =>
            Effect.succeed<GameMode>(
              Option.isSome(metaOpt) ? metaOpt.value.gameMode : 'survival',
            ),
        }),
      )

    // Dev shortcut: ?world=<worldId> skips the menu and loads directly.
    const urlWorldParam = parseWorldParam(window.location.search)
    if (urlWorldParam !== null) {
      const worldId = WorldId.make(urlWorldParam)
      const urlGameMode = yield* loadGameModeForWorld(worldId)
      yield* loadingScreen.show()
      // Consume the shortcut immediately so a browser reload during play returns
      // to the normal title flow instead of auto-restarting the same session.
      yield* Effect.sync(() => clearWorldParam())
      yield* Effect.sync(() => setGameplayHudHidden(false))
      yield* runSessionToTitle(bootCtx, worldId, urlGameMode).pipe(
        Effect.catchAllCause((cause) => Effect.logError(`Session error: ${Cause.pretty(cause)}`)),
        Effect.asVoid,
      )
    }

    const iteration = Effect.gen(function* () {
      yield* Effect.sync(() => setGameplayHudHidden(true))
      yield* loadingScreen.hide()
      const choice = yield* menu.show()

      yield* menu.hide()
      yield* loadingScreen.show()
      yield* Effect.sync(() => setGameplayHudHidden(false))

      const gameMode: GameMode = choice.action === 'newWorld'
        ? choice.gameMode
        : yield* loadGameModeForWorld(choice.worldId)

      yield* runSessionToTitle(bootCtx, choice.worldId, gameMode).pipe(
        Effect.catchAllCause((cause) => Effect.logError(`Session error: ${Cause.pretty(cause)}`)),
        Effect.asVoid,
      )
      yield* Effect.sync(() => clearWorldParam())
    })

    return yield* Effect.forever(iteration)
  })

const StartupLayers = Layer.mergeAll(
  HungerService.Default,
  PerfHudService.Default,
  TerrainWorkerPool.Default,
  TimeServicePort.Default,
  InventoryServicePort.Default,
)

const AppLayers = MainLayers.pipe(
  Layer.provideMerge(StartupLayers),
)

const program = bootProgram.pipe(
  Effect.flatMap(mainMenuLoop),
  Effect.catchAllCause((cause) =>
    Effect.logError(`Startup failed: ${Cause.pretty(cause)}`).pipe(Effect.asVoid),
  ),
  Effect.provide(AppLayers),
)

Effect.runFork(program)
