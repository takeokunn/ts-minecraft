import { Effect, Option } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { PlayerName } from '@ts-minecraft/network/domain/schemas'
import type { WorldOpenRequest } from '@ts-minecraft/app/main/session-world-loader'

import { buildSessionBootstrapDeps } from './session-bootstrap-deps'

var connect: ReturnType<typeof vi.fn>

vi.mock('./session-bootstrap-deps/services', () => ({
  buildSessionBootstrapServices: Effect.succeed({
    multiplayer: {
      multiplayerService: Option.some({
        connect: (connect = vi.fn(() => Effect.void)),
      } as never),
    },
  }),
}))

vi.mock('./session-bootstrap/presentation', () => ({
  buildSessionLoadingServices: Effect.succeed({
    loadingScreen: { id: 'loading-screen' },
    deathScreen: { id: 'death-screen' },
  }),
}))

vi.mock('@ts-minecraft/game', () => ({
  GameLoopService: Effect.succeed({ id: 'game-loop-service' } as never),
}))

describe('buildSessionBootstrapDeps', () => {
  it('connects multiplayer at bootstrap when a startup connection is provided', async () => {
    const worldOpenRequest = {
      _tag: 'CreateWorld',
      worldId: 'world-1' as never,
      displayName: 'World 1',
      gameMode: 'survival',
      seed: 1234,
    } satisfies WorldOpenRequest
    const startupMultiplayerConnection = Option.some({
      serverUrl: 'ws://example.invalid:25565',
      playerName: 'Ada',
    })

    const result = await Effect.runPromise(buildSessionBootstrapDeps(
      { id: 'boot-ctx' } as never,
      worldOpenRequest,
      'survival' as never,
      startupMultiplayerConnection,
    ))

    expect(connect).toHaveBeenCalledOnce()
    expect(connect).toHaveBeenCalledWith('ws://example.invalid:25565', PlayerName.make('Ada'))
    expect(result).toMatchObject({
      bootCtx: { id: 'boot-ctx' },
      worldId: 'world-1',
      worldOpenRequest,
      initialGameMode: 'survival',
      gameLoopService: { id: 'game-loop-service' },
      loadingScreen: { id: 'loading-screen' },
      deathScreen: { id: 'death-screen' },
    })
    expect(result.startupMultiplayerConnection).toEqual(startupMultiplayerConnection)
  })

  it('skips multiplayer connect when no startup connection is provided', async () => {
    connect.mockClear()
    const worldOpenRequest = {
      _tag: 'CreateWorld',
      worldId: 'world-2' as never,
      displayName: 'World 2',
      gameMode: 'creative',
    } satisfies WorldOpenRequest
    const noStartupMultiplayerConnection = Option.none<{
      readonly serverUrl: string
      readonly playerName: string
    }>()

    const result = await Effect.runPromise(buildSessionBootstrapDeps(
      { id: 'boot-ctx' } as never,
      worldOpenRequest,
      'creative' as never,
      noStartupMultiplayerConnection,
    ))

    expect(connect).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      bootCtx: { id: 'boot-ctx' },
      worldId: 'world-2',
      worldOpenRequest,
      initialGameMode: 'creative',
      gameLoopService: { id: 'game-loop-service' },
      loadingScreen: { id: 'loading-screen' },
      deathScreen: { id: 'death-screen' },
    })
    expect(result.startupMultiplayerConnection).toEqual(noStartupMultiplayerConnection)
  })
})
