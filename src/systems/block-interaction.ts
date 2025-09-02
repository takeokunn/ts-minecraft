import { Effect, HashSet, Record, Ref } from 'effect'
import { createArchetype } from '@/domain/archetypes'
import { PlacedBlock } from '@/domain/block'
import { createTargetNone, Hotbar, InputState, Position, setInputState, Target } from '@/domain/components'
import { playerTargetQuery } from '@/domain/queries'
import { System } from '@/runtime/loop'
import * as World from '@/runtime/world-pure'
import { WorldContext } from '@/runtime/context'
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
    const blockKey = `${targetPosition.x},${targetPosition.y},${targetPosition.z}`

    yield* $(World.removeEntity(target.entityId))
    const { world } = yield* $(WorldContext)
    yield* $(
      Ref.update(world, (w) => ({
        ...w,
        globalState: {
          ...w.globalState,
          editedBlocks: {
            placed: Record.remove(w.globalState.editedBlocks.placed, blockKey),
            destroyed: HashSet.add(w.globalState.editedBlocks.destroyed, blockKey),
          },
        },
      })),
    )
  })

export const handlePlaceBlock = (target: Target, hotbar: Hotbar) =>
  Effect.gen(function* ($) {
    if (target._tag !== 'block') {
      return
    }

    const targetPosition = yield* $(World.getComponent(target.entityId, 'position'))

    const newBlockPos = getNewBlockPosition(targetPosition, target.face)
    const selectedBlockType = hotbar.slots[hotbar.selectedIndex]
    if (!selectedBlockType) {
      return
    }

    const newBlockArchetype = createArchetype({
      type: 'block',
      pos: newBlockPos,
      blockType: selectedBlockType,
    })
    yield* $(World.addArchetype(newBlockArchetype))

    const blockKey = `${newBlockPos.x},${newBlockPos.y},${newBlockPos.z}`
    const newBlock: PlacedBlock = {
      position: newBlockPos,
      blockType: selectedBlockType,
    }

    const { world } = yield* $(WorldContext)
    yield* $(
      Ref.update(world, (w) => ({
        ...w,
        globalState: {
          ...w.globalState,
          editedBlocks: {
            placed: Record.set(w.globalState.editedBlocks.placed, blockKey, newBlock),
            destroyed: HashSet.remove(w.globalState.editedBlocks.destroyed, blockKey),
          },
        },
      })),
    )
  })

type PlayerTargetQueryResult = QueryResult<(typeof playerTargetQuery.components)>

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

export const blockInteractionSystem: System = Effect.gen(function* ($) {
  const players = yield* $(World.query(playerTargetQuery))
  yield* $(
    Effect.forEach(players, processPlayerInteraction, {
      discard: true,
      concurrency: 'unbounded',
    }),
    Effect.catchAll(() => Effect.void), // Ignore errors for now
  )
})