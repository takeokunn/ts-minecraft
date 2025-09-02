import { Effect, Layer, Ref, Option } from 'effect'
import { describe, it, expect } from 'vitest'
import { createArchetype } from '@/domain/archetypes'
import { World, WorldLive } from '@/runtime/world'
import { updateTargetSystem } from '../update-target-system'
import { RaycastResultService } from '@/runtime/services'
import { RaycastResult } from '@/infrastructure/raycast-three'
import { EntityId } from '@/domain/entity'
import { TargetBlock } from '@/domain/components'
import { playerTargetQuery } from '@/domain/queries'

const setupWorld = Effect.gen(function* (_) {
  const world = yield* _(World)
  const playerArchetype = createArchetype({
    type: 'player',
    pos: { x: 0, y: 0, z: 0 },
  })
  yield* _(world.addArchetype(playerArchetype))
})

describe('updateTargetSystem', () => {
  it('should update the player target to a block when raycast hits', async () => {
    const raycastResult: RaycastResult = {
      entityId: 1 as EntityId,
      face: { x: 0, y: 1, z: 0 },
      intersection: { x: 0, y: 0, z: 0 },
    }
    const raycastResultRef = Ref.unsafeMake(Option.some(raycastResult))
    const MockRaycastResult = Layer.succeed(RaycastResultService, raycastResultRef)

    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      yield* _(setupWorld)
      yield* _(updateTargetSystem)

      const player = (yield* _(world.query(playerTargetQuery)))[0]!
      const target = player.target
      expect(target._tag).toBe('block')
      expect((target as TargetBlock).entityId).toBe(raycastResult.entityId)
    })

    await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, MockRaycastResult)))
  })

  it('should update the player target to none when raycast misses', async () => {
    const raycastResultRef = Ref.unsafeMake(Option.none<RaycastResult>())
    const MockRaycastResult = Layer.succeed(RaycastResultService, raycastResultRef)

    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      yield* _(setupWorld)
      yield* _(updateTargetSystem)

      const player = (yield* _(world.query(playerTargetQuery)))[0]!
      const target = player.target
      expect(target._tag).toBe('none')
    })

    await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, MockRaycastResult)))
  })
})
