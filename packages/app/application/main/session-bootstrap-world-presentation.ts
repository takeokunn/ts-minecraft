import { Effect } from 'effect'

import type { SessionBootstrapWorldPresentationStateDeps } from '@ts-minecraft/app/main/session-bootstrap-world-presentation-state'
import { initializeSessionBootstrapWorldPresentationState } from '@ts-minecraft/app/main/session-bootstrap-world-presentation-state'
import type { SessionBootstrapWorldPresentationViewDeps } from '@ts-minecraft/app/main/session-bootstrap-world-presentation-view'
import { initializeSessionBootstrapWorldPresentationView } from '@ts-minecraft/app/main/session-bootstrap-world-presentation-view'

export type SessionBootstrapWorldPresentationDeps = SessionBootstrapWorldPresentationStateDeps &
  SessionBootstrapWorldPresentationViewDeps

export const initializeSessionBootstrapWorldPresentation = ({
  worldBootstrap,
  initialSpawnSelection,
  initialSettings,
  scene,
  canvas,
  gameState,
  playerCameraState,
  blockHighlight,
  hotbarRenderer,
  particleSystem,
  timeService,
  crosshair,
  controlsHint,
  inventoryService,
  equipmentService,
  healthService,
  hungerService,
  xpService,
  chestService,
  furnaceService,
  weatherService,
  cropGrowthService,
  entityManager,
  spawnPosition,
}: SessionBootstrapWorldPresentationDeps) =>
  Effect.gen(function* () {
    yield* initializeSessionBootstrapWorldPresentationState({
      worldBootstrap,
      initialSpawnSelection,
      initialSettings,
      gameState,
      playerCameraState,
      timeService,
      inventoryService,
      equipmentService,
      healthService,
      hungerService,
      xpService,
      chestService,
      furnaceService,
      weatherService,
      cropGrowthService,
      entityManager,
      spawnPosition,
    })

    yield* initializeSessionBootstrapWorldPresentationView({
      scene,
      canvas,
      blockHighlight,
      hotbarRenderer,
      particleSystem,
      crosshair,
      controlsHint,
    })
  })
