import { Effect, Layer, Option, Ref } from 'effect'
import { describe, it } from '@effect/vitest'
import * as Assert from '@effect/test/Assert'
import { createArchetype } from '@/domain/archetypes'
import { createTargetBlock, createTargetNone } from '@/domain/components'
import { playerTargetQuery } from '@/domain/queries'
import { RaycastResult } from '@/infrastructure/raycast-three'
import { RaycastResultService } from '@/runtime/services'
import * as World from '@/runtime/world-pure'
import { provideTestWorld } from 'test/utils'
import { updateTargetSystem } from '../update-target-system'

const setupWorld = () =>
  Effect.gen(function* ($) {
    const playerArchetype = createArchetype({
      type: 'player',
      pos: { x: 0, y: 0, z: 0 },
    })
    const playerId = yield* $(World.addArchetype(playerArchetype))
    const blockArchetype = createArchetype({
      type: 'block',
      pos: { x: 1, y: 1, z: 1 },
      blockType: 'grass',
    })
    const blockId = yield* $(World.addArchetype(blockArchetype))
    return { playerId, blockId }
  })

describe('updateTargetSystem', () => {
  it('should update target to the block hit by raycast', () =>
    Effect.gen(function* ($) {
      const { blockId } = yield* $(setupWorld())
      const face = { x: 0, y: 1, z: 0 }
      const raycastResult: RaycastResult = { entityId: blockId, face, intersection: {} as any }
      const raycastResultRef = yield* $(RaycastResultService)
      yield* $(Ref.set(raycastResultRef, Option.some(raycastResult)))

      yield* $(updateTargetSystem)

      const player = (yield* $(World.query(playerTargetQuery)))[0]
      yield* $(Assert.isDefined(player))
      yield* $(Assert.deepStrictEqual(player.target, createTargetBlock(blockId, face)))
    }).pipe(Effect.provide(provideTestWorld())))

  it('should update target to none when raycast hits nothing', () =>
    Effect.gen(function* ($) {
      yield* $(setupWorld())
      const raycastResultRef = yield* $(RaycastResultService)
      yield* $(Ref.set(raycastResultRef, Option.none()))

      yield* $(updateTargetSystem)

      const player = (yield* $(World.query(playerTargetQuery)))[0]
      yield* $(Assert.isDefined(player))
      yield* $(Assert.deepStrictEqual(player.target, createTargetNone()))
    }).pipe(Effect.provide(provideTestWorld())))
})