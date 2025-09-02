import { Effect, Option, Array as A } from 'effect'
import { createArchetype } from '@/domain/archetypes'
import { PlacedBlock } from '@/domain/block'
import { createTargetNone, Hotbar, Position, setInputState, Target } from '@/domain/components'
import { playerTargetQuery } from '@/domain/queries'
import * as World from '@/runtime/world-pure'
import { QueryResult } from '@/runtime/world-pure'

const getNewBlockPosition = (targetPosition: Position, face: { readonly x: number; readonly y: number; readonly z: number }): Position => ({
  x: targetPosition.x + face.x,
  y: targetPosition.y + face.y,
  z: targetPosition.z + face.z,
})

export const handleDestroyBlock = (target: Target) =>
  Effect.gen(function* ($) {
    if (target._tag !== 'block') {
      return
    }

    const targetPosition = yield* $(World.getComponent(target.entityId, 'position'))
    yield* $(World.removeEntity(target.entityId))
    yield* $(World.recordBlockDestruction(targetPosition))
  })

export const handlePlaceBlock = (target: Target, hotbar: Hotbar) =>
  Effect.gen(function* ($) {
    if (target._tag !== 'block') {
      return
    }

    yield* $(
      A.get(hotbar.slots, hotbar.selectedIndex),
      Option.match({
        onNone: () => Effect.void, // Do nothing if index is out of bounds
        onSome: (selectedBlockType) =>
          Effect.gen(function* ($) {
            const targetPosition = yield* $(World.getComponent(target.entityId, 'position'))
            const newBlockPos = getNewBlockPosition(targetPosition, target.face)

            const newBlockArchetype = createArchetype({
              type: 'block',
              pos: newBlockPos,
              blockType: selectedBlockType,
            })
            yield* $(World.addArchetype(newBlockArchetype))

            const newBlock: PlacedBlock = {
              position: newBlockPos,
              blockType: selectedBlockType,
            }
            yield* $(World.recordBlockPlacement(newBlock))
          }),
      }),
    )
  })

type PlayerTargetQueryResult = QueryResult<typeof playerTargetQuery.components>

const processPlayerInteraction = (player: PlayerTargetQueryResult) =>
  Effect.gen(function* ($) {
    const { entityId, target, inputState, hotbar } = player

    if (target._tag === 'block') {
      if (inputState.destroy) {
        yield* $(handleDestroyBlock(target))
        // After destroying, the target might become invalid.
        yield* $(World.updateComponent(entityId, 'target', createTargetNone()))
      } else if (inputState.place) {
        yield* $(handlePlaceBlock(target, hotbar))
        // Reset place input to prevent repeated placement
        const newPlayerInput = setInputState(inputState, { place: false })
        yield* $(World.updateComponent(entityId, 'inputState', newPlayerInput))
      }
    }
  })

export const blockInteractionSystem = Effect.gen(function* ($) {
  const players = yield* $(World.query(playerTargetQuery))
  yield* $(
    Effect.forEach(players, processPlayerInteraction, {
      discard: true,
      concurrency: 'unbounded',
    }),
    Effect.catchAllCause((cause) => Effect.logError('An error occurred in blockInteractionSystem', cause)),
  )
})