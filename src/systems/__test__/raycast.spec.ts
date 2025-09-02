import { Effect, Layer, Ref, Option } from 'effect'
import { describe, it, expect } from 'vitest'
import { createArchetype } from '@/domain/archetypes'
import { World, WorldLive } from '@/runtime/world'
import { raycastSystem } from '../raycast'
import { RaycastResultService, ThreeContextService } from '@/runtime/services'
import { RaycastResult, RaycastService } from '@/infrastructure/raycast-three'
import { EntityId } from '@/domain/entity'
import { ThreeContext } from '@/infrastructure/types'

const mockRaycastResult = (result: Option.Option<RaycastResult>) =>
  Layer.succeed(
    RaycastService,
    RaycastService.of({
      cast: () => Effect.succeed(result),
    }),
  )

const setupWorld = Effect.gen(function* (_) {
  const world = yield* _(World)
  const blockArchetype = createArchetype({
    type: 'block',
    pos: { x: 0, y: 0, z: 0 },
    blockType: 'stone',
  })
  yield* _(world.addArchetype(blockArchetype))
})

describe('raycastSystem', () => {
  it('should update raycast result when it changes', async () => {
    const raycastResultRef = Ref.unsafeMake(Option.none<RaycastResult>())
    const MockRaycastResult = Layer.succeed(RaycastResultService, raycastResultRef)

    const newResult: RaycastResult = {
      entityId: 1 as EntityId,
      face: { x: 0, y: 1, z: 0 },
      intersection: { x: 0, y: 0, z: 0 },
    }
    const MockRaycast = mockRaycastResult(Option.some(newResult))

    const MockThreeContext = Layer.succeed(ThreeContextService, {} as ThreeContext)

    const program = Effect.gen(function* (_) {
      yield* _(setupWorld)
      yield* _(raycastSystem)
      return yield* _(Ref.get(raycastResultRef))
    })

    const finalResult = await Effect.runPromise(Effect.provide(program, Layer.mergeAll(WorldLive, MockRaycastResult, MockRaycast, MockThreeContext)))

    expect(finalResult).toEqual(Option.some(newResult))
  })

  it('should not update raycast result if it is the same', async () => {
    const initialResult: RaycastResult = {
      entityId: 1 as EntityId,
      face: { x: 0, y: 1, z: 0 },
      intersection: { x: 0, y: 0, z: 0 },
    }
    const raycastResultRef = Ref.unsafeMake(Option.some(initialResult))
    const MockRaycastResult = Layer.succeed(RaycastResultService, raycastResultRef)
    const MockRaycast = mockRaycastResult(Option.some(initialResult))
    const MockThreeContext = Layer.succeed(ThreeContextService, {} as ThreeContext)

    const program = Effect.gen(function* (_) {
      yield* _(setupWorld)
      const initialRefValue = yield* _(Ref.get(raycastResultRef))
      yield* _(raycastSystem)
      const finalRefValue = yield* _(Ref.get(raycastResultRef))
      // We check if the object reference is the same, which it should be if not updated.
      expect(finalRefValue).toBe(initialRefValue)
    })

    await Effect.runPromise(Effect.provide(program, Layer.mergeAll(WorldLive, MockRaycastResult, MockRaycast, MockThreeContext)))
  })
})