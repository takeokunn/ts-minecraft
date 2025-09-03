import { Effect, Layer } from 'effect'
import { describe, it, expect } from '@effect/vitest'
import { ThreeJsContextLive, ThreeJsContext } from '../three-js-context'
import * as THREE from 'three'

// Mock WebGLRenderer to avoid errors in jsdom
vi.mock('three/src/renderers/WebGLRenderer', () => ({
  WebGLRenderer: vi.fn().mockImplementation(() => ({
    setSize: vi.fn(),
    setClearColor: vi.fn(),
    domElement: document.createElement('canvas'),
    render: vi.fn(),
  })),
}))

describe('ThreeJsContext', () => {
  it.effect('should create the context without errors', () =>
    Effect.gen(function* (_) {
      const context = yield* _(ThreeJsContext)
      expect(context).toBeDefined()
      expect(context.renderer).toBeDefined()
      expect(context.scene).toBeDefined()
      expect(context.camera).toBeDefined()
    }).pipe(Effect.provide(ThreeJsContextLive)))
})