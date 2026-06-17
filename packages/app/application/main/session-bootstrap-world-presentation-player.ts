import { Effect, Option } from 'effect'

import { type WorldBootstrap } from '@ts-minecraft/app/main/session-world-loader-metadata'
import type { SpawnSelection } from '@ts-minecraft/app/main/spawn-selection'
import { PlayerCameraStateService } from '@ts-minecraft/entity'

export type SessionBootstrapWorldPresentationPlayerDeps = {
  readonly worldBootstrap: WorldBootstrap
  readonly initialSpawnSelection: SpawnSelection
  readonly playerCameraState: PlayerCameraStateService
}

export const initializeSessionBootstrapWorldPresentationPlayer = ({
  worldBootstrap,
  initialSpawnSelection,
  playerCameraState,
}: SessionBootstrapWorldPresentationPlayerDeps) =>
  Effect.gen(function* () {
    if (Option.isNone(worldBootstrap.savedPlayerState)) {
      yield* playerCameraState.setYaw(initialSpawnSelection.yaw)
      yield* playerCameraState.setPitch(0)
    }
  })
