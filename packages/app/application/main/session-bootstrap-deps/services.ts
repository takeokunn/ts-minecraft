import { Effect } from 'effect'

import type { SessionBootstrapServiceGroups } from '@ts-minecraft/app/main/session-bootstrap-types/services'
import { buildEntityBootstrapServices } from '../session-bootstrap/entity'
import { buildGameBootstrapServices } from '../session-bootstrap/game'
import { buildInventoryBootstrapServices } from '../session-bootstrap/inventory'
import { buildMultiplayerBootstrapServices } from '../session-bootstrap/multiplayer'
import { buildPresentationBootstrapServices } from '../session-bootstrap/presentation'
import { buildRenderingBootstrapServices } from '../session-bootstrap/rendering'
import { buildWorldBootstrapServices } from '../session-bootstrap/world'

export const buildSessionBootstrapServices = Effect.gen(function* () {
  const [
    renderingServices,
    worldServices,
    gameServices,
    presentationServices,
    inventoryServices,
    entityServices,
    multiplayerServices,
  ] = yield* Effect.all([
    buildRenderingBootstrapServices,
    buildWorldBootstrapServices,
    buildGameBootstrapServices,
    buildPresentationBootstrapServices,
    buildInventoryBootstrapServices,
    buildEntityBootstrapServices,
    buildMultiplayerBootstrapServices,
  ], { concurrency: 'unbounded' })

  const services: SessionBootstrapServiceGroups = {
    rendering: renderingServices,
    world: worldServices,
    gameplay: gameServices,
    presentation: presentationServices,
    inventory: inventoryServices,
    entity: entityServices,
    multiplayer: multiplayerServices,
  }

  return services
})
