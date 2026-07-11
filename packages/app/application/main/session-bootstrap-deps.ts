import { Effect, Option } from 'effect'
import { GameLoopService } from '@ts-minecraft/game'
import { PlayerName } from '@ts-minecraft/network/domain/schemas'

import type { GameMode } from '@ts-minecraft/game'
import { buildSessionLoadingServices } from './session-bootstrap/presentation'
import { buildSessionBootstrapServices } from './session-bootstrap-deps/services'
import type { SessionBootstrapStartupMultiplayerConnection } from './session-bootstrap-types/core'

export const buildSessionBootstrapDeps = (
  bootCtx: import('@ts-minecraft/app/main/boot').BootContext,
  worldOpenRequest: import('@ts-minecraft/app/main/session-world-loader').WorldOpenRequest,
  initialGameMode: GameMode,
  startupMultiplayerConnection: SessionBootstrapStartupMultiplayerConnection = Option.none(),
) =>
  Effect.gen(function* () {
    const [services, loadingServices, gameLoopService] = yield* Effect.all([
      buildSessionBootstrapServices,
      buildSessionLoadingServices,
      GameLoopService,
    ], { concurrency: 'unbounded' })

    yield* Option.match(startupMultiplayerConnection, {
      onNone: () => Effect.void,
      onSome: ({ serverUrl, playerName }) =>
        Option.match(services.multiplayer.multiplayerService, {
          onNone: () => Effect.void,
          onSome: (multiplayerService) =>
            multiplayerService.connect(serverUrl, PlayerName.make(playerName)),
        }),
    })

    return {
      bootCtx,
      worldId: worldOpenRequest.worldId,
      worldOpenRequest,
      initialGameMode,
      gameLoopService,
      startupMultiplayerConnection,
      ...loadingServices,
      services,
    }
  })
