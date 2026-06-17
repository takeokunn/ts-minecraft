import { Effect, HashMap, Option, Ref } from 'effect'
import { DEFAULT_PLAYER_ID, blockTypeToIndex } from '@ts-minecraft/core'
import type { PlayerServicePortShape, WorldBlockQueryPortShape } from '@ts-minecraft/world'
import type { ChestBlockState } from '../domain/chest-state'
import {
  type ChestState,
  chestKey,
  emptyChestAtPosition,
} from '../domain/chest-service-utils'

export const makeChestHelpers = (
  playerService: PlayerServicePortShape,
  worldBlockQueryPort: WorldBlockQueryPortShape,
  stateRef: Ref.Ref<ChestState>,
) => {
  const isChestStillValid = (playerPos: { readonly x: number; readonly y: number; readonly z: number }, position: { readonly x: number; readonly y: number; readonly z: number }): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* () {
      const dx = position.x - playerPos.x
      const dy = position.y - playerPos.y
      const dz = position.z - playerPos.z
      if (Math.abs(dx) > 5 || Math.abs(dy) > 2 || Math.abs(dz) > 5) return false
      const blockIndexOpt = yield* worldBlockQueryPort.getBlockIndexAt(position)
      return Option.isSome(blockIndexOpt) && blockIndexOpt.value === blockTypeToIndex('CHEST')
    })

  const getSelectedChestPosition = (): Effect.Effect<Option.Option<{ readonly x: number; readonly y: number; readonly z: number }>, never> =>
    Effect.gen(function* () {
      const playerPos = yield* playerService.getPosition(DEFAULT_PLAYER_ID).pipe(Effect.catchAll(() => Effect.succeed({ x: 0, y: 0, z: 0 })))
      const state = yield* Ref.get(stateRef)
      const selected = Option.getOrNull(state.selectedChestPosition)
      if (selected === null) return Option.none<{ readonly x: number; readonly y: number; readonly z: number }>()
      const isValid = yield* isChestStillValid(playerPos, selected)
      if (isValid) return Option.some(selected)
      yield* Ref.update(stateRef, (current) => ({ ...current, selectedChestPosition: Option.none() }))
      return Option.none<{ readonly x: number; readonly y: number; readonly z: number }>()
    })

  const getNearestChestState = (): Effect.Effect<Option.Option<ChestBlockState>, never> =>
    Effect.gen(function* () {
      const chestPosOpt = yield* getSelectedChestPosition()
      const state = yield* Ref.get(stateRef)
      return Option.map(chestPosOpt, (position) =>
        Option.getOrElse(HashMap.get(state.chests, chestKey(position)), () => emptyChestAtPosition(position)),
      )
    })

  return {
    getSelectedChestPosition,
    getNearestChestState,
  }
}
