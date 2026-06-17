import { Array as Arr, Clock, Duration, Effect, Option, Random } from 'effect'
import { StartupError } from '@ts-minecraft/game'
import { ChunkManagerService } from '@ts-minecraft/world'
import { NoiseService, computeColumnY } from '@ts-minecraft/world'
import { GameModeService, type GameMode } from '@ts-minecraft/game'
import { StorageService } from '@ts-minecraft/world'
import { CHUNK_SIZE, SEA_LEVEL, WorldId } from '@ts-minecraft/core'
import { MAX_SEED_VALUE } from '@ts-minecraft/app/main.config'
import { selectSurfaceSpawn } from '@ts-minecraft/app/main/spawn-selection'
import {
  buildFreshWorldState,
  buildLoadedWorldBootstrap,
  type WorldBootstrap,
} from './session-world-loader-metadata'

const SPAWN_SEARCH_CHUNK_RADIUS = 2

// New worlds: ~60% of seeds put OCEAN at the world origin (median surface y≈56 < SEA_LEVEL),
// so spawning at (0,0) drops the player into open water. Land is almost always within a few
// chunks, though — search expanding rings of terrain-channel grids outward from origin and
// return the nearest column that is both above sea level and far enough inland to avoid a
// shoreline/beach start.
const SPAWN_LAND_MARGIN = 4
const SPAWN_LAND_CONTINENTALNESS = 0.12
const SPAWN_LAND_SEARCH_CHUNK_RADIUS = 10

const findLandSpawnXZ = (
  noiseService: NoiseService,
): Effect.Effect<{ readonly x: number; readonly z: number }, never> =>
  Effect.gen(function* () {
    let bestInland: { x: number; z: number; distSq: number } | null = null
    let bestAnyDry: { x: number; z: number; distSq: number } | null = null
    for (let ring = 0; ring <= SPAWN_LAND_SEARCH_CHUNK_RADIUS && bestInland === null; ring++) {
      for (let cx = -ring; cx <= ring; cx++) {
        for (let cz = -ring; cz <= ring; cz++) {
          // Only the perimeter of each ring (inner rings were already scanned).
          if (Math.max(Math.abs(cx), Math.abs(cz)) !== ring) continue
          const channels = yield* noiseService.sampleTerrainChannels(cx * CHUNK_SIZE, cz * CHUNK_SIZE)
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
              const surfaceY = computeColumnY(channels, lx, lz)
              if (surfaceY < SEA_LEVEL + SPAWN_LAND_MARGIN) continue
              const wx = cx * CHUNK_SIZE + lx
              const wz = cz * CHUNK_SIZE + lz
              const distSq = wx * wx + wz * wz
              const candidate = { x: wx, z: wz, distSq }
              if (bestAnyDry === null || distSq < bestAnyDry.distSq) bestAnyDry = candidate
              const columnIndex = lz * CHUNK_SIZE + lx
              const continentalness = channels.continentalness[columnIndex] ?? Number.NEGATIVE_INFINITY
              if (continentalness >= SPAWN_LAND_CONTINENTALNESS) {
                if (bestInland === null || distSq < bestInland.distSq) bestInland = candidate
              }
            }
          }
        }
      }
    }
    const best = bestInland ?? bestAnyDry
    return best === null ? { x: 0, z: 0 } : { x: best.x, z: best.z }
  })

const chunkCoordFromWorld = (coord: number): number => Math.floor(coord / CHUNK_SIZE)

const spawnSearchChunkCoords = (
  baseSpawnPosition: { readonly x: number; readonly z: number },
): ReadonlyArray<{ readonly x: number; readonly z: number }> => {
  const baseChunkX = chunkCoordFromWorld(baseSpawnPosition.x)
  const baseChunkZ = chunkCoordFromWorld(baseSpawnPosition.z)
  const diameter = SPAWN_SEARCH_CHUNK_RADIUS * 2 + 1

  return Arr.flatMap(Arr.makeBy(diameter, (xOffset: number) => baseChunkX - SPAWN_SEARCH_CHUNK_RADIUS + xOffset), (x: number) =>
    Arr.map(Arr.makeBy(diameter, (zOffset: number) => baseChunkZ - SPAWN_SEARCH_CHUNK_RADIUS + zOffset), (z: number) => ({ x, z }))
  )
}

export const loadOrCreateWorld = (
  worldId: WorldId,
  initialGameMode: GameMode,
  storageService: StorageService,
  noiseService: NoiseService,
  gameModeService: GameModeService,
): Effect.Effect<WorldBootstrap, StartupError> =>
  Effect.gen(function* () {
    const existingMetadata = yield* Effect.raceFirst(
      storageService.loadWorldMetadata(worldId),
      Effect.delay(
        Effect.fail(new Error('Timed out while loading world metadata')),
        Duration.seconds(10),
      ),
    ).pipe(
      Effect.mapError((cause) => new StartupError({ reason: 'Failed to load world metadata', cause })),
    )

    const metadata = Option.getOrNull(existingMetadata)
    if (metadata !== null) {
      yield* noiseService.setSeed(metadata.seed)
      yield* gameModeService.set(metadata.gameMode)
      yield* Effect.log(
        `Loaded world '${worldId}' with seed ${metadata.seed} (gameMode=${metadata.gameMode}, saveVersion=${metadata.saveVersion})`,
      )
      return buildLoadedWorldBootstrap(metadata)
    }

    const seed = yield* Random.nextIntBetween(0, MAX_SEED_VALUE)
    const nowMs = yield* Clock.currentTimeMillis
    const now = new Date(nowMs)
    yield* noiseService.setSeed(seed)
    // Pick a dry-land spawn column instead of the fixed origin (often open ocean).
    const land = yield* findLandSpawnXZ(noiseService)
    const pos = { x: land.x, y: 100, z: land.z }
    const freshWorld = buildFreshWorldState({
      seed,
      createdAt: now,
      baseSpawnPosition: pos,
      gameMode: initialGameMode,
    })
    yield* Effect.raceFirst(
      storageService.saveWorldMetadata(worldId, freshWorld.metadata),
      Effect.delay(
        Effect.fail(new Error('Timed out while saving world metadata')),
        Duration.seconds(10),
      ),
    ).pipe(
      Effect.mapError((cause) => new StartupError({ reason: 'Failed to save fresh world metadata', cause })),
    )
    yield* Effect.log(`Created new world '${worldId}' with seed ${seed} (gameMode=${initialGameMode})`)
    return freshWorld.bootstrap
  })

export const buildSpawnSelection = (
  baseSpawnPosition: { x: number; y: number; z: number },
  chunkManagerService: ChunkManagerService,
) => Effect.gen(function* () {
  const chunks = yield* Effect.forEach(
    spawnSearchChunkCoords(baseSpawnPosition),
    (coord) => chunkManagerService.getChunk(coord),
    { concurrency: 4 },
  )
  return selectSurfaceSpawn(chunks, baseSpawnPosition)
})

export const buildRespawnPosition = (
  baseSpawnPosition: { x: number; y: number; z: number },
  chunkManagerService: ChunkManagerService,
) =>
  Effect.gen(function* () {
    const spawn = yield* buildSpawnSelection(baseSpawnPosition, chunkManagerService)
    return spawn.position
  })
