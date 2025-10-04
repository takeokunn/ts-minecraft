import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Option, Schema } from 'effect'
import { RendererService } from '@mc/bc-world/infrastructure/rendering/disabled/renderer-service'
import { SceneService } from '@domain/scene/service'
import { SceneState as Scenes, TransitionEffect, SceneTimestampSchema } from '@domain/scene/types'
import {
  SceneEventBusLayer,
  SceneServiceBaseLayer,
  SceneSaveManagerLayer,
  SceneWorldManagerLayer,
} from './scene-service-live'

describe('domain/scene/service tag', () => {
  const TestRendererLayer = Layer.succeed(RendererService, {
    initialize: () => Effect.void,
    render: () => Effect.void,
    resize: () => Effect.void,
    dispose: () => Effect.void,
    getRenderer: () => Effect.succeed(null),
    isInitialized: () => Effect.succeed(true),
    setClearColor: () => Effect.void,
    setPixelRatio: () => Effect.void,
  })

  const TestSceneLayer = SceneServiceBaseLayer.pipe(
    Layer.provide(SceneEventBusLayer),
    Layer.provide(SceneWorldManagerLayer),
    Layer.provide(SceneSaveManagerLayer),
    Layer.provide(TestRendererLayer)
  )

  it.effect('provides SceneService via Layer', () =>
    Effect.scoped(
      Effect.gen(function* () {
        const service = yield* SceneService
        const current = yield* service.current()
        expect(current._tag).toBe('MainMenu')
      }).pipe(Effect.provide(TestSceneLayer))
    )
  )
})
