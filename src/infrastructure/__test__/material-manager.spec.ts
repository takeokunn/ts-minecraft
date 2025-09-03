import { Effect } from 'effect'
import { describe, it, assert } from '@effect/vitest'
import { MaterialManagerLive, MaterialNotFoundError } from '../material-manager'
import { MaterialManager } from '@/runtime/services'
import * as THREE from 'three'

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
})
