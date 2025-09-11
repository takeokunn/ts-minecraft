import { Layer, Effect, Queue } from 'effect'
import { Renderer } from '@/infrastructure/services/renderer.service'
import { RenderCommand } from '@/domain/rendering'

/**
 * Production implementation of Renderer service
 */
export const RendererLive = Layer.effect(
  Renderer,
  Effect.gen(function* () {
    const renderQueue = yield* Queue.unbounded<RenderCommand>()
    
    return Renderer.of({
      renderQueue,
      updateCamera: () => Effect.succeed(undefined)
    })
  })
)