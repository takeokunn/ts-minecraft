import type { BootContext } from '@ts-minecraft/app/main/boot'
import type { WorldId } from '@ts-minecraft/core'
import type { GameMode, GameModeService, GameStateService, TimeService, WeatherService } from '@ts-minecraft/game'
import type { ChestService } from '@ts-minecraft/inventory/application/chest-service'
import type { EquipmentService } from '@ts-minecraft/inventory/application/equipment-service'
import type { FurnaceService } from '@ts-minecraft/inventory/application/furnace-service'
import type { InventoryService } from '@ts-minecraft/inventory/application/inventory-service'
import type { HealthService } from '@ts-minecraft/entity/application/health-service'
import type { HungerService } from '@ts-minecraft/entity/application/hunger-service'
import type { PlayerCameraStateService } from '@ts-minecraft/entity/application/camera-state'
import type { XPService } from '@ts-minecraft/entity/application/xp-service'
import type { BlockHighlightService, CrosshairService, LoadingScreenService, HotbarRendererService } from '@ts-minecraft/presentation'
import type * as THREE from 'three'
import type { ParticleSystemService } from '@ts-minecraft/rendering'
import type { ChunkManagerService, CropGrowthService } from '@ts-minecraft/world'

export type SessionBootstrapWorldStateDeps = {
  readonly bootCtx: Pick<BootContext, 'storageService' | 'noiseService'>
  readonly worldId: WorldId
  readonly initialGameMode: GameMode
  readonly chunkManagerService: ChunkManagerService
  readonly gameModeService: GameModeService
}

export type SessionBootstrapWorldTerrainDeps = {
  readonly bootCtx: Pick<BootContext, 'terrainPool'>
  readonly loadingScreen: LoadingScreenService
  readonly scene: THREE.Scene
  readonly canvas: HTMLCanvasElement
  readonly initialSettings: {
    readonly renderDistance: number
    readonly dayLengthSeconds: number
  }
  readonly worldRendererService: import('@ts-minecraft/rendering').WorldRendererService
}

export type SessionBootstrapWorldPresentationDeps = {
  readonly gameState: GameStateService
  readonly playerCameraState: PlayerCameraStateService
  readonly particleSystem: ParticleSystemService
  readonly blockHighlight: BlockHighlightService
  readonly hotbarRenderer: HotbarRendererService
  readonly crosshair: CrosshairService
  readonly timeService: TimeService
  readonly inventoryService: InventoryService
  readonly equipmentService: EquipmentService
  readonly healthService: HealthService
  readonly hungerService: HungerService
  readonly xpService: XPService
  readonly chestService: ChestService
  readonly furnaceService: FurnaceService
  readonly weatherService: WeatherService
  readonly cropGrowthService: CropGrowthService
}

export type SessionBootstrapWorldDeps = {
  readonly state: SessionBootstrapWorldStateDeps
  readonly terrain: SessionBootstrapWorldTerrainDeps
  readonly presentation: SessionBootstrapWorldPresentationDeps
}
