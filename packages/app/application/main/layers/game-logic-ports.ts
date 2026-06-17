import { Effect, Layer, Option } from 'effect'

import { CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/core'
import { PlayerService } from '@ts-minecraft/entity'
import { ChunkManagerService, PlayerServicePort, WorldBlockQueryPort, worldToBlockIndex } from '@ts-minecraft/world'

import { ChunkManagerLayer } from './game-logic-chunk-manager-bundles'

export const PlayerServicePortLayer = Layer.effect(
  PlayerServicePort,
  Effect.gen(function* () {
    const playerService = yield* PlayerService
    return PlayerServicePort.of({
      getPosition: (id) => playerService.getPosition(id),
    })
  }),
).pipe(Layer.provide(PlayerService.Default))

export const WorldBlockQueryPortLayer = Layer.effect(
  WorldBlockQueryPort,
  Effect.gen(function* () {
    const chunkManager = yield* ChunkManagerService
    return WorldBlockQueryPort.of({
      getBlockIndexAt: (position) =>
        Effect.gen(function* () {
          const { chunkCoord, ly, flatIdx } = worldToBlockIndex(position)
          if (ly < 0 || ly >= CHUNK_HEIGHT) return Option.none()

          const chunk = yield* chunkManager.getChunk(chunkCoord).pipe(
            Effect.catchAll(() => Effect.succeed(null)),
          )
          if (chunk === null) return Option.none()
          const blockIndex = chunk.blocks[flatIdx]
          if (blockIndex === undefined) return Option.none()
          if (blockIndex === blockTypeToIndex('AIR')) return Option.none()
          return Option.some(blockIndex)
        }),
    })
  }),
).pipe(Layer.provide(ChunkManagerLayer))
