import { Duration, Effect } from 'effect'
import { StartupError } from '@ts-minecraft/game'
import type { ChunkManagerService } from '@ts-minecraft/world'
import type { WorldRendererService } from '@ts-minecraft/rendering'
import type { TerrainWorkerPool } from '@ts-minecraft/worker'
import type * as THREE from 'three'
import type { LoadingScreenService } from '@ts-minecraft/presentation'
import type { Position } from '@ts-minecraft/core'

import { waitForPollingGate } from './session-loading-gates-polling'
import { getRemainingLoadingScreenDurationMs } from './session-loading-gates-state'

const INITIAL_TERRAIN_MESH_POLL_MS = 50
const INITIAL_TERRAIN_MESH_TIMEOUT_MS = 30_000
const TERRAIN_QUEUE_POLL_MS = 25
const TERRAIN_QUEUE_TIMEOUT_MS = 30_000
const INITIAL_TERRAIN_ERROR_DELAY = Duration.seconds(3)
type InitialChunkSet = Parameters<WorldRendererService['syncChunksToScene']>[0]

const showTerrainStartupFailure = (
  loadingScreen: LoadingScreenService,
  loadingScreenMessage: string,
  logMessage: string,
  startupReason: string,
  cause: unknown,
): Effect.Effect<void, StartupError, never> =>
  Effect.gen(function* () {
    yield* loadingScreen.showError(loadingScreenMessage)
    yield* Effect.logError(`${logMessage}: ${String(cause)}`)
    yield* Effect.sleep(INITIAL_TERRAIN_ERROR_DELAY)
    yield* Effect.fail(new StartupError({ reason: startupReason, cause }))
  })

const waitForInitialChunkMeshes = ({
  worldRendererService,
  initialChunks,
  scene,
}: {
  readonly worldRendererService: WorldRendererService
  readonly initialChunks: InitialChunkSet
  readonly scene: THREE.Scene
}) =>
  Effect.gen(function* () {
    const settled = yield* waitForPollingGate({
      step: () => worldRendererService.syncChunksToScene(initialChunks, scene),
      pollMs: INITIAL_TERRAIN_MESH_POLL_MS,
      timeoutMs: INITIAL_TERRAIN_MESH_TIMEOUT_MS,
    })

    if (settled) return
    yield* Effect.fail(new Error('Timed out while syncing initial chunk meshes'))
  })

const waitForTerrainQueueDrain = ({ terrainPool }: { readonly terrainPool: TerrainWorkerPool }) =>
  Effect.gen(function* () {
    const settled = yield* waitForPollingGate({
      step: () => Effect.sync(() => terrainPool.queueDepth() === 0),
      pollMs: TERRAIN_QUEUE_POLL_MS,
      timeoutMs: TERRAIN_QUEUE_TIMEOUT_MS,
    })

    if (settled) return
    yield* Effect.fail(new Error('Timed out while draining terrain worker queue'))
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

    yield* waitForInitialChunkMeshes({
      worldRendererService,
      initialChunks,
      scene,
    }).pipe(
      Effect.catchAll((cause) =>
        showTerrainStartupFailure(
          loadingScreen,
          'Failed to prepare initial terrain meshes.',
          'Loading gate failed',
          'Failed to prepare initial chunk meshes',
          cause,
        ),
      ),
    )

    yield* waitForTerrainQueueDrain({ terrainPool }).pipe(
      Effect.catchAll((cause) =>
        showTerrainStartupFailure(
          loadingScreen,
          'Terrain generation took too long and was aborted.',
          'Terrain queue drain failed',
          'Timed out while draining terrain worker queue',
          cause,
        ),
      ),
    )

    const nowMs = yield* Effect.sync(() => Date.now())
    const remainingLoadingMs = getRemainingLoadingScreenDurationMs(loadingStartedAtMs, nowMs)
    if (remainingLoadingMs > 0) yield* Effect.sleep(Duration.millis(remainingLoadingMs))
  })
