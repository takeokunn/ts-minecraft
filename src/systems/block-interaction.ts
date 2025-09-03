import { Effect, Match, Option } from 'effect'
import { createArchetype } from '@/domain/archetypes'
import { Hotbar, InputState, Position, Target, TargetBlock, TargetNone } from '@/domain/components'
import { playerTargetQuery } from '@/domain/queries'
import { World } from '@/runtime/services'
import { EntityId } from '@/domain/entity'
import { Float } from '@/domain/common'

const handleDestroyBlock = (entityId: EntityId, target: TargetBlock) =>
  Effect.gen(function* ($) {
    const world = yield* $(World)
    yield* $(world.removeEntity(target.entityId))
    yield* $(world.updateComponent(entityId, 'target', new TargetNone()))
  })

const handlePlaceBlock = (
  entityId: EntityId,
  target: TargetBlock,
  hotbar: Hotbar,
  inputState: InputState,
) =>
  Effect.gen(function* ($) {
    const world = yield* $(World)
    const blockType = Option.fromNullable(hotbar.slots[hotbar.selectedIndex])

    yield* $(
      Option.match(blockType, {
        onNone: () => Effect.void,
        onSome: (blockType) =>
          Effect.gen(function* ($) {
            if (blockType === 'air') {
              return
            }

            const newPosition = new Position({
              x: Float(target.position.x + target.face[0]),
              y: Float(target.position.y + target.face[1]),
              z: Float(target.position.z + target.face[2]),
            })

            const newBlockArchetype = yield* $(
              createArchetype({
                type: 'block',
                pos: newPosition,
                blockType,
              }),
            )

            yield* $(world.addArchetype(newBlockArchetype))
            yield* $(world.updateComponent(entityId, 'inputState', { ...inputState, place: false }))
          }),
      }),
    )
  })

const handleInteraction = ({
  entityId,
  inputState,
  target,
  hotbar,
}: {
  entityId: EntityId
  inputState: InputState
  target: Target
  hotbar: Hotbar
}) =>
  Match.value({ inputState, target }).pipe(
    Match.when(
      { inputState: { destroy: true }, target: { _tag: 'block' } },
      ({ target }) => handleDestroyBlock(entityId, target),
    ),
    Match.when(
      { inputState: { place: true }, target: { _tag: 'block' } },
      ({ target }) => handlePlaceBlock(entityId, target, hotbar, inputState),
    ),
    Match.orElse(() => Effect.void),
  )

export const blockInteractionSystem = Effect.gen(function* ($) {
  const world = yield* $(World)
  const { entities, components } = yield* $(world.querySoA(playerTargetQuery))

  yield* $(
    Effect.forEach(
      entities,
      (entityId, i) => {
        const { inputState, target, hotbar } = components
        return handleInteraction({
          entityId,
          inputState: inputState[i],
          target: target[i],
          hotbar: hotbar[i],
        })
      },
      { concurrency: 'inherit' },
    ),
  )
})
