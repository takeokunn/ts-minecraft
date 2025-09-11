import { Effect, Match, Option } from 'effect'
import { createArchetype } from '@/domain/archetypes'
import { Hotbar, InputState, Position, TargetBlock, TargetNone } from '@/core/components'
import { queries } from '@/core/queries'
import { World } from '@/runtime/services'
import { EntityId } from '@/core/entities/entity'
import { Float, toFloat } from '@/core/common'

const handleDestroyBlock = (world: World, entityId: EntityId, target: TargetBlock) =>
  Effect.gen(function* () {
    yield* world.removeEntity(target.entityId)
    yield* world.updateComponent(entityId, 'target', new TargetNone({}))
  })

const handlePlaceBlock = (
  world: World,
  entityId: EntityId,
  target: TargetBlock,
  hotbar: Hotbar,
  inputState: InputState,
) =>
  Option.fromNullable(hotbar.slots[hotbar.selectedIndex]).pipe(
    Option.match({
      onNone: () => Effect.void,
      onSome: (blockType) =>
        Match.value(blockType).pipe(
          Match.when('air', () => Effect.void),
          Match.orElse((blockType) =>
            Effect.gen(function* () {
              const newPosition = new Position({
                x: toFloat(target.position.x + target.face[0]),
                y: toFloat(target.position.y + target.face[1]),
                z: toFloat(target.position.z + target.face[2]),
              })

              const newBlockArchetype = yield* createArchetype({
                type: 'block',
                pos: newPosition,
                blockType,
              })

              yield* world.addArchetype(newBlockArchetype)
              yield* world.updateComponent(entityId, 'inputState', { ...inputState, place: false })
            }),
          ),
        ),
    }),
  )

export const blockInteractionSystem = Effect.gen(function* () {
  const world = yield* World
  const { entities, components } = yield* world.querySoA(queries.playerTarget)

  yield* Effect.forEach(
    entities,
    (entityId, i) => {
      const inputState = components.inputState[i]
      const target = components.target[i]
      const hotbar = components.hotbar[i]

      return Match.value({ inputState, target }).pipe(
        Match.when({ inputState: { destroy: true }, target: { _tag: 'block' } }, ({ target }) =>
          handleDestroyBlock(world, entityId, target),
        ),
        Match.when({ inputState: { place: true }, target: { _tag: 'block' } }, ({ target }) =>
          handlePlaceBlock(world, entityId, target, hotbar, inputState),
        ),
        Match.orElse(() => Effect.void),
      )
    },
    { discard: true, concurrency: 'inherit' },
  )
})
