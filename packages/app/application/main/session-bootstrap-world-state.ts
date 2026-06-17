import { Effect, MutableRef } from 'effect'

import { GameModeService, type GameMode } from '@ts-minecraft/game'
import type { BootContext } from '@ts-minecraft/app/main/boot'
import { buildSpawnSelection, loadOrCreateWorld } from '@ts-minecraft/app/main/session-world-loader'
import { resolveSessionStartPositions } from '@ts-minecraft/app/main/session-world-loader-state'
import { type WorldBootstrap } from '@ts-minecraft/app/main/session-world-loader-metadata'
import type { SpawnSelection } from '@ts-minecraft/app/main/spawn-selection'
import { type WorldId, type Position } from '@ts-minecraft/core'
import type { ChunkManagerService } from '@ts-minecraft/world'

export type SessionBootstrapWorldStateDeps = {
  readonly bootCtx: Pick<BootContext, 'storageService' | 'noiseService'>
  readonly worldId: WorldId
  readonly initialGameMode: GameMode
  readonly chunkManagerService: ChunkManagerService
  readonly gameModeService: GameModeService
}

export type SessionBootstrapWorldState = {
  readonly worldBootstrap: WorldBootstrap
  readonly initialSpawnSelection: SpawnSelection
  readonly initialChunkLoadAnchor: Position
  readonly respawnPositionRef: MutableRef.MutableRef<Position>
  readonly spawnPosition: Position
}

export const buildSessionBootstrapWorldState = ({
  bootCtx,
  worldId,
  initialGameMode,
  chunkManagerService,
  gameModeService,
}: SessionBootstrapWorldStateDeps) =>
  Effect.gen(function* () {
    const worldBootstrap = yield* loadOrCreateWorld(worldId, initialGameMode, bootCtx.storageService, bootCtx.noiseService, gameModeService)
    const initialSpawnSelection = yield* buildSpawnSelection(worldBootstrap.baseSpawnPosition, chunkManagerService)
    const { initialChunkLoadAnchor, respawnPosition, spawnPosition } = resolveSessionStartPositions(worldBootstrap, initialSpawnSelection.position)

    const respawnPositionRef = MutableRef.make<Position>(respawnPosition)

    return {
      worldBootstrap,
      initialSpawnSelection,
      initialChunkLoadAnchor,
      respawnPositionRef,
      spawnPosition,
    }
  })
