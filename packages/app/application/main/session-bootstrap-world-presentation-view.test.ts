import { beforeEach, describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect } from 'effect'

import { initializeSessionBootstrapWorldPresentationView } from './session-bootstrap-world-presentation-view'

describe('initializeSessionBootstrapWorldPresentationView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes the presentation surfaces for the booted world', async () => {
    const scene = {} as never
    const canvas = { clientWidth: 800, clientHeight: 600 } as HTMLCanvasElement
    const noopEffect = Effect.succeed(undefined) as Effect.Effect<void, never, never>
    const blockHighlight = { initialize: vi.fn(() => noopEffect) }
    const hotbarRenderer = { initialize: vi.fn(() => noopEffect) }
    const particleSystem = { attach: vi.fn(() => noopEffect) }
    const crosshair = { show: vi.fn(() => noopEffect) }

    await Effect.runPromise(Effect.scoped(initializeSessionBootstrapWorldPresentationView({
      scene,
      canvas,
      blockHighlight: blockHighlight as never,
      hotbarRenderer: hotbarRenderer as never,
      particleSystem: particleSystem as never,
      crosshair: crosshair as never,
    })))

    expect(blockHighlight.initialize).toHaveBeenCalledWith(scene)
    expect(hotbarRenderer.initialize).toHaveBeenCalledWith(800, 600)
    expect(particleSystem.attach).toHaveBeenCalledWith(scene)
    expect(crosshair.show).toHaveBeenCalledOnce()
  })
})
