import { Effect } from 'effect'
import { WorldId } from '@ts-minecraft/core'

import type { BootContext } from '@ts-minecraft/app/main/boot'
import type { GameMode } from './session-bootstrap/game'
import type { SessionBootstrapDeps, SessionBootstrapServices } from '@ts-minecraft/app/main/session-bootstrap-types'
import { buildEntityBootstrapServices } from './session-bootstrap/entity'
import { buildGameBootstrapServices, buildGameLoopService } from './session-bootstrap/game'
import { buildInventoryBootstrapServices } from './session-bootstrap/inventory'
import { buildPresentationBootstrapServices, buildSessionLoadingServices } from './session-bootstrap/presentation'
import { buildRenderingBootstrapServices } from './session-bootstrap/rendering'
import { buildWorldBootstrapServices } from './session-bootstrap/world'

export const buildSessionBootstrapDeps = (
  bootCtx: BootContext,
  worldId: WorldId,
  initialGameMode: GameMode,
) =>
  Effect.gen(function* () {
    const renderingServices = yield* buildRenderingBootstrapServices
    const worldServices = yield* buildWorldBootstrapServices
    const gameServices = yield* buildGameBootstrapServices
    const presentationServices = yield* buildPresentationBootstrapServices
    const inventoryServices = yield* buildInventoryBootstrapServices
    const entityServices = yield* buildEntityBootstrapServices
    const loadingServices = yield* buildSessionLoadingServices
    const gameLoopService = yield* buildGameLoopService

    const services: SessionBootstrapServices = {
      ...renderingServices,
      ...worldServices,
      ...gameServices,
      ...presentationServices,
      ...inventoryServices,
      ...entityServices,
    }

    const deps: SessionBootstrapDeps = {
      bootCtx,
      worldId,
      initialGameMode,
      gameLoopService,
      ...loadingServices,
      services,
    }

    return deps
  })
