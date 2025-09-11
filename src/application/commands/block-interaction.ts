import { Effect, Match, Option } from 'effect'
import { createArchetype } from '@/domain/archetypes'
import { Hotbar, InputState, Position, TargetBlock, TargetNone } from '@/domain/entities/components'
import { playerTargetQuery } from '@/domain/queries'
import { WorldService } from '@/application/services/world.service'
import { EntityService } from '@/domain/services/entity.service'
import { EntityId } from '@/domain/entities'
import { toFloat } from '@/domain/value-objects/common'

const handleDestroyBlock = (world: WorldService, entityId: EntityId, target: TargetBlock) =>
  Effect.gen(function* () {
    yield* world.removeEntity(target.entityId)
    yield* world.updateComponent(entityId, 'target', { _tag: 'none' })
  })

const handlePlaceBlock = (
  world: WorldService,
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
              const newPosition = {
                x: toFloat(target.position.x + target.face[0]),
                y: toFloat(target.position.y + target.face[1]),
                z: toFloat(target.position.z + target.face[2]),
              }

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
  const world = yield* WorldService
  const { entities, components } = yield* world.querySoA(playerTargetQuery)

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
