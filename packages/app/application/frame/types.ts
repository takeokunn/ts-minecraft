// Shared types for per-frame stage modules. Extracted from frame-handler.ts to avoid
// a circular dependency back to the orchestrator.
import { HashMap, MutableRef, Option, Ref } from 'effect'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import { GameStateService } from '@ts-minecraft/game'
import { GameModeService } from '@ts-minecraft/game'
import { PlayerCameraStateService } from '@ts-minecraft/player'
import { FirstPersonCameraService } from '@ts-minecraft/player'
import { ThirdPersonCameraService } from '@ts-minecraft/player'
import { BlockService } from '@ts-minecraft/terrain'
import { HotbarService } from '@ts-minecraft/inventory'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { TimeService } from '@ts-minecraft/game'
import {
  SettingsService,
  type ResolvedGraphics,
  type Settings,
} from '@ts-minecraft/game'
import { FPSCounterService } from '@ts-minecraft/app/presentation/fps-counter'
import { HotbarRendererService } from '@ts-minecraft/app/presentation/hud/hotbar-three'
import { BlockHighlightService } from '@ts-minecraft/app/presentation/highlight/block-highlight'
import { GodRaysPass, WorldRendererService, EntityRendererService, ChunkMeshService } from '@ts-minecraft/rendering'
import { ParticleSystemService } from '@ts-minecraft/rendering/particles/particle-system'
import { PerfHudService } from '@ts-minecraft/rendering'
import { InputService } from '@ts-minecraft/app/presentation/input/input-service'
import { SettingsOverlayService } from '@ts-minecraft/app/presentation/settings/settings-overlay'
import { PauseMenuService } from '@ts-minecraft/app/presentation/menu/pause-menu'
import { InventoryRendererService } from '@ts-minecraft/app/presentation/inventory/inventory-renderer'
import { DebugFeatureFlagsService } from '@ts-minecraft/app/debug-feature-flags'
import { InventoryService } from '@ts-minecraft/inventory'
import { HealthService } from '@ts-minecraft/player'
import { MusicManager, SoundManager } from '@ts-minecraft/game'
import { EntityManager, MobSpawner } from '@ts-minecraft/entities'
import { VillageService } from '@ts-minecraft/entities'
import { TradingPresentationService } from '@ts-minecraft/app/presentation/trading'
import { RedstoneService } from '@ts-minecraft/entities'
import { FluidService } from '@ts-minecraft/terrain'
import { FurnaceService } from '@ts-minecraft/furnace'
import type { Chunk } from '@ts-minecraft/terrain'
import { type DayNightLights } from '@ts-minecraft/game'
import type { Position } from '@ts-minecraft/kernel'
import type { CameraPoseSnapshot } from '@ts-minecraft/app/frame/frame-runtime-logic'

// Three.js objects/DOM state owned by main.ts before the game loop starts — passed as values,
// not Effect services. gamePausedRef is a plain Ref rather than a dedicated service (single boolean).
export type FrameHandlerDeps = {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly respawnPosition: Position
  readonly lights: DayNightLights
  readonly fpsElement: Option.Option<HTMLElement>
  readonly healthValueElement: Option.Option<HTMLElement>
  readonly healthMaxElement: Option.Option<HTMLElement>
  readonly gamePausedRef: Ref.Ref<boolean>
  // FR-1.4: true while pause-menu is open. Distinct from gamePausedRef (transient overlay state).
  // Read synchronously by frame stages to skip simulation while keeping input + render alive.
  readonly sessionPausedRef: MutableRef.MutableRef<boolean>
  readonly composer: Option.Option<EffectComposer>
  readonly skyMesh: Option.Option<THREE.Object3D>
  readonly gtaoPass: Option.Option<GTAOPass>
  readonly bloomPass: Option.Option<UnrealBloomPass>
  readonly dofPass: Option.Option<BokehPass>
  readonly godRaysPass: Option.Option<GodRaysPass>
  readonly smaaPass: Option.Option<SMAAPass>
}

// Passed as explicit instances (not yielded from context) so R = never — avoids rebuilding
// all 30+ layers at 60 Hz. Resolved once in main.ts and forwarded to the frame handler.
export type FrameHandlerServices = {
  readonly gameState: GameStateService
  readonly playerCameraState: PlayerCameraStateService
  readonly firstPersonCamera: FirstPersonCameraService
  readonly thirdPersonCamera: ThirdPersonCameraService
  readonly blockHighlight: BlockHighlightService
  readonly inputService: InputService
  readonly blockService: BlockService
  readonly hotbarService: HotbarService
  readonly hotbarRenderer: HotbarRendererService
  readonly chunkManagerService: ChunkManagerService
  readonly timeService: TimeService
  readonly settingsService: SettingsService
  readonly debugFeatureFlags: DebugFeatureFlagsService
  readonly settingsOverlay: SettingsOverlayService
  readonly pauseMenu: PauseMenuService
  readonly inventoryRenderer: InventoryRendererService
  readonly inventoryService: InventoryService
  readonly fpsCounter: FPSCounterService
  readonly healthService: HealthService
  readonly worldRendererService: WorldRendererService
  readonly entityRenderer: EntityRendererService
  readonly chunkMeshService: ChunkMeshService
  readonly particleSystem: ParticleSystemService
  readonly soundManager: SoundManager
  readonly musicManager: MusicManager
  readonly entityManager: EntityManager
  readonly mobSpawner: MobSpawner
  readonly villageService: VillageService
  readonly tradingPresentation: TradingPresentationService
  readonly redstoneService: RedstoneService
  readonly fluidService: FluidService
  readonly furnaceService: FurnaceService
  readonly perfHud: PerfHudService
  readonly gameMode: GameModeService
}

export type FrameStageRefs = {
  readonly totalTimeSecsRef: Ref.Ref<number>
  readonly redstoneTickAccumulatorRef: Ref.Ref<number>
  readonly fluidTickAccumulatorRef: Ref.Ref<number>
  readonly refractionFrameCounterRef: Ref.Ref<number>
  readonly refractionValidRef: Ref.Ref<boolean>
  readonly lastFpsTextRef: Ref.Ref<string>
  readonly lastHealthRef: MutableRef.MutableRef<{ current: number; max: number }>
  readonly lastRenderDistanceRef: Ref.Ref<number>
  readonly lastEntityStructureVersionRef: Ref.Ref<number>
  readonly entityPhysicsChunkCacheRef: Ref.Ref<ReadonlyArray<Chunk | null>>
  readonly lastEntityPhysicsChunkCoordRef: Ref.Ref<{ readonly cx: number; readonly cz: number }>
  readonly lastEntityPhysicsLoadedChunksRef: Ref.Ref<Option.Option<ReadonlyArray<Chunk>>>
  readonly shadowUpdateCounterRef: Ref.Ref<number>
  readonly frustumThrottleStrideRef: Ref.Ref<number>
  readonly frustumThrottleCounterRef: Ref.Ref<number>
  readonly adaptiveQualityCooldownRef: Ref.Ref<number>
  readonly lastAppliedPixelRatioRef: Ref.Ref<number>
  readonly lastGraphicsQualityRef: Ref.Ref<{ quality: string; resolved: ResolvedGraphics }>
  readonly dirtyChunksRef: Ref.Ref<HashMap.HashMap<string, Chunk>>
  readonly lastLoadedChunksRef: Ref.Ref<Option.Option<ReadonlyArray<Chunk>>>
  readonly chunkSyncPendingRef: MutableRef.MutableRef<boolean>
  readonly lastShadowTargetRef: MutableRef.MutableRef<{ x: number; z: number }>
  readonly lastFrustumCullRef: MutableRef.MutableRef<CameraPoseSnapshot>
  readonly lastRefractionFrameRef: MutableRef.MutableRef<CameraPoseSnapshot>
  readonly lastAudioRef: MutableRef.MutableRef<{ enabled: boolean; master: number; sfx: number; music: number }>
}

export type ResolvedDeps = {
  readonly skyMeshOrNull: THREE.Object3D | null
  readonly fpsElementOrNull: HTMLElement | null
  readonly healthValueElementOrNull: HTMLElement | null
  readonly healthMaxElementOrNull: HTMLElement | null
  readonly gtaoPassOrNull: GTAOPass | null
  readonly bloomPassOrNull: UnrealBloomPass | null
  readonly dofPassOrNull: BokehPass | null
  readonly smaaPassOrNull: SMAAPass | null
  readonly godRaysPassOrNull: GodRaysPass | null
  readonly composerOrNull: EffectComposer | null
}

export type FrameSettingsView = Settings

export type FrameLoopHandlers = {
  readonly frameHandler: (deltaTime: import('@ts-minecraft/kernel').DeltaTimeSecs) => import('effect').Effect.Effect<void, never>
  readonly maintenanceHandler: () => import('effect').Effect.Effect<boolean, never>
}
