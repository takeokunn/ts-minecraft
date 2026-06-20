import { Effect } from 'effect'

import type { SessionBootstrapServiceGroups } from '@ts-minecraft/app/main/session-bootstrap-types/services'
import { buildEntityBootstrapServices } from '../session-bootstrap/entity'
import { buildGameBootstrapServices } from '../session-bootstrap/game'
import { buildInventoryBootstrapServices } from '../session-bootstrap/inventory'
import { buildPresentationBootstrapServices } from '../session-bootstrap/presentation'
import { buildRenderingBootstrapServices } from '../session-bootstrap/rendering'
import { buildWorldBootstrapServices } from '../session-bootstrap/world'

export const buildSessionBootstrapServices = Effect.gen(function* () {
  const renderingServices = yield* buildRenderingBootstrapServices
  const worldServices = yield* buildWorldBootstrapServices
  const gameServices = yield* buildGameBootstrapServices
  const presentationServices = yield* buildPresentationBootstrapServices
  const inventoryServices = yield* buildInventoryBootstrapServices
  const entityServices = yield* buildEntityBootstrapServices

  const services: SessionBootstrapServiceGroups = {
    rendering: renderingServices,
    world: worldServices,
    gameplay: gameServices,
    presentation: presentationServices,
    inventory: inventoryServices,
    entity: entityServices,
  }

  return services
})
