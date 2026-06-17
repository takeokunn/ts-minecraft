import { beforeEach, describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, Option } from 'effect'

import { initializeSessionBootstrapWorldPresentation } from './session-bootstrap-world-presentation'
import { initializeSessionBootstrapWorldPresentationState } from '@ts-minecraft/app/main/session-bootstrap-world-presentation-state'
import { initializeSessionBootstrapWorldPresentationView } from '@ts-minecraft/app/main/session-bootstrap-world-presentation-view'

vi.mock('@ts-minecraft/app/main/session-bootstrap-world-presentation-state', () => ({
  initializeSessionBootstrapWorldPresentationState: vi.fn(() => Effect.succeed(undefined) as Effect.Effect<void, never, never>),
}))

vi.mock('@ts-minecraft/app/main/session-bootstrap-world-presentation-view', () => ({
  initializeSessionBootstrapWorldPresentationView: vi.fn(() => Effect.succeed(undefined) as Effect.Effect<void, never, never>),
}))

describe('initializeSessionBootstrapWorldPresentation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates to the state and view helpers', async () => {
    const worldBootstrap = { savedPlayerState: Option.none() } as never
    const spawnPosition = { x: 10, y: 64, z: 10 }
    const scene = {} as never
    const canvas = { clientWidth: 800, clientHeight: 600 } as HTMLCanvasElement

    await Effect.runPromise(Effect.scoped(initializeSessionBootstrapWorldPresentation({
      worldBootstrap,
      initialSpawnSelection: { yaw: 90 } as never,
      initialSettings: { dayLengthSeconds: 900 },
      scene,
      canvas,
      gameState: {} as never,
      playerCameraState: {} as never,
      blockHighlight: {} as never,
      hotbarRenderer: {} as never,
      particleSystem: {} as never,
      timeService: {} as never,
      crosshair: {} as never,
      inventoryService: {} as never,
      equipmentService: {} as never,
      healthService: {} as never,
      hungerService: {} as never,
      xpService: {} as never,
      chestService: {} as never,
      furnaceService: {} as never,
      weatherService: {} as never,
      cropGrowthService: {} as never,
      spawnPosition,
    })))

    expect(initializeSessionBootstrapWorldPresentationState).toHaveBeenCalledOnce()
    expect(initializeSessionBootstrapWorldPresentationState).toHaveBeenCalledWith(expect.objectContaining({
      worldBootstrap,
      initialSettings: { dayLengthSeconds: 900 },
      spawnPosition,
    }))
    expect(initializeSessionBootstrapWorldPresentationView).toHaveBeenCalledOnce()
    expect(initializeSessionBootstrapWorldPresentationView).toHaveBeenCalledWith(expect.objectContaining({
      scene,
      canvas,
    }))
  })
})
