import { Effect, HashMap, Option, Ref } from 'effect'
import { DEFAULT_PLAYER_ID, blockTypeToIndex, type BlockType } from '@ts-minecraft/core'
import type { PlayerServicePortShape, WorldBlockQueryPortShape } from '@ts-minecraft/world'
import type { FurnaceBlockState } from '../domain/furnace-state'
import {
  type FurnaceState,
  emptyFurnaceAtPosition,
  furnaceKey,
} from '../domain/furnace-service-utils'
import type { InventoryService } from './inventory-service'
import type { FurnaceItemStack } from '../domain/furnace-state'
import { tryInventoryRollbackTransaction } from './inventory-rollback'

export const makeFurnaceHelpers = (
  playerService: PlayerServicePortShape,
  worldBlockQueryPort: WorldBlockQueryPortShape,
  stateRef: Ref.Ref<FurnaceState>,
) => {
  const isFurnaceStillValid = (playerPos: { readonly x: number; readonly y: number; readonly z: number }, position: { readonly x: number; readonly y: number; readonly z: number }): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* () {
      const dx = position.x - playerPos.x
      const dy = position.y - playerPos.y
      const dz = position.z - playerPos.z
      if (Math.abs(dx) > 5 || Math.abs(dy) > 2 || Math.abs(dz) > 5) return false
      const blockIndexOpt = yield* worldBlockQueryPort.getBlockIndexAt(position)
      return Option.isSome(blockIndexOpt) && blockIndexOpt.value === blockTypeToIndex('FURNACE')
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

export const tryDismantleFurnaceItems = (
  inventoryService: Pick<InventoryService, 'serialize' | 'deserialize' | 'addBlock'>,
  dropped: ReadonlyArray<FurnaceItemStack>,
): Effect.Effect<boolean, never> =>
  tryInventoryRollbackTransaction(
    inventoryService,
    Effect.forEach(
      dropped,
      (item) =>
        inventoryService.addBlock(item.itemType as BlockType, item.count),
      { concurrency: 1 },
    )
      .pipe(Effect.map(() => undefined)),
  ).pipe(Effect.map(Option.isNone))
