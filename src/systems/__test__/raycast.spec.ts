import { Effect, Layer, Option, Ref } from 'effect'
import { describe, it, expect } from 'vitest'
import { Scene } from 'three'
import { createArchetype } from '@/domain/archetypes'
import { RaycastResult, RaycastService } from '@/infrastructure/raycast-three'
import { ThreeContextService } from '@/infrastructure/renderer-three/context'
import { ThreeContext } from '@/infrastructure/types'
import { RaycastResultService } from '@/runtime/services'
import * as World from '@/runtime/world-pure'
import { provideTestLayer } from 'test/utils'
import { raycastSystem } from '../raycast'
import { toEntityId } from '@/domain/entity'

const MockRaycast = (result: Option.Option<RaycastResult>) =>
  Layer.succeed(
    RaycastService,
    RaycastService.of({
      cast: () => Effect.succeed(result),
    }),
  )

const setupWorld = () =>
  Effect.gen(function* ($) {
    const blockArchetype = createArchetype({
      type: 'block',
      pos: { x: 0, y: 0, z: 0 },
      blockType: 'dirt',
    })
    yield* $(World.addArchetype(blockArchetype))
  })

describe('raycastSystem', () => {
  it('should update raycast result', () =>
    Effect.gen(function* ($) {
      const mockRaycastResult: RaycastResult = {
        entityId: toEntityId(1),
        face: { x: 0, y: 1, z: 0 },
        intersection: {} as any,
      }
      const raycastResultRef = yield* $(RaycastResultService)
      const MockThreeContext = Layer.succeed(ThreeContextService, { scene: new Scene() } as ThreeContext)

      yield* $(setupWorld())
      yield* $(Effect.provide(raycastSystem, MockThreeContext.pipe(Layer.provide(MockRaycast(Option.some(mockRaycastResult))))))

      const result = yield* $(Ref.get(raycastResultRef))
      expect(Option.isSome(result)).toBe(true)
    }).pipe(Effect.provide(provideTestLayer())))
})
