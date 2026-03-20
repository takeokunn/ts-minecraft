import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import * as THREE from 'three'
import { SceneService, SceneServiceLive } from './scene-service'

// THREE.Scene, THREE.Object3D, and THREE.Mesh work without WebGL in Node.js,
// so no mocking is needed for this service.

describe('infrastructure/three/scene/SceneService', () => {
  it.effect('should expose all required methods', () =>
    Effect.gen(function* () {
      const service = yield* SceneService
      expect(typeof service.create).toBe('function')
      expect(typeof service.add).toBe('function')
      expect(typeof service.remove).toBe('function')
    }).pipe(Effect.provide(SceneServiceLive))
  )

  it.effect('create() returns a THREE.Scene instance', () =>
    Effect.gen(function* () {
      const service = yield* SceneService
      const scene = yield* service.create()
      expect(scene).toBeInstanceOf(THREE.Scene)
    }).pipe(Effect.provide(SceneServiceLive))
  )

  it.effect('add() adds an object to the scene children', () =>
    Effect.gen(function* () {
      const service = yield* SceneService
      const scene = yield* service.create()
      const object = new THREE.Object3D()
      yield* service.add(scene, object)
      expect(scene.children.length).toBe(1)
      expect(scene.children.includes(object)).toBe(true)
    }).pipe(Effect.provide(SceneServiceLive))
  )

  it.effect('remove() removes a previously added object from the scene', () =>
    Effect.gen(function* () {
      const service = yield* SceneService
      const scene = yield* service.create()
      const object = new THREE.Object3D()
      yield* service.add(scene, object)
      expect(scene.children.length).toBe(1)
      yield* service.remove(scene, object)
      expect(scene.children.length).toBe(0)
      expect(scene.children.includes(object)).toBe(false)
    }).pipe(Effect.provide(SceneServiceLive))
  )

  it.effect('create() returns a distinct scene on each call', () =>
    Effect.gen(function* () {
      const service = yield* SceneService
      const sceneA = yield* service.create()
      const sceneB = yield* service.create()
      expect(sceneA === sceneB).toBe(false)
    }).pipe(Effect.provide(SceneServiceLive))
  )

  it.effect('add() with a Mesh object works correctly', () =>
    Effect.gen(function* () {
      const service = yield* SceneService
      const scene = yield* service.create()
      const mesh = new THREE.Mesh()
      yield* service.add(scene, mesh)
      expect(scene.children.length).toBe(1)
      expect(scene.children.includes(mesh)).toBe(true)
    }).pipe(Effect.provide(SceneServiceLive))
  )

  it.effect('remove() is safe to call on an object not in the scene', () =>
    Effect.gen(function* () {
      const service = yield* SceneService
      const scene = yield* service.create()
      const object = new THREE.Object3D()
      yield* service.remove(scene, object)
      expect(scene.children.length).toBe(0)
    }).pipe(Effect.provide(SceneServiceLive))
  )
})
