import { describe, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { expect, vi } from 'vitest'

import { initializeSessionBootstrapWorldPresentationPlayer } from '@ts-minecraft/app/main/session-bootstrap-world-presentation-player'

describe('initializeSessionBootstrapWorldPresentationPlayer', () => {
  it('sets the initial camera orientation for a fresh world', async () => {
    const setYaw = vi.fn(() => Effect.succeed(undefined))
    const setPitch = vi.fn(() => Effect.succeed(undefined))

    await Effect.runPromise(initializeSessionBootstrapWorldPresentationPlayer({
      worldBootstrap: { savedPlayerState: Option.none() } as never,
      initialSpawnSelection: { yaw: 90 } as never,
      playerCameraState: { setYaw, setPitch } as never,
    }))

    expect(setYaw).toHaveBeenCalledOnce()
    expect(setYaw).toHaveBeenCalledWith(90)
    expect(setPitch).toHaveBeenCalledOnce()
    expect(setPitch).toHaveBeenCalledWith(0)
  })

  it('keeps the restored camera orientation when saved state exists', async () => {
    const setYaw = vi.fn(() => Effect.succeed(undefined))
    const setPitch = vi.fn(() => Effect.succeed(undefined))

    await Effect.runPromise(initializeSessionBootstrapWorldPresentationPlayer({
      worldBootstrap: { savedPlayerState: Option.some({}) } as never,
      initialSpawnSelection: { yaw: 90 } as never,
      playerCameraState: { setYaw, setPitch } as never,
    }))

    expect(setYaw).not.toHaveBeenCalled()
    expect(setPitch).not.toHaveBeenCalled()
  })
})
