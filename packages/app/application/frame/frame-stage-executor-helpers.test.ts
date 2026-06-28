import { describe, it } from '@effect/vitest'
import { Effect, MutableRef } from 'effect'
import { expect, vi } from 'vitest'

import {
  syncRemotePlayersForFrame,
  toRemotePlayerRenderState,
} from '@ts-minecraft/app/application/frame/frame-stage-executor-helpers'
import type { RemotePlayerSnapshot } from '@ts-minecraft/app/application/multiplayer/multiplayer-service'
import type { RemotePlayerRenderer, RemotePlayerState } from '@ts-minecraft/rendering'

describe('frame-stage-executor-helpers remote player rendering', () => {
  it('maps multiplayer snapshots into render-state DTOs', () => {
    const player = {
      playerId: 'remote-1',
      playerName: 'Alex',
      x: 1,
      y: 64,
      z: -2,
      yaw: 0.25,
      pitch: -0.1,
    } satisfies RemotePlayerSnapshot

    expect(toRemotePlayerRenderState(player, 2.5)).toEqual({
      playerId: 'remote-1',
      playerName: 'Alex',
      position: { x: 1, y: 64, z: -2 },
      rotation: { yaw: 0.25, pitch: -0.1 },
      limbSwing: 20,
    })
  })

  it.effect('syncs multiplayer snapshots into the remote player renderer each frame', () =>
    Effect.gen(function* () {
      const remotePlayers = new Map<string, RemotePlayerSnapshot>([
        [
          'remote-1',
          {
            playerId: 'remote-1',
            playerName: 'Alex',
            x: 1,
            y: 64,
            z: -2,
            yaw: 0.25,
            pitch: -0.1,
          },
        ],
        [
          'remote-2',
          {
            playerId: 'remote-2',
            playerName: 'Steve',
            x: 3,
            y: 65,
            z: 4,
            yaw: 1.5,
            pitch: 0.2,
          },
        ],
      ])
      const getRemotePlayers = vi.fn(() => Effect.succeed(remotePlayers))
      const updateFromSnapshot = vi.fn((_players: ReadonlyArray<RemotePlayerState>) => Effect.void)
      const remotePlayerRenderer = { updateFromSnapshot } as unknown as RemotePlayerRenderer

      const lastRemotePlayerIdsRef = MutableRef.make(new Set())

      yield* syncRemotePlayersForFrame(
        { getRemotePlayers },
        { remotePlayerRenderer },
        { lastRemotePlayerIdsRef },
        12.5,
      )

      expect(getRemotePlayers).toHaveBeenCalledTimes(1)
      expect(updateFromSnapshot).toHaveBeenCalledTimes(1)
      expect(updateFromSnapshot).toHaveBeenCalledWith([
        {
          playerId: 'remote-1',
          playerName: 'Alex',
          position: { x: 1, y: 64, z: -2 },
          rotation: { yaw: 0.25, pitch: -0.1 },
          limbSwing: 100,
        },
        {
          playerId: 'remote-2',
          playerName: 'Steve',
          position: { x: 3, y: 65, z: 4 },
          rotation: { yaw: 1.5, pitch: 0.2 },
          limbSwing: 100,
        },
      ])
    })
  )

  it.effect('removes remote entities for players that left before updating renderer', () =>
    Effect.gen(function* () {
      const remotePlayers = new Map<string, RemotePlayerSnapshot>([
        [
          'remote-1',
          {
            playerId: 'remote-1',
            playerName: 'Alex',
            x: 1,
            y: 64,
            z: -2,
            yaw: 0.25,
            pitch: -0.1,
          },
        ],
      ])
      const getRemotePlayers = vi.fn(() => Effect.succeed(remotePlayers))
      const updateFromSnapshot = vi.fn((_players: ReadonlyArray<RemotePlayerState>) => Effect.void)
      const remotePlayerRenderer = { updateFromSnapshot } as unknown as RemotePlayerRenderer

      const getEntities = vi.fn(() =>
        Effect.succeed([
          { entityId: 'remote:remote-2:zombie-1' },
          { entityId: 'remote:remote-2:zombie-2' },
          { entityId: 'remote:remote-1:zombie-3' },
        ]),
      )
      const removeEntity = vi.fn((_entityId: string) => Effect.void)
      const entityManager = { getEntities, removeEntity } as const
      const lastRemotePlayerIdsRef = MutableRef.make(new Set(['remote-1', 'remote-2']))

      yield* syncRemotePlayersForFrame(
        { getRemotePlayers },
        { entityManager, remotePlayerRenderer },
        { lastRemotePlayerIdsRef },
        12.5,
      )

      expect(getEntities).toHaveBeenCalledTimes(1)
      expect(removeEntity).toHaveBeenCalledTimes(2)
      expect(removeEntity).toHaveBeenNthCalledWith(1, 'remote:remote-2:zombie-1')
      expect(removeEntity).toHaveBeenNthCalledWith(2, 'remote:remote-2:zombie-2')
      expect(updateFromSnapshot).toHaveBeenCalledWith([
        {
          playerId: 'remote-1',
          playerName: 'Alex',
          position: { x: 1, y: 64, z: -2 },
          rotation: { yaw: 0.25, pitch: -0.1 },
          limbSwing: 100,
        },
      ])
      expect(MutableRef.get(lastRemotePlayerIdsRef)).toEqual(new Set(['remote-1']))
    })
  )
})
