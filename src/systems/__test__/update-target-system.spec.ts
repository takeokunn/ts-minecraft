import { Effect, Layer, Option, Ref } from 'effect'
import { describe, it, expect } from '@effect/vitest'
import { BufferGeometry, InstancedMesh, Mesh, Scene } from 'three'
import { createArchetype } from '@/domain/archetypes'
import { RaycastResult, RaycastService } from '@/infrastructure/raycast-three'
import { ThreeContextService } from '@/infrastructure/renderer-three/context'
import { ThreeContext } from '@/infrastructure/types'
import { RaycastResultService } from '@/runtime/services'
import * as World from '@/domain/world'
import { provideTestLayer } from 'test/utils'
import { updateTargetSystem } from '../update-target-system'
import { toEntityId } from '@/domain/entity'
import { Intersection } from 'three/src/core/Raycaster'

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

const createMockThreeContext = (): ThreeContext => ({
  scene: new Scene(),
  camera: {} as any, // Mock camera if needed, otherwise {} as any is fine if not used
  renderer: {} as any, // Mock renderer if needed
  highlightMesh: new Mesh(),
  stats: { dom: document.createElement('div'), begin: () => {}, end: () => {} },
  chunkMeshes: new Map<string, Mesh<BufferGeometry>>(),
  instancedMeshes: new Map<string, InstancedMesh>(),
})

describe('raycastSystem', () => {
  it('should update raycast result', () =>
    Effect.gen(function* ($) {
      const mockIntersection: Intersection = {
        distance: 1,
        point: { x: 0, y: 0, z: 0 } as any,
        object: new Mesh(),
      }

      const mockRaycastResult: RaycastResult = {
        entityId: toEntityId(1),
        face: { x: 0, y: 1, z: 0 },
        intersection: mockIntersection,
      }
      const raycastResultRef = yield* $(RaycastResultService)
      const MockThreeContext = Layer.succeed(ThreeContextService, createMockThreeContext())

      yield* $(setupWorld())
      yield* $(Effect.provide(raycastSystem, MockThreeContext.pipe(Layer.provide(MockRaycast(Option.some(mockRaycastResult))))))

      const result = yield* $(Ref.get(raycastResultRef))
      expect(Option.isSome(result)).toBe(true)
    }).pipe(Effect.provide(provideTestLayer())))
})
