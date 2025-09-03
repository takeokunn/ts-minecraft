import { Effect, Layer, Scope } from 'effect'
import { describe, it, assert, vi } from '@effect/vitest'
import { MaterialManagerLive, MaterialNotFoundError } from '../material-manager'
import { MaterialManager } from '@/runtime/services'
import * as THREE from 'three'

// Mock the dispose function to track calls
const mockDispose = vi.fn()
vi.spyOn(THREE.MeshStandardMaterial.prototype, 'dispose').mockImplementation(mockDispose)

describe('MaterialManager', () => {
  it.effect('should return a material', () =>
    Effect.gen(function* (_) {
      const manager = yield* _(MaterialManager)
      const material = yield* _(manager.getMaterial('chunk'))
      assert.instanceOf(material, THREE.MeshStandardMaterial)
    }).pipe(Effect.provide(MaterialManagerLive)))

  it.effect('should fail if material is not found', () =>
    Effect.gen(function* (_) {
      const manager = yield* _(MaterialManager)
      const effect = manager.getMaterial('non-existent')
      const error = yield* _(effect, Effect.flip)
      assert.instanceOf(error, MaterialNotFoundError)
    }).pipe(Effect.provide(MaterialManagerLive)))

  it.effect('should dispose materials on layer release', () =>
    Effect.gen(function* (_) {
      mockDispose.mockClear()
      const scope = yield* _(Scope.make())
      const layer = yield* _(Layer.build(MaterialManagerLive), Effect.provideService(Scope.Scope, scope))
      const manager = yield* _(Effect.context(layer), Effect.map((ctx) => ctx.get(MaterialManager)))

      // Ensure material is created
      yield* _(manager.getMaterial('chunk'))
      assert.strictEqual(mockDispose.mock.calls.length, 0)

      // Release the scope and check if dispose was called
      yield* _(Scope.close(scope, Effect.void))
      assert.strictEqual(mockDispose.mock.calls.length, 1)
    }))
})
