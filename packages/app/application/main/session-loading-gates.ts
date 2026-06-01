import { Duration, Effect } from 'effect'
import { StartupError } from '@ts-minecraft/game'
import type { ChunkManagerService } from '@ts-minecraft/world'
import type { WorldRendererService } from '@ts-minecraft/rendering'
import type { TerrainWorkerPool } from '@ts-minecraft/worker'
import type * as THREE from 'three'
import type { LoadingScreenService } from '@ts-minecraft/presentation/loading/loading-screen'
import type { Position } from '@ts-minecraft/core'

const MIN_LOADING_SCREEN_DURATION_MS = 2500
const INITIAL_FPS_GATE_TARGET = 120
const INITIAL_FPS_GATE_TIMEOUT_MS = 8_000
const INITIAL_FPS_GATE_POLL_MS = 100
const INITIAL_FPS_GATE_STABLE_SAMPLES = 10

const readDisplayedFps = (fpsElement: HTMLElement): number => {
  const fps = Number.parseFloat(fpsElement.textContent ?? '0')
  return Number.isFinite(fps) ? fps : 0
}

export const waitForInitialFrameRate = (fpsElement: HTMLElement | null): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    if (fpsElement === null) return
    const startedAtMs = yield* Effect.sync(() => Date.now())
    let stableSamples = 0
    while (stableSamples < INITIAL_FPS_GATE_STABLE_SAMPLES) {
      const elapsedMs = (yield* Effect.sync(() => Date.now())) - startedAtMs
      if (elapsedMs >= INITIAL_FPS_GATE_TIMEOUT_MS) return
      stableSamples = readDisplayedFps(fpsElement) >= INITIAL_FPS_GATE_TARGET ? stableSamples + 1 : 0
      yield* Effect.sleep(Duration.millis(INITIAL_FPS_GATE_POLL_MS))
    }
  })

export const prepareInitialTerrain = ({
  chunkManagerService,
  worldRendererService,
  terrainPool,
  loadingScreen,
  scene,
  anchor,
  renderDistance,
}: {
  readonly chunkManagerService: ChunkManagerService
  readonly worldRendererService: WorldRendererService
  readonly terrainPool: TerrainWorkerPool
  readonly loadingScreen: LoadingScreenService
  readonly scene: THREE.Scene
  readonly anchor: Position
  readonly renderDistance: number
}) =>
  Effect.gen(function* () {
    const loadingStartedAtMs = yield* Effect.sync(() => Date.now())
    yield* chunkManagerService.loadChunksAroundPlayer(anchor, renderDistance, { eager: true })
    const initialChunks = yield* chunkManagerService.getLoadedChunks()

    yield* Effect.raceFirst(
      Effect.iterate(false, {
        while: (settled) => !settled,
        body: () =>
          worldRendererService.syncChunksToScene(initialChunks, scene).pipe(
            Effect.flatMap((settled) => settled ? Effect.succeed(true) : Effect.sleep(Duration.millis(50)).pipe(Effect.as(false))),
          ),
      }),
      Effect.sleep(Duration.seconds(30)).pipe(Effect.flatMap(() => Effect.fail(new Error('Timed out while syncing initial chunk meshes')))),
    ).pipe(
      Effect.catchAll((cause) =>
        loadingScreen.showError('Failed to prepare initial terrain meshes.').pipe(
          Effect.zipRight(Effect.logError(`Loading gate failed: ${String(cause)}`)),
          Effect.zipRight(Effect.sleep(Duration.seconds(3))),
          Effect.zipRight(Effect.fail(new StartupError({ reason: 'Failed to prepare initial chunk meshes', cause }))),
        ),
      ),
    )

    yield* Effect.raceFirst(
      Effect.iterate(false, {
        while: (queueDrained) => !queueDrained,
        body: () =>
          Effect.sync(() => terrainPool.queueDepth() === 0).pipe(
            Effect.flatMap((queueDrained) => queueDrained ? Effect.succeed(true) : Effect.sleep(Duration.millis(25)).pipe(Effect.as(false))),
          ),
      }),
      Effect.sleep(Duration.seconds(30)).pipe(Effect.flatMap(() => Effect.fail(new Error('Timed out while draining terrain worker queue')))),
    ).pipe(
      Effect.catchAll((cause) =>
        loadingScreen.showError('Terrain generation took too long and was aborted.').pipe(
          Effect.zipRight(Effect.logError(`Terrain queue drain failed: ${String(cause)}`)),
          Effect.zipRight(Effect.sleep(Duration.seconds(3))),
          Effect.zipRight(Effect.fail(new StartupError({ reason: 'Timed out while draining terrain worker queue', cause }))),
        ),
      ),
    )

    const loadingElapsedMs = (yield* Effect.sync(() => Date.now())) - loadingStartedAtMs
    const remainingLoadingMs = Math.max(0, MIN_LOADING_SCREEN_DURATION_MS - loadingElapsedMs)
    if (remainingLoadingMs > 0) yield* Effect.sleep(Duration.millis(remainingLoadingMs))
  })
