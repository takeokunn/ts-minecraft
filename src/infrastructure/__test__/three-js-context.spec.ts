import { Effect } from 'effect'
import { describe, it, expect } from '@effect/vitest'
import { ThreeJsContextLive } from '../three-js-context'
import { ThreeJsContextTag } from '../three-js-context'

describe('ThreeJsContext', () => {
  it.effect('should create the context without errors', () =>
    Effect.gen(function* (_) {
      const context = yield* _(ThreeJsContextTag)
      expect(context).toBeDefined()
      expect(context.renderer).toBeDefined()
      expect(context.scene).toBeDefined()
      expect(context.camera).toBeDefined()
    }).pipe(Effect.provide(ThreeJsContextLive)))
})
