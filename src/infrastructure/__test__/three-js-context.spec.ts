import { vi } from 'vitest'

// Mock WebGLRenderer to avoid errors in happy-dom
const mockSetSize = vi.fn()
const mockRender = vi.fn()
const mockSetClearColor = vi.fn()
const mockDomElement = document.createElement('canvas')

vi.mock('three/src/renderers/WebGLRenderer', () => {
  const WebGLRenderer = vi.fn().mockImplementation(() => ({
    setSize: mockSetSize,
    setClearColor: mockSetClearColor,
    domElement: mockDomElement,
    render: mockRender,
  }))
  return { WebGLRenderer }
})

import { Effect, Layer, Scope } from 'effect'
import { describe, it, expect, assert } from '@effect/vitest'
import { ThreeJsContextLive, ThreeJsContext } from '../three-js-context'
import * as THREE from 'three'

describe('ThreeJsContext', () => {
  it.effect('should create the context and add elements to the DOM', () =>
    Effect.gen(function* (_) {
      const scope = yield* _(Scope.make())
      const layer = yield* _(Layer.build(ThreeJsContextLive), Effect.provideService(Scope.Scope, scope))
      const context = yield* _(Effect.context(layer), Effect.map((ctx) => ctx.get(ThreeJsContext)))

      expect(context).toBeDefined()
      expect(context.renderer).toBeDefined()
      expect(context.scene).toBeDefined()
      expect(context.camera).toBeDefined()
      assert.isNotNull(document.body.querySelector('canvas'))

      yield* _(Scope.close(scope, Effect.void))
      assert.isNull(document.body.querySelector('canvas'))
    }))

  it.effect('should handle window resize events', () =>
    Effect.gen(function* (_) {
      const scope = yield* _(Scope.make())
      const layer = yield* _(Layer.build(ThreeJsContextLive), Effect.provideService(Scope.Scope, scope))
      const context = yield* _(Effect.context(layer), Effect.map((ctx) => ctx.get(ThreeJsContext)))

      mockSetSize.mockClear()
      const spy = vi.spyOn(context.camera, 'updateProjectionMatrix')

      window.innerWidth = 1024
      window.innerHeight = 768
      window.dispatchEvent(new Event('resize'))

      expect(mockSetSize).toHaveBeenCalledWith(1024, 768)
      expect(context.camera.aspect).toBe(1024 / 768)
      expect(spy).toHaveBeenCalled()

      yield* _(Scope.close(scope, Effect.void))
    }))
})
