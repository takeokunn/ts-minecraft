import { Effect } from 'effect'
import { GameLoopService } from '@ts-minecraft/game'

import type { GameMode } from '@ts-minecraft/game'
import { buildSessionLoadingServices } from './session-bootstrap/presentation'
import { buildSessionBootstrapServices } from './session-bootstrap-deps/services'

export const buildSessionBootstrapDeps = (
  bootCtx: import('@ts-minecraft/app/main/boot').BootContext,
  worldId: import('@ts-minecraft/core').WorldId,
  initialGameMode: GameMode,
) =>
  Effect.gen(function* () {
    const services = yield* buildSessionBootstrapServices
    const loadingServices = yield* buildSessionLoadingServices
    const gameLoopService = yield* GameLoopService

    return {
      bootCtx,
      worldId,
      initialGameMode,
      gameLoopService,
      ...loadingServices,
      services,
    }
  })
