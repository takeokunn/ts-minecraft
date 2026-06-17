import { Option } from 'effect'
import type { FrameHandlerServices } from '@ts-minecraft/app'
import { makeBlockHighlight, makeDebugFeatureFlags, makeFPSCounter, makeHotbarRenderer, makeInputService, makeInventoryRenderer, makePauseMenu, makeSettingsOverlay, makeTradingPresentation } from './presentation'
import { makeCameraState, makeChestService, makeEntityManager, makeFishingService, makeFirstPersonCamera, makeFurnaceService, makeGameMode, makeGameState, makeHealthService, makeHungerService, makeMobSpawner, makeMusicManager, makeRedstoneService, makeSettingsService, makeSoundManager, makeThirdPersonCamera, makeTimeService, makeVillageService, makeXPService } from './entity'
import { makeBlockService, makeChunkManagerService, makeChunkMeshService, makeCropGrowthService, makeEquipmentService, makeFluidService, makeHotbarService, makeInventoryService, makeNetherService, makeParticleSystem, makePerfHud, makeWorldRendererService, makeEntityRenderer, makeWeatherService } from './world'
import type { CameraStateStub } from './shared'

export const makeServices = (opts: {
  inputService: ReturnType<typeof makeInputService>
  inventoryRenderer: ReturnType<typeof makeInventoryRenderer>
  settingsOverlay: ReturnType<typeof makeSettingsOverlay>
  tradingPresentation?: ReturnType<typeof makeTradingPresentation>
}): FrameHandlerServices & { cameraState: CameraStateStub } => {
  const { inputService, inventoryRenderer, settingsOverlay } = opts
  const tradingPresentation = opts.tradingPresentation ?? makeTradingPresentation({ open: false })
  const cameraState = makeCameraState()

  return {
    gameState: makeGameState(),
    playerCameraState: cameraState.service,
    firstPersonCamera: makeFirstPersonCamera(),
    thirdPersonCamera: makeThirdPersonCamera(),
    blockHighlight: makeBlockHighlight(),
    inputService,
    blockService: makeBlockService(),
    hotbarService: makeHotbarService(),
    hotbarRenderer: makeHotbarRenderer(),
    chunkManagerService: makeChunkManagerService(),
    timeService: makeTimeService(),
    settingsService: makeSettingsService(),
    debugFeatureFlags: makeDebugFeatureFlags(),
    settingsOverlay,
    pauseMenu: makePauseMenu(),
    inventoryRenderer,
    inventoryService: makeInventoryService(),
    equipmentService: makeEquipmentService(),
    xpService: makeXPService(),
    fishingService: makeFishingService(),
    fpsCounter: makeFPSCounter(),
    worldRendererService: makeWorldRendererService(),
    entityRenderer: makeEntityRenderer(),
    chunkMeshService: makeChunkMeshService(),
    particleSystem: makeParticleSystem(),
    healthService: makeHealthService(),
    hungerService: makeHungerService(),
    soundManager: makeSoundManager(),
    musicManager: makeMusicManager(),
    entityManager: makeEntityManager(),
    mobSpawner: makeMobSpawner(),
    villageService: makeVillageService(),
    tradingPresentation,
    redstoneService: makeRedstoneService(),
    cropGrowthService: makeCropGrowthService(),
    fluidService: makeFluidService(),
    chestService: makeChestService(),
    furnaceService: makeFurnaceService(),
    netherService: makeNetherService(),
    weatherService: makeWeatherService(),
    perfHud: makePerfHud(),
    gameMode: makeGameMode(),
    multiplayer: Option.none(),
    cameraState: cameraState.state,
  }
}
