import { Effect, MutableRef } from 'effect'
import type { RemotePlayerState } from '@ts-minecraft/rendering'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import type {
  MultiplayerService,
  RemotePlayerSnapshot,
} from '@ts-minecraft/app/application/multiplayer/multiplayer-service'

// Per-frame projection of the multiplayer remote-player snapshots into the
// remote-player renderer: map each snapshot to a render state, prune the mob
// entities of players who departed since last frame, and push the batch.
// Split out of frame-stage-executor-helpers.ts as a self-contained concern.

const REMOTE_PLAYER_LIMB_SWING_SPEED = 8

export const toRemotePlayerRenderState = (
  player: RemotePlayerSnapshot,
  totalTimeSecs: number,
): RemotePlayerState => ({
  playerId: player.playerId,
  playerName: player.playerName,
  position: {
    x: player.x,
    y: player.y,
    z: player.z,
  },
  rotation: {
    yaw: player.yaw,
    pitch: player.pitch,
  },
  limbSwing: totalTimeSecs * REMOTE_PLAYER_LIMB_SWING_SPEED,
})

export const syncRemotePlayersForFrame = (
  mp: Pick<MultiplayerService, 'getRemotePlayers'>,
  services: Pick<FrameHandlerServices, 'entityManager' | 'remotePlayerRenderer'>,
  refs: Pick<FrameStageRefs, 'lastRemotePlayerIdsRef'>,
  totalTimeSecs: number,
) =>
  mp.getRemotePlayers().pipe(
    Effect.flatMap((remotePlayers) =>
      Effect.gen(function* () {
        const nextRemotePlayerIds = new Set(remotePlayers.keys())
        const previousRemotePlayerIds = MutableRef.get(refs.lastRemotePlayerIdsRef)
        const departedRemotePlayerIds: string[] = []
        for (const previousRemotePlayerId of previousRemotePlayerIds) {
          if (!nextRemotePlayerIds.has(previousRemotePlayerId)) departedRemotePlayerIds.push(previousRemotePlayerId)
        }
        MutableRef.set(refs.lastRemotePlayerIdsRef, nextRemotePlayerIds)

        if (departedRemotePlayerIds.length > 0) {
          const entities = yield* services.entityManager.getEntities()
          for (const departedRemotePlayerId of departedRemotePlayerIds) {
            const remoteEntityPrefix = `remote:${departedRemotePlayerId}:`
            for (const entity of entities) {
              if (entity.entityId.startsWith(remoteEntityPrefix)) {
                yield* services.entityManager.removeEntity(entity.entityId)
              }
            }
          }
        }

        const snapshots: RemotePlayerState[] = []
        for (const player of remotePlayers.values()) {
          snapshots.push(toRemotePlayerRenderState(player, totalTimeSecs))
        }
        return services.remotePlayerRenderer.updateFromSnapshot(snapshots)
      }),
    ),
  )
