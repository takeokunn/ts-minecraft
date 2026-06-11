import { Effect, HashMap, Option, Ref } from 'effect'
import type { PlayerService } from '@ts-minecraft/entity/application/player-service'
import { CHUNK_HEIGHT, CHUNK_SIZE, DEFAULT_PLAYER_ID, blockTypeToIndex } from '@ts-minecraft/core'
import type { ChunkManagerService } from '@ts-minecraft/world/application/chunk-manager-service'
import type { FurnaceBlockState } from '../domain/furnace-state'
import {
  type FurnaceState,
  emptyFurnaceAtPosition,
  furnaceKey,
  positiveModulo,
} from '../domain/furnace-service-utils'

export const makeFurnaceHelpers = (
  playerService: PlayerService,
  chunkManagerService: ChunkManagerService,
  stateRef: Ref.Ref<FurnaceState>,
) => {
  const isFurnaceStillValid = (playerPos: { readonly x: number; readonly y: number; readonly z: number }, position: { readonly x: number; readonly y: number; readonly z: number }): Effect.Effect<boolean, never> =>
    Effect.gen(function* () {
      const dx = position.x - playerPos.x
      const dy = position.y - playerPos.y
      const dz = position.z - playerPos.z
      if (Math.abs(dx) > 5 || Math.abs(dy) > 2 || Math.abs(dz) > 5) return false
      const y = Math.floor(position.y)
      if (y < 0 || y >= CHUNK_HEIGHT) return false

      const x = Math.floor(position.x)
      const z = Math.floor(position.z)
      const chunkOpt = yield* chunkManagerService.getChunk({
        x: Math.floor(x / CHUNK_SIZE),
        z: Math.floor(z / CHUNK_SIZE),
      }).pipe(Effect.option)

      const lx = positiveModulo(x, CHUNK_SIZE)
      const lz = positiveModulo(z, CHUNK_SIZE)
      const index = y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
      const chunk = Option.getOrNull(chunkOpt)
      return chunk !== null && chunk.blocks[index] === blockTypeToIndex('FURNACE')
    })

  const getSelectedFurnacePosition = (): Effect.Effect<Option.Option<{ readonly x: number; readonly y: number; readonly z: number }>, never> =>
    Effect.gen(function* () {
      const playerPos = yield* playerService.getPosition(DEFAULT_PLAYER_ID).pipe(Effect.catchAll(() => Effect.succeed({ x: 0, y: 0, z: 0 })))
      const state = yield* Ref.get(stateRef)
      const selected = Option.getOrNull(state.selectedFurnacePosition)
      if (selected === null) return Option.none<{ readonly x: number; readonly y: number; readonly z: number }>()
      const isValid = yield* isFurnaceStillValid(playerPos, selected)
      if (isValid) return Option.some(selected)
      yield* Ref.update(stateRef, (current) => ({ ...current, selectedFurnacePosition: Option.none() }))
      return Option.none<{ readonly x: number; readonly y: number; readonly z: number }>()
    })

  const getNearestFurnaceState = (): Effect.Effect<Option.Option<FurnaceBlockState>, never> =>
    Effect.gen(function* () {
      const furnacePosOpt = yield* getSelectedFurnacePosition()
      const state = yield* Ref.get(stateRef)
      return Option.map(furnacePosOpt, (position) =>
        Option.getOrElse(HashMap.get(state.furnaces, furnaceKey(position)), () => emptyFurnaceAtPosition(position)),
      )
    })

  return {
    getSelectedFurnacePosition,
    getNearestFurnaceState,
  }
}
