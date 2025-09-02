import { Effect } from 'effect'
import * as HashSet from 'effect/HashSet'
import * as Option from 'effect/Option'
import * as ReadonlyRecord from 'effect/Record'
import { match } from 'ts-pattern'
import { createArchetype } from '@/domain/archetypes'
import { PlacedBlock } from '@/domain/block'
import { createTargetNone, Position, setInputState } from '@/domain/components'
import { playerTargetQuery } from '@/domain/queries'
import { System } from '@/runtime/loop'
import { World } from '@/runtime/world'
import { Hotbar, InputState, Player, Target } from '@/domain/components'
import { EntityId } from '@/domain/entity'

type PlayerQueryResult = {
  readonly entityId: EntityId
  readonly player: Player
  readonly inputState: InputState
  readonly target: Target
  readonly hotbar: Hotbar
}

// type PlayerQueryResult = Awaited<ReturnType<World['query']>>[number] & {
//   readonly components: 'player' | 'inputState' | 'target' | 'hotbar'
// }

const getNewBlockPosition = (targetPosition: Position, face: { readonly x: number; readonly y: number; readonly z: number }): Position => ({
  x: targetPosition.x + face.x,
  y: targetPosition.y + face.y,
  z: targetPosition.z + face.z,
})

export const handleDestroyBlock = (player: PlayerQueryResult) =>
  Effect.gen(function* () {
    const world = yield* World
    if (player.target._tag !== 'block') {
      return
    }

    const targetPositionOpt = yield* world.getComponent(player.target.entityId, 'position')
    if (Option.isNone(targetPositionOpt)) {
      return
    }
    const targetPosition = targetPositionOpt.value
    const blockKey = `${targetPosition.x},${targetPosition.y},${targetPosition.z}`

    yield* world.removeEntity(player.target.entityId)
    yield* world.update((w) => ({
      ...w,
      globalState: {
        ...w.globalState,
        editedBlocks: {
          placed: ReadonlyRecord.remove(w.globalState.editedBlocks.placed, blockKey),
          destroyed: HashSet.add(w.globalState.editedBlocks.destroyed, blockKey),
        },
      },
    }))
    yield* world.updateComponent(player.entityId, 'target', createTargetNone())
  })

export const handlePlaceBlock = (player: PlayerQueryResult) =>
  Effect.gen(function* () {
    const world = yield* World
    if (player.target._tag !== 'block') {
      return
    }

    const targetPositionOpt = yield* world.getComponent(player.target.entityId, 'position')
    if (Option.isNone(targetPositionOpt)) {
      return
    }
    const targetPosition = targetPositionOpt.value

    const { hotbar } = player
    const newBlockPos = getNewBlockPosition(targetPosition, player.target.face)
    const selectedBlockType = hotbar.slots[hotbar.selectedIndex]
    if (!selectedBlockType) return

    const newBlockArchetype = createArchetype({
      type: 'block',
      pos: newBlockPos,
      blockType: selectedBlockType,
    })
    yield* world.addArchetype(newBlockArchetype)

    const blockKey = `${newBlockPos.x},${newBlockPos.y},${newBlockPos.z}`
    const newBlock: PlacedBlock = {
      position: newBlockPos,
      blockType: selectedBlockType,
    }

    yield* world.update((w) => ({
      ...w,
      globalState: {
        ...w.globalState,
        editedBlocks: {
          placed: ReadonlyRecord.set(w.globalState.editedBlocks.placed, blockKey, newBlock),
          destroyed: HashSet.remove(w.globalState.editedBlocks.destroyed, blockKey),
        },
      },
    }))

    const newPlayerInput = setInputState(player.inputState, { place: false })
    yield* world.updateComponent(player.entityId, 'inputState', newPlayerInput)
  })

export const blockInteractionSystem: System = Effect.gen(function* () {
  const world = yield* World
  const players = yield* world.query(playerTargetQuery)

  yield* Effect.forEach(
    players,
    (player) =>
      match(player)
        .with({ target: { _tag: 'block' }, inputState: { destroy: true } }, handleDestroyBlock)
        .with({ target: { _tag: 'block' }, inputState: { place: true } }, handlePlaceBlock)
        .otherwise(() => Effect.void),
    { discard: true },
  )
})
