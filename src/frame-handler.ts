/**
 * Frame handler factory — composition-root orchestrator for the game loop.
 *
 * This file intentionally imports from both application/ and presentation/ layers
 * because it is the per-frame coordinator: it sequences all subsystems (physics,
 * rendering, input, UI) in a single Effect.gen for each frame.
 *
 * Architectural note: this file lives at src/ root alongside main.ts and layers.ts.
 * Cross-layer imports here are the same kind of orchestration — acceptable in a composition root.
 *
 * Per-stage decomposition (FR-017): each high-level frame phase is a named const
 * exported as Effect.gen. The orchestrator at the bottom sequences them in order.
 * Stage boundaries enable upcoming per-stage instrumentation (FR-004, separate session).
 */
import { Array as Arr, Cause, Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import { GodRaysPass } from '@/infrastructure/three/god-rays-pass'
import { GameStateService } from '@/application/game-state'
import { GameModeService } from '@/application/game-mode'
import { DEFAULT_PLAYER_ID } from '@/application/constants'
import { MAX_SHADOW_HALF_EXTENT } from '@/shared/rendering-constants'
import { PlayerCameraStateService } from '@/application/camera/camera-state'
import { FirstPersonCameraService } from '@/application/camera/first-person-camera-service'
import { ThirdPersonCameraService } from '@/application/camera/third-person-camera-service'
import { BlockService } from '@/application/block/block-service'
import { HotbarService } from '@/application/hotbar/hotbar-service'
import { HOTBAR_START } from '@/application/inventory/inventory-service'
import { SlotIndex } from '@/shared/kernel'
import { ChunkManagerService } from '@/application/chunk/chunk-manager-service'
import { TimeService } from '@/application/time/time-service'
import {
  SettingsService,
  resolvePreset,
  type ResolvedGraphics,
  type Settings,
} from '@/application/settings/settings-service'
import { FPSCounterService } from '@/presentation/fps-counter'
import { HotbarRendererService } from '@/presentation/hud/hotbar-three'
import { BlockHighlightService } from '@/presentation/highlight/block-highlight'
import { WorldRendererService } from '@/infrastructure/three/world-renderer'
import { EntityRendererService } from '@/infrastructure/three/entity-renderer'
import { ChunkMeshService } from '@/infrastructure/three/meshing/chunk-mesh'
import { ParticleSystemService, getParticleUvOffset } from '@/infrastructure/three/particles/particle-system'
import { PerfHudService } from '@/infrastructure/perf/perf-hud'
import { InputService } from '@/presentation/input/input-service'
import { KeyMappings } from '@/application/input/key-mappings'
import { SettingsOverlayService } from '@/presentation/settings/settings-overlay'
import { PauseMenuService } from '@/presentation/menu/pause-menu'
import { InventoryRendererService } from '@/presentation/inventory/inventory-renderer'
import { InventoryService } from '@/application/inventory/inventory-service'
import { HealthService } from '@/application/player/health-service'
import { MusicManager, SoundManager } from '@/audio'
import { EntityManager } from '@/entity/entityManager'
import { MobSpawner } from '@/entity/spawner'
import { VillageService } from '@/village/village-service'
import { TradingPresentationService } from '@/presentation/trading'
import { RedstoneComponentType } from '@/redstone/redstone-model'
import { RedstoneService } from '@/redstone/redstone-service'
import { FluidService } from '@/application/fluid/fluid-service'
import { FurnaceService } from '@/application/furnace/furnace-service'
import { type Chunk, CHUNK_SIZE, CHUNK_HEIGHT, indexToBlockType } from '@/domain/chunk'
import type { EntityId as EntityIdType } from '@/entity/entity'
import { updateDayNightCycle, type DayNightLights } from '@/application/time/day-night-cycle'
import type { DeltaTimeSecs, Position } from '@/shared/kernel'
import {
  EYE_LEVEL_OFFSET,
  TRADE_DISTANCE, TRADE_OPEN_KEY, TRADE_NEXT_KEY, TRADE_PREV_KEY, TRADE_EXECUTE_KEY,
  REDSTONE_TICK_INTERVAL_SECS, FLUID_TICK_INTERVAL_SECS,
  REDSTONE_PLACE_WIRE_KEY, REDSTONE_PLACE_LEVER_KEY, REDSTONE_PLACE_BUTTON_KEY,
  REDSTONE_PLACE_TORCH_KEY, REDSTONE_PLACE_PISTON_KEY,
  REDSTONE_TOGGLE_LEVER_KEY, REDSTONE_PRESS_BUTTON_KEY, REDSTONE_TOGGLE_TORCH_KEY,
  PLAYER_ATTACK_REACH, PLAYER_ATTACK_RADIUS, PLAYER_ATTACK_DAMAGE, WOODEN_SWORD_ATTACK_DAMAGE,
  FALLBACK_PLAYER_POS,
} from './frame-handler.config'
import {
  advanceFixedStep,
  captureCameraPose,
  decideAdaptiveQuality,
  hasCameraPoseChanged,
  type AdaptiveQualityDecision,
  type CameraPoseSnapshot,
} from '@/frame/frame-runtime-logic'
import { createMaintenanceHandler } from '@/frame/frame-maintenance'

/**
 * Three.js objects and DOM state that live outside the Effect layer graph.
 * These are mutable references passed by value at startup — not Effect services —
 * because they are created and owned by main.ts before the game loop starts.
 * `gamePausedRef` is a Ref rather than a dedicated service to avoid introducing
 * a `GamePauseService` for a single boolean that only frame-handler reads/writes.
 */
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
  /**
   * FR-1.4 session pause flag — set to `true` while the pause-menu is open
   * (boot-level / Quit-to-Title flow). Distinct from `gamePausedRef`, which
   * tracks transient overlay state (settings/inventory/trading). Read
   * synchronously by frame stages to early-skip simulation while keeping
   * input + render running so the menu can draw on top.
   */
  readonly sessionPausedRef: MutableRef.MutableRef<boolean>
  readonly composer: Option.Option<EffectComposer>
  readonly skyMesh: Option.Option<THREE.Object3D>
  readonly gtaoPass: Option.Option<GTAOPass>
  readonly bloomPass: Option.Option<UnrealBloomPass>
  readonly dofPass: Option.Option<BokehPass>
  readonly godRaysPass: Option.Option<GodRaysPass>
  readonly smaaPass: Option.Option<SMAAPass>
}

/**
 * All Effect services needed per frame. Passed as explicit instances (not yielded from
 * context) so the returned handler has R = never — the frame Effect is self-contained
 * and does not require a per-frame `Effect.provide(MainLive)` that would rebuild all
 * 30+ layers at 60 Hz. Instances are resolved once in main.ts and forwarded here.
 */
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

export type FrameLoopHandlers = {
  readonly frameHandler: (deltaTime: DeltaTimeSecs) => Effect.Effect<void, never>
  readonly maintenanceHandler: () => Effect.Effect<boolean, never>
}

const findAttackableEntity = (
  entities: ReadonlyArray<{ readonly entityId: EntityIdType; readonly position: Position }>,
  camera: THREE.PerspectiveCamera,
  maxDistance: Option.Option<number>,
): Option.Option<EntityIdType> => {
  const cameraDirection = new THREE.Vector3()
  camera.getWorldDirection(cameraDirection)
  cameraDirection.normalize()

  const rayOrigin = camera.position
  let closestEntityId: EntityIdType | null = null
  let closestDistance = Infinity

  Arr.forEach(entities, (entity) => {
    const toEntity = new THREE.Vector3(
      entity.position.x - rayOrigin.x,
      entity.position.y + 0.9 - rayOrigin.y,
      entity.position.z - rayOrigin.z,
    )
    const alongRay = toEntity.dot(cameraDirection)
    if (alongRay < 0 || alongRay > PLAYER_ATTACK_REACH) return
    if (Option.match(maxDistance, { onNone: () => false, onSome: (d) => alongRay > d })) return

    const perpendicularSq = Math.max(0, toEntity.lengthSq() - alongRay * alongRay)
    if (perpendicularSq > PLAYER_ATTACK_RADIUS * PLAYER_ATTACK_RADIUS) return

    if (alongRay < closestDistance) {
      closestDistance = alongRay
      closestEntityId = entity.entityId
    }
  })

  return closestEntityId === null ? Option.none() : Option.some(closestEntityId)
}

// ---------------------------------------------------------------------------
// Stage context — bundle of refs and pre-resolved deps shared across stages.
// ---------------------------------------------------------------------------

type FrameStageRefs = {
  readonly totalTimeSecsRef: Ref.Ref<number>
  readonly redstoneTickAccumulatorRef: Ref.Ref<number>
  readonly fluidTickAccumulatorRef: Ref.Ref<number>
  readonly refractionFrameCounterRef: Ref.Ref<number>
  readonly refractionValidRef: Ref.Ref<boolean>
  readonly lastFpsTextRef: Ref.Ref<string>
  readonly lastHealthRef: MutableRef.MutableRef<{ current: number; max: number }>
  readonly lastRenderDistanceRef: Ref.Ref<number>
  readonly lastEntityStructureVersionRef: Ref.Ref<number>
  readonly shadowUpdateCounterRef: Ref.Ref<number>
  readonly frustumThrottleStrideRef: Ref.Ref<number>
  readonly frustumThrottleCounterRef: Ref.Ref<number>
  readonly adaptiveQualityCooldownRef: Ref.Ref<number>
  readonly lastAppliedPixelRatioRef: Ref.Ref<number>
  readonly lastGraphicsQualityRef: Ref.Ref<{ quality: string; resolved: ResolvedGraphics }>
  readonly dirtyChunksRef: Ref.Ref<HashMap.HashMap<string, Chunk>>
  readonly lastShadowTargetRef: MutableRef.MutableRef<{ x: number; z: number }>
  readonly lastFrustumCullRef: MutableRef.MutableRef<CameraPoseSnapshot>
  readonly lastRefractionFrameRef: MutableRef.MutableRef<CameraPoseSnapshot>
  readonly lastAudioRef: MutableRef.MutableRef<{ enabled: boolean; master: number; sfx: number; music: number }>
}

type ResolvedDeps = {
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

type FrameSettingsView = Settings

// ---------------------------------------------------------------------------
// Stage 1: lightingStage — day/night cycle, shadow dirty, music context, sun intensity
// ---------------------------------------------------------------------------

const lightingStage = (
  deps: Pick<FrameHandlerDeps, 'lights' | 'renderer'>,
  services: Pick<FrameHandlerServices, 'timeService' | 'musicManager' | 'chunkMeshService'>,
  refs: Pick<FrameStageRefs, 'shadowUpdateCounterRef'>,
  inputs: {
    readonly deltaTime: DeltaTimeSecs
    readonly effectiveLights: DayNightLights
    readonly playerPos: Position
    readonly markShadowMapDirty: () => void
  },
): Effect.Effect<{ readonly timeOfDay: number }, never> =>
  Effect.gen(function* () {
    yield* updateDayNightCycle(inputs.deltaTime, inputs.effectiveLights, services.timeService).pipe(
      Effect.catchAllCause((cause) => Effect.logError(`Day/night error: ${Cause.pretty(cause)}`)),
    )
    yield* Ref.updateAndGet(refs.shadowUpdateCounterRef, (n) => (n + 1) % 8).pipe(
      Effect.flatMap((shadowFrame) =>
        shadowFrame === 0 && deps.lights.light.castShadow
          ? Effect.sync(() => {
              inputs.markShadowMapDirty()
            })
          : Effect.void,
      ),
    )

    yield* services.timeService.isNight().pipe(
      Effect.flatMap((isNight) => services.musicManager.updateFromContext({ isNight, playerPosition: inputs.playerPos })),
      Effect.catchAllCause((cause) => Effect.logError(`Music update error: ${Cause.pretty(cause)}`)),
    )

    const timeOfDay = yield* services.timeService.getTimeOfDay()

    // Sun-driven shader uniform — derived from the canonical day-factor formula
    // (matches `updateDayNightCycle`'s sin curve so chunk lighting tracks the visible sun).
    const sunIntensity = Math.max(0, Math.sin((timeOfDay - 0.25) * Math.PI * 2))
    yield* services.chunkMeshService.setSunIntensity(sunIntensity).pipe(
      Effect.catchAllCause((cause) => Effect.logError(`Sun intensity sync error: ${Cause.pretty(cause)}`)),
    )

    return { timeOfDay }
  })

// ---------------------------------------------------------------------------
// Stage 2: entityUpdateStage — entityManager.update + mesh sync + transform animate
//                              + redstone tick + fluid tick (fixed-step world sims)
// ---------------------------------------------------------------------------

const entityUpdateStage = (
  deps: Pick<FrameHandlerDeps, 'scene'>,
  services: Pick<FrameHandlerServices, 'entityManager' | 'entityRenderer' | 'redstoneService' | 'fluidService' | 'particleSystem'>,
  refs: Pick<FrameStageRefs, 'lastEntityStructureVersionRef' | 'redstoneTickAccumulatorRef' | 'fluidTickAccumulatorRef'>,
  inputs: {
    readonly deltaTime: DeltaTimeSecs
    readonly playerPos: Position
    readonly totalTimeSecs: number
  },
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // Entity simulation stays on the frame lane so visible transforms remain responsive.
    // Slower world simulation (furnace/spawn/village) runs on the maintenance lane.
    yield* services.entityManager.update(inputs.deltaTime, inputs.playerPos).pipe(
      Effect.catchAllCause((cause) => Effect.logError(`Entity system error: ${Cause.pretty(cause)}`)),
    )

    // Sync entity meshes with the live entity list and animate transforms.
    // Must run after entityManager.update so the snapshot reflects this frame's positions.
    yield* Effect.all(
      [services.entityManager.getEntities(), services.entityManager.getStructureVersion()],
      { concurrency: 'unbounded' },
    ).pipe(
      Effect.flatMap(([entitiesSnapshot, structureVersion]) =>
        Ref.get(refs.lastEntityStructureVersionRef).pipe(
          Effect.flatMap((lastStructureVersion) =>
            (lastStructureVersion === structureVersion
              ? Effect.void
              : services.entityRenderer.syncEntities(entitiesSnapshot, deps.scene).pipe(
                  Effect.andThen(Ref.set(refs.lastEntityStructureVersionRef, structureVersion)),
                )
            ).pipe(
              Effect.andThen(
                services.entityRenderer.updateEntityTransforms(entitiesSnapshot, inputs.totalTimeSecs, inputs.deltaTime),
              ),
            ),
          ),
        ),
      ),
      Effect.catchAllCause((cause) => Effect.logError(`Entity render error: ${Cause.pretty(cause)}`)),
    )

    // Redstone simulation tick (fixed-step propagation)
    yield* Ref.modify(refs.redstoneTickAccumulatorRef, (accumulated) => {
      const { ticks, remainder } = advanceFixedStep(accumulated, inputs.deltaTime, REDSTONE_TICK_INTERVAL_SECS)
      return [ticks, remainder]
    }).pipe(
      Effect.flatMap((ticksToRun) =>
        ticksToRun === 1
          ? services.redstoneService.tick().pipe(Effect.asVoid)
          : ticksToRun > 1
            ? Effect.repeatN(services.redstoneService.tick(), ticksToRun - 1).pipe(Effect.asVoid)
            : Effect.void,
      ),
      Effect.catchAllCause((cause) => Effect.logError(`Redstone system error: ${Cause.pretty(cause)}`)),
    )

    // Fluid simulation tick (fixed-step propagation)
    yield* Ref.modify(refs.fluidTickAccumulatorRef, (accumulated) => {
      const { ticks, remainder } = advanceFixedStep(accumulated, inputs.deltaTime, FLUID_TICK_INTERVAL_SECS)
      return [ticks, remainder]
    }).pipe(
      Effect.flatMap((ticksToRun) =>
        ticksToRun === 1
          ? services.fluidService.tick().pipe(Effect.asVoid)
          : ticksToRun > 1
            ? Effect.repeatN(services.fluidService.tick(), ticksToRun - 1).pipe(Effect.asVoid)
            : Effect.void,
      ),
      Effect.catchAllCause((cause) => Effect.logError(`Fluid system error: ${Cause.pretty(cause)}`)),
    )

    // FR-1.6 — block-break particles: integrate position/velocity/lifetime
    // and write the InstancedMesh's instanceMatrix exactly once per frame.
    // Cheap O(MAX_PARTICLES=512) sweep over typed arrays — no per-particle GC.
    yield* services.particleSystem.update(inputs.deltaTime).pipe(
      Effect.catchAllCause((cause) => Effect.logError(`Particle system error: ${Cause.pretty(cause)}`)),
    )
  })

// ---------------------------------------------------------------------------
// Stage 3: chunkSyncStage — frustum culling on the frame lane
//                           (heavy chunk load/sync runs on maintenance lane)
// ---------------------------------------------------------------------------

const chunkSyncStage = (
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: Pick<FrameHandlerServices, 'worldRendererService'>,
  refs: Pick<FrameStageRefs, 'frustumThrottleStrideRef' | 'frustumThrottleCounterRef' | 'lastFrustumCullRef'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const sceneVersionBeforeCull = yield* services.worldRendererService.getSceneVersion()
    const currentFrustumPose = captureCameraPose(deps.camera, sceneVersionBeforeCull)
    const lastFrustumCull = MutableRef.get(refs.lastFrustumCullRef)
    const frustumStride = yield* Ref.get(refs.frustumThrottleStrideRef)
    const frustumTick = yield* Ref.updateAndGet(
      refs.frustumThrottleCounterRef,
      (n) => (n + 1) % Math.max(frustumStride, 1),
    )
    if (frustumTick === 0 && hasCameraPoseChanged(lastFrustumCull, currentFrustumPose)) {
      yield* services.worldRendererService.applyFrustumCulling(deps.camera)
      MutableRef.set(refs.lastFrustumCullRef, currentFrustumPose)
    }
  })

// ---------------------------------------------------------------------------
// Stage 4: physicsStage — gameState.update + health (fall damage / contact / death)
// ---------------------------------------------------------------------------

const physicsStage = (
  deps: Pick<FrameHandlerDeps, 'respawnPosition'>,
  services: Pick<FrameHandlerServices, 'gameState' | 'healthService' | 'soundManager' | 'entityManager' | 'gameMode'>,
  refs: Pick<FrameStageRefs, 'lastHealthRef'>,
  inputs: {
    readonly deltaTime: DeltaTimeSecs
    readonly initialPlayerPos: Position
    readonly healthValueElementOrNull: HTMLElement | null
    readonly healthMaxElementOrNull: HTMLElement | null
  },
): Effect.Effect<{ readonly playerPos: Position }, never> =>
  Effect.gen(function* () {
    // Update game state (input -> movement -> physics -> position sync)
    yield* services.gameState.update(inputs.deltaTime).pipe(
      Effect.catchAllCause((cause) => Effect.logError(`Physics update error: ${Cause.pretty(cause)}`)),
    )

    // Health: fall damage processing and HUD update
    const finalPosRef = yield* Ref.make(inputs.initialPlayerPos)

    yield* Effect.gen(function* () {
      const refreshedPos = yield* services.gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
        Effect.catchAllCause(() => Effect.succeed(inputs.initialPlayerPos)),
      )
      yield* Ref.set(finalPosRef, refreshedPos)

      const tryApplyPlayerDamage = (amount: number): Effect.Effect<boolean, never> =>
        amount <= 0
          ? Effect.succeed(false)
          : services.healthService.getHealth().pipe(
              Effect.flatMap((health) =>
                health.current <= 0 || health.invincibilityTicks > 0
                  ? Effect.succeed(false)
                  : services.healthService.applyDamage(amount).pipe(Effect.as(true)),
              ),
            )

      const isGrounded = yield* services.gameState.isPlayerGrounded()
      const fallDamage = yield* services.healthService.processFallDamage(refreshedPos.y, isGrounded)
      const tookFallDamage = yield* tryApplyPlayerDamage(fallDamage)
      if (tookFallDamage) {
        yield* services.soundManager.playEffect('playerHurt', { position: refreshedPos })
      }

      const hostileDamage = yield* services.entityManager.getPlayerContactDamage(refreshedPos)
      const tookHostileDamage = yield* tryApplyPlayerDamage(hostileDamage)
      if (tookHostileDamage) {
        yield* services.soundManager.playEffect('playerHurt', { position: refreshedPos })
      }

      const isDead = yield* services.healthService.isDead()
      if (isDead) {
        // FR-1.3: in SURVIVAL, the death-screen overlay (DeathScreenService)
        // owns respawn — it shows "YOU DIED" and waits for the player to click
        // Respawn or Quit-to-Title. Auto-respawning here would race the overlay
        // and produce a 1-frame flicker where the player snaps back to spawn
        // before the screen renders.
        // CREATIVE preserves the legacy auto-respawn (no death screen).
        const isCreative = yield* services.gameMode.isCreative()
        if (isCreative) {
          yield* services.healthService.reset()
          yield* services.gameState.respawn(deps.respawnPosition)
          yield* Ref.set(finalPosRef, deps.respawnPosition)
        }
      } else {
        yield* services.healthService.tick()
      }

      const health = yield* services.healthService.getHealth()
      // Pre-cached element refs (resolved once at startup in FrameHandlerDeps)
      // FR-006: Only write DOM when health values actually change
      const lastHealth = MutableRef.get(refs.lastHealthRef)
      if (lastHealth.current !== health.current || lastHealth.max !== health.max) {
        MutableRef.set(refs.lastHealthRef, { current: health.current, max: health.max })
        yield* Effect.sync(() => {
          if (inputs.healthValueElementOrNull) inputs.healthValueElementOrNull.textContent = String(health.current)
          if (inputs.healthMaxElementOrNull) inputs.healthMaxElementOrNull.textContent = String(health.max)
        })
      }
    }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Health error: ${Cause.pretty(cause)}`)))

    const playerPos = yield* Ref.get(finalPosRef)
    return { playerPos }
  })

// ---------------------------------------------------------------------------
// Stage 5: inputStage — mouse-look (when unpaused) + overlay/inventory/trade input
// ---------------------------------------------------------------------------

const inputStage = (
  deps: Pick<FrameHandlerDeps, 'camera' | 'gamePausedRef'>,
  services: Pick<
    FrameHandlerServices,
    | 'firstPersonCamera'
    | 'inputService'
    | 'inventoryRenderer'
    | 'settingsOverlay'
    | 'pauseMenu'
    | 'tradingPresentation'
    | 'villageService'
    | 'timeService'
  >,
  inputs: {
    readonly mouseSensitivity: number
    readonly dayLengthSeconds: number
    readonly playerPos: Position
  },
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // Update camera rotation from mouse look (suppressed when a modal is open)
    yield* Ref.get(deps.gamePausedRef).pipe(
      Effect.flatMap((paused) =>
        paused ? Effect.void : services.firstPersonCamera.update(deps.camera, inputs.mouseSensitivity),
      ),
    )

    // Handle overlay toggles: Escape (settings), E (inventory), T (trade)
    yield* Effect.gen(function* () {
      const [escPressed, inventoryPressed, tradePressed, tradeNextPressed, tradePrevPressed, tradeExecutePressed] =
        yield* Effect.all(
          [
            services.inputService.consumeKeyPress(KeyMappings.ESCAPE),
            services.inputService.consumeKeyPress(KeyMappings.INVENTORY_OPEN),
            services.inputService.consumeKeyPress(TRADE_OPEN_KEY),
            services.inputService.consumeKeyPress(TRADE_NEXT_KEY),
            services.inputService.consumeKeyPress(TRADE_PREV_KEY),
            services.inputService.consumeKeyPress(TRADE_EXECUTE_KEY),
          ],
          { concurrency: 'unbounded' },
        )

      const isTradeOpen = yield* services.tradingPresentation.isOpen()

      if (escPressed) {
        const isInvOpen = yield* services.inventoryRenderer.isOpen()
        const isSettingsOpen = yield* services.settingsOverlay.isOpen()
        const isPauseMenuOpen = yield* services.pauseMenu.isOpen()

        if (isTradeOpen) {
          yield* services.tradingPresentation.close()
          yield* Ref.set(deps.gamePausedRef, false)
        } else if (isInvOpen) {
          yield* services.inventoryRenderer.toggle()
          yield* Ref.set(deps.gamePausedRef, false)
        } else if (isSettingsOpen) {
          // Settings overlay close — pause-menu's own watchdog re-shows itself
          // afterward when it remains the active modal.
          yield* services.settingsOverlay.toggle()
          yield* Ref.set(deps.gamePausedRef, false)
        } else if (isPauseMenuOpen) {
          // Pause menu has its own keydown handler that consumes Esc to
          // resume; nothing more to do here.
        } else {
          // FR-1.4: ESC during play opens the in-session pause menu (formerly
          // toggled the settings overlay; settings is now reachable via the
          // pause menu's "Settings" button).
          yield* services.pauseMenu.openIfClosed()
        }
      }

      if (inventoryPressed) {
        const isInvOpen = yield* services.inventoryRenderer.isOpen()
        if (isInvOpen) {
          yield* services.inventoryRenderer.toggle()
          yield* Ref.set(deps.gamePausedRef, false)
        } else {
          const isSettingsOpen = yield* services.settingsOverlay.isOpen()
          const tradeOpen = yield* services.tradingPresentation.isOpen()
          if (isSettingsOpen) yield* services.settingsOverlay.toggle()
          if (tradeOpen) yield* services.tradingPresentation.close()
          yield* services.inventoryRenderer.toggle()
          yield* Ref.set(deps.gamePausedRef, true)
        }
      }

      if (tradePressed) {
        const tradeOpen = yield* services.tradingPresentation.isOpen()
        if (tradeOpen) {
          yield* services.tradingPresentation.close()
          yield* Ref.set(deps.gamePausedRef, false)
        } else {
          const isInvOpen = yield* services.inventoryRenderer.isOpen()
          const isSettingsOpen = yield* services.settingsOverlay.isOpen()
          if (!isInvOpen && !isSettingsOpen) {
            const villagerOption = yield* services.villageService.findNearestVillager(inputs.playerPos, TRADE_DISTANCE)
            yield* Option.match(villagerOption, {
              onNone: () => Effect.void,
              onSome: (villager) =>
                services.tradingPresentation.open(villager.villagerId).pipe(
                  Effect.flatMap((opened) => (opened ? Ref.set(deps.gamePausedRef, true) : Effect.void)),
                ),
            })
          }
        }
      }

      // FR-007: Early-exit guard — when no overlay is open (gamePausedRef=false),
      // skip trading navigation/refresh and inventory update entirely.
      const anyOverlayOpen = yield* Ref.get(deps.gamePausedRef)

      if (anyOverlayOpen) {
        const tradeOpenAfterToggles = yield* services.tradingPresentation.isOpen()

        if (tradeOpenAfterToggles) {
          if (tradePrevPressed) {
            yield* services.tradingPresentation.cycleSelection(-1)
          }
          if (tradeNextPressed) {
            yield* services.tradingPresentation.cycleSelection(1)
          }
          if (tradeExecutePressed) {
            yield* services.tradingPresentation.executeSelectedTrade()
          }
          yield* services.tradingPresentation.refresh()
        } else {
          const inventoryOpenAfterToggles = yield* services.inventoryRenderer.isOpen()
          if (inventoryOpenAfterToggles) {
            if (tradePrevPressed) {
              yield* services.inventoryRenderer.cycleRecipes(-1)
            }
            if (tradeNextPressed) {
              yield* services.inventoryRenderer.cycleRecipes(1)
            }
            if (tradeExecutePressed) {
              yield* services.inventoryRenderer.craftSelectedRecipe()
            }
          }
        }

        yield* services.inventoryRenderer.update()
      }

      // Sync day length to TimeService in case user applied settings changes
      // Guard: only update if the value has actually changed (avoids 60 allocs/sec)
      const currentDayLength = yield* services.timeService.getDayLength()
      if (currentDayLength !== inputs.dayLengthSeconds) {
        yield* services.timeService.setDayLength(inputs.dayLengthSeconds)
      }
    }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Overlay error: ${Cause.pretty(cause)}`)))
  })

// ---------------------------------------------------------------------------
// Stage 6: cameraStage — F5 view toggle, camera position+rotation sync,
//                        shadow target follow, dynamic far-plane / shadow camera.
// ---------------------------------------------------------------------------

const cameraStage = (
  deps: Pick<FrameHandlerDeps, 'camera' | 'lights'>,
  services: Pick<FrameHandlerServices, 'inputService' | 'playerCameraState' | 'thirdPersonCamera'>,
  refs: Pick<FrameStageRefs, 'lastShadowTargetRef' | 'lastRenderDistanceRef'>,
  inputs: {
    readonly playerPos: Position
    readonly renderDistance: number
    readonly markShadowMapDirty: () => void
  },
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // Handle view toggle: F5 switches first/third person before raycasting
    yield* services.inputService.consumeKeyPress(KeyMappings.CAMERA_TOGGLE).pipe(
      Effect.flatMap((pressed) => (pressed ? services.playerCameraState.toggleMode() : Effect.void)),
      Effect.catchAllCause((cause) => Effect.logError(`Camera toggle error: ${Cause.pretty(cause)}`)),
    )

    // Camera perspective + position sync (use current mode before raycasting)
    yield* Effect.all(
      [services.playerCameraState.getRotation(), services.playerCameraState.getMode()],
      { concurrency: 'unbounded' },
    ).pipe(
      Effect.flatMap(([rotation, cameraMode]) =>
        cameraMode === 'firstPerson'
          ? Effect.sync(() => {
              const eyeY = inputs.playerPos.y + EYE_LEVEL_OFFSET
              deps.camera.position.set(inputs.playerPos.x, eyeY, inputs.playerPos.z)
              deps.camera.rotation.set(rotation.pitch, rotation.yaw, 0, 'YXZ')
            })
          : services.thirdPersonCamera.update(deps.camera, inputs.playerPos, EYE_LEVEL_OFFSET),
      ),
      // Shadow frustum follows player so terrain around them is always shadow-covered
      // FR-009: Only update when player has moved more than 0.5 blocks (avoids per-frame updateMatrixWorld)
      Effect.andThen(
        Effect.sync(() => {
          const lastTarget = MutableRef.get(refs.lastShadowTargetRef)
          const dx = inputs.playerPos.x - lastTarget.x
          const dz = inputs.playerPos.z - lastTarget.z
          if (dx * dx + dz * dz > 0.25) {
            MutableRef.set(refs.lastShadowTargetRef, { x: inputs.playerPos.x, z: inputs.playerPos.z })
            deps.lights.light.target.position.set(inputs.playerPos.x, 0, inputs.playerPos.z)
            deps.lights.light.target.updateMatrixWorld()
            inputs.markShadowMapDirty()
          }
        }),
      ),
      // Dynamic shadow frustum: tighten bounds to renderDistance for higher texel density.
      // Only update when renderDistance changes (avoids per-frame updateProjectionMatrix).
      Effect.andThen(
        Ref.modify(refs.lastRenderDistanceRef, (lastRd): [boolean, number] =>
          lastRd === inputs.renderDistance ? [false, lastRd] : [true, inputs.renderDistance],
        ),
      ),
      Effect.flatMap((changed) =>
        changed
          ? Effect.sync(() => {
              // Dynamic camera far plane: keep Z-buffer precision tight to visible range
              deps.camera.far = Math.max(inputs.renderDistance * CHUNK_SIZE * 1.5 + CHUNK_HEIGHT, 300)
              deps.camera.updateProjectionMatrix()
              // Shadow frustum: tighten bounds to renderDistance for higher texel density
              const halfExtent = Math.min(
                Math.ceil(inputs.renderDistance * CHUNK_SIZE * 0.5),
                MAX_SHADOW_HALF_EXTENT,
              )
              const cam = deps.lights.light.shadow.camera
              cam.far = Math.max(inputs.renderDistance * CHUNK_SIZE * 1.5 + CHUNK_HEIGHT, 300)
              cam.left = -halfExtent
              cam.right = halfExtent
              cam.top = halfExtent
              cam.bottom = -halfExtent
              cam.updateProjectionMatrix()
              inputs.markShadowMapDirty()
            })
          : Effect.void,
      ),
    )
  })

// ---------------------------------------------------------------------------
// Stage 7: interactionStage — block highlight, then break/place/redstone interactions.
// ---------------------------------------------------------------------------

const interactionStage = (
  deps: Pick<FrameHandlerDeps, 'camera' | 'scene' | 'gamePausedRef'>,
  services: Pick<
    FrameHandlerServices,
    | 'blockHighlight'
    | 'hotbarService'
    | 'hotbarRenderer'
    | 'inputService'
    | 'blockService'
    | 'chunkManagerService'
    | 'soundManager'
    | 'entityManager'
    | 'inventoryService'
    | 'redstoneService'
    | 'furnaceService'
    | 'particleSystem'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // Update block highlight (always — independent of pause; spy uses scene state)
    yield* services.blockHighlight.update(deps.camera, deps.scene)

    // Handle block interaction (break/place) and hotbar (suppressed when paused)
    yield* Effect.gen(function* () {
      const paused = yield* Ref.get(deps.gamePausedRef)
      if (paused) return

      // Update hotbar slot selection (keyboard 1-9 and mouse wheel)
      yield* services.hotbarService.update()

      // Process block break/place clicks
      const leftClick = yield* services.inputService.consumeMouseClick(0)
      const rightClick = yield* services.inputService.consumeMouseClick(2)
      const [
        placeWirePressed,
        placeLeverPressed,
        placeButtonPressed,
        placeTorchPressed,
        placePistonPressed,
        toggleLeverPressed,
        pressButtonPressed,
        toggleTorchPressed,
      ] = yield* Effect.all(
        [
          services.inputService.consumeKeyPress(REDSTONE_PLACE_WIRE_KEY),
          services.inputService.consumeKeyPress(REDSTONE_PLACE_LEVER_KEY),
          services.inputService.consumeKeyPress(REDSTONE_PLACE_BUTTON_KEY),
          services.inputService.consumeKeyPress(REDSTONE_PLACE_TORCH_KEY),
          services.inputService.consumeKeyPress(REDSTONE_PLACE_PISTON_KEY),
          services.inputService.consumeKeyPress(REDSTONE_TOGGLE_LEVER_KEY),
          services.inputService.consumeKeyPress(REDSTONE_PRESS_BUTTON_KEY),
          services.inputService.consumeKeyPress(REDSTONE_TOGGLE_TORCH_KEY),
        ],
        { concurrency: 'unbounded' },
      )

      const hasRedstoneInput =
        placeWirePressed ||
        placeLeverPressed ||
        placeButtonPressed ||
        placeTorchPressed ||
        placePistonPressed ||
        toggleLeverPressed ||
        pressButtonPressed ||
        toggleTorchPressed

      if (leftClick || rightClick || hasRedstoneInput) {
        const targetBlock = yield* services.blockHighlight.getTargetBlock()
        const targetHit = yield* services.blockHighlight.getTargetHit()
        const selectedHotbarItem = yield* services.hotbarService.getSelectedBlockType()

        if (hasRedstoneInput) {
          yield* Option.match(targetBlock, {
            onNone: () => Effect.void,
            onSome: (tb) =>
              Effect.gen(function* () {
                const position = { x: tb.x, y: tb.y, z: tb.z }

                if (placeWirePressed) {
                  yield* services.redstoneService.setComponent(position, RedstoneComponentType.Wire)
                }
                if (placeLeverPressed) {
                  yield* services.redstoneService.setComponent(position, RedstoneComponentType.Lever)
                }
                if (placeButtonPressed) {
                  yield* services.redstoneService.setComponent(position, RedstoneComponentType.Button)
                }
                if (placeTorchPressed) {
                  yield* services.redstoneService.setComponent(position, RedstoneComponentType.Torch)
                }
                if (placePistonPressed) {
                  yield* services.redstoneService.setComponent(position, RedstoneComponentType.Piston)
                }
                if (toggleLeverPressed) {
                  yield* services.redstoneService.toggleLever(position)
                }
                if (pressButtonPressed) {
                  yield* services.redstoneService.pressButton(position)
                }
                if (toggleTorchPressed) {
                  yield* services.redstoneService.toggleTorch(position)
                }
              }),
          })

          yield* services.redstoneService.tick()
        }

        if (leftClick) {
          const targetEntity = yield* services.entityManager.getEntities().pipe(
            Effect.map((entities) =>
              findAttackableEntity(entities, deps.camera, Option.map(targetHit, (hit) => hit.distance)),
            ),
          )

          yield* Option.match(targetEntity, {
            onNone: () =>
              Option.match(targetBlock, {
                onNone: () => Effect.void,
                onSome: (tb) => {
                  const pos = { x: tb.x, y: tb.y, z: tb.z }
                  const chunkCoord = { x: Math.floor(tb.x / CHUNK_SIZE), z: Math.floor(tb.z / CHUNK_SIZE) }
                  const coordKey = `${chunkCoord.x},${chunkCoord.z}`
                  // FR-1.6 — read block type BEFORE breakBlock mutates it so the
                  // particle UV uses the correct atlas tile. Falls back to dirt
                  // (tile 0) if the local index is out of range.
                  const lx = ((tb.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
                  const lz = ((tb.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
                  const flatIdx = tb.y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
                  return services.chunkManagerService.getChunk(chunkCoord).pipe(
                    Effect.flatMap((preBreakChunk) => {
                      const blockId = preBreakChunk.blocks[flatIdx] ?? 0
                      const uv = getParticleUvOffset(blockId)
                      return Effect.all(
                        [
                          services.blockService.breakBlock(pos),
                          services.soundManager.playEffect('blockBreak', { position: pos }),
                          // 6 particles per break — center-of-block origin so the
                          // burst expands outward symmetrically.
                          services.particleSystem.spawnBurst(
                            tb.x + 0.5,
                            tb.y + 0.5,
                            tb.z + 0.5,
                            uv.u,
                            uv.v,
                            6,
                          ),
                        ],
                        { concurrency: 'unbounded', discard: true },
                      ).pipe(
                        Effect.andThen(services.chunkManagerService.getChunk(chunkCoord)),
                        Effect.flatMap((updatedChunk) =>
                          Ref.update(refs.dirtyChunksRef, (map) => HashMap.set(map, coordKey, updatedChunk)),
                        ),
                      )
                    }),
                  )
                },
              }),
            onSome: (entityId) =>
              services.entityManager
                .applyDamage(
                  entityId,
                  Option.match(selectedHotbarItem, {
                    onNone: () => PLAYER_ATTACK_DAMAGE,
                    onSome: (item) => (item === 'WOODEN_SWORD' ? WOODEN_SWORD_ATTACK_DAMAGE : PLAYER_ATTACK_DAMAGE),
                  }),
                )
                .pipe(
                  Effect.flatMap((drops) =>
                    Effect.forEach(
                      Option.getOrElse(drops, () => []),
                      (drop) => services.inventoryService.addBlock(drop.blockType, drop.count),
                      { concurrency: 'unbounded', discard: true },
                    ),
                  ),
                ),
          })
        }

        if (rightClick) {
          yield* Option.match(targetHit, {
            onNone: () => Effect.void,
            onSome: (hit) => {
              const targetPos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
              const targetChunkCoord = {
                x: Math.floor(targetPos.x / CHUNK_SIZE),
                z: Math.floor(targetPos.z / CHUNK_SIZE),
              }
              return services.chunkManagerService.getChunk(targetChunkCoord).pipe(
                Effect.flatMap((targetChunk) => {
                  const targetLx = ((targetPos.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
                  const targetLz = ((targetPos.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
                  const targetIdx = targetPos.y + targetLz * CHUNK_HEIGHT + targetLx * CHUNK_HEIGHT * CHUNK_SIZE
                  const targetBlockType = indexToBlockType(targetChunk.blocks[targetIdx] ?? 0)
                  if (targetBlockType === 'FURNACE') {
                    return services.furnaceService.setSelectedFurnace(targetPos)
                  }

                  const adjacentPos = {
                    x: hit.blockX + Math.round(hit.normal.x),
                    y: hit.blockY + Math.round(hit.normal.y),
                    z: hit.blockZ + Math.round(hit.normal.z),
                  }
                  return Effect.all(
                    [services.hotbarService.getSelectedBlockType(), services.hotbarService.getSelectedSlot()],
                    { concurrency: 'unbounded' },
                  ).pipe(
                    Effect.flatMap(([selectedBlock, selectedSlot]) =>
                      Option.match(selectedBlock, {
                        onNone: () => Effect.void,
                        onSome: (blockType) => {
                          const chunkCoord = {
                            x: Math.floor(adjacentPos.x / CHUNK_SIZE),
                            z: Math.floor(adjacentPos.z / CHUNK_SIZE),
                          }
                          const coordKey = `${chunkCoord.x},${chunkCoord.z}`
                          return services.blockService
                            .placeBlock(adjacentPos, blockType, SlotIndex.make(HOTBAR_START + selectedSlot))
                            .pipe(
                              Effect.flatMap(() =>
                                services.soundManager.playEffect('blockPlace', { position: adjacentPos }),
                              ),
                              Effect.andThen(services.chunkManagerService.getChunk(chunkCoord)),
                              Effect.flatMap((updatedChunk) =>
                                Ref.update(refs.dirtyChunksRef, (map) => HashMap.set(map, coordKey, updatedChunk)),
                              ),
                            )
                        },
                      }),
                    ),
                  )
                }),
              )
            },
          })
        }
      }

      // Update hotbar renderer with current slot state (first pass; second pass in hudStage)
      const [slots, selectedSlot] = yield* Effect.all(
        [services.hotbarService.getSlots(), services.hotbarService.getSelectedSlot()],
        { concurrency: 'unbounded' },
      )
      yield* services.hotbarRenderer.update(slots, selectedSlot)
    }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Block interaction error: ${Cause.pretty(cause)}`)))
  })

// ---------------------------------------------------------------------------
// Stage 8: refractionPrepassStage — water refraction RT (throttled by quality preset)
// ---------------------------------------------------------------------------

const refractionPrepassStage = (
  deps: Pick<FrameHandlerDeps, 'renderer' | 'scene' | 'camera'>,
  services: Pick<FrameHandlerServices, 'worldRendererService'>,
  refs: Pick<FrameStageRefs, 'refractionFrameCounterRef' | 'refractionValidRef' | 'lastRefractionFrameRef' | 'totalTimeSecsRef'>,
  inputs: {
    readonly resolvedGraphics: ResolvedGraphics
    readonly totalTimeSecs: number
  },
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // Refraction pre-pass for water shader — throttled by quality preset.
    // low=skip entirely, medium=every 3 frames, high=every 2, ultra=every frame.
    // Counter uses (n-1) so the first frame always runs (no initial-frame stutter).
    if (inputs.resolvedGraphics.refractionThrottleFrames > 0) {
      const refractionFrame = yield* Ref.updateAndGet(refs.refractionFrameCounterRef, (n) => n + 1)
      if ((refractionFrame - 1) % inputs.resolvedGraphics.refractionThrottleFrames === 0) {
        const sceneVersionBeforeRefraction = yield* services.worldRendererService.getSceneVersion()
        const currentRefractionPose = captureCameraPose(deps.camera, sceneVersionBeforeRefraction)
        const lastRefractionFrame = MutableRef.get(refs.lastRefractionFrameRef)
        const shouldRunRefraction = hasCameraPoseChanged(lastRefractionFrame, currentRefractionPose)

        if (shouldRunRefraction) {
          yield* services.worldRendererService
            .doRefractionPrePass(deps.renderer, deps.scene, deps.camera)
            .pipe(
              Effect.catchAllCause((cause) => Effect.logError(`Refraction pre-pass error: ${Cause.pretty(cause)}`)),
            )
          MutableRef.set(refs.lastRefractionFrameRef, currentRefractionPose)
          yield* Ref.getAndSet(refs.refractionValidRef, true).pipe(
            Effect.flatMap((wasValid) =>
              wasValid ? Effect.void : services.worldRendererService.setRefractionValid(true),
            ),
          )
        }
      }
    }

    // Update water uniforms (time + camera position only — resolution is set on resize)
    yield* services.worldRendererService.updateWaterUniforms(inputs.totalTimeSecs, deps.camera.position)
  })

// ---------------------------------------------------------------------------
// Stage 9: postProcessingSetupStage — sync pass enable/setSize from quality preset.
// ---------------------------------------------------------------------------

const postProcessingSetupStage = (
  deps: Pick<FrameHandlerDeps, 'renderer' | 'lights'>,
  resolved: Pick<ResolvedDeps, 'gtaoPassOrNull' | 'bloomPassOrNull' | 'dofPassOrNull' | 'smaaPassOrNull' | 'godRaysPassOrNull'>,
  inputs: {
    readonly resolvedGraphics: ResolvedGraphics
    readonly graphicsChanged: boolean
    readonly pixelRatioChanged: boolean
    readonly markShadowMapDirty: () => void
  },
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // FR-014: disabled passes still hold full-resolution render targets that waste VRAM.
    // On transition: disabled→setSize(1,1) shrinks RTs; enabled→setSize(w,h) restores them.
    if (inputs.graphicsChanged || inputs.pixelRatioChanged) {
      yield* Effect.sync(() => {
        const w = deps.renderer.domElement.clientWidth || 1
        const h = deps.renderer.domElement.clientHeight || 1
        const pixelRatio = typeof deps.renderer.getPixelRatio === 'function' ? deps.renderer.getPixelRatio() : 1
        const rw = Math.max(1, Math.ceil(w * pixelRatio))
        const rh = Math.max(1, Math.ceil(h * pixelRatio))
        if (deps.lights.light.castShadow !== inputs.resolvedGraphics.shadowsEnabled) {
          deps.lights.light.castShadow = inputs.resolvedGraphics.shadowsEnabled
          inputs.markShadowMapDirty()
        }
        if (resolved.gtaoPassOrNull) {
          const enabled = inputs.resolvedGraphics.ssaoEnabled && deps.renderer.capabilities.isWebGL2
          resolved.gtaoPassOrNull.enabled = enabled
          // FR-014: Half-resolution GTAO — 75% fill reduction with acceptable quality loss
          resolved.gtaoPassOrNull.setSize(enabled ? Math.ceil(rw / 2) : 1, enabled ? Math.ceil(rh / 2) : 1)
        }
        if (resolved.bloomPassOrNull) {
          resolved.bloomPassOrNull.enabled = inputs.resolvedGraphics.bloomEnabled
          resolved.bloomPassOrNull.strength = inputs.resolvedGraphics.bloomStrength
          resolved.bloomPassOrNull.setSize(
            inputs.resolvedGraphics.bloomEnabled ? rw : 1,
            inputs.resolvedGraphics.bloomEnabled ? rh : 1,
          )
        }
        if (resolved.dofPassOrNull) {
          resolved.dofPassOrNull.enabled = inputs.resolvedGraphics.dofEnabled
          resolved.dofPassOrNull.setSize(
            inputs.resolvedGraphics.dofEnabled ? rw : 1,
            inputs.resolvedGraphics.dofEnabled ? rh : 1,
          )
        }
        if (resolved.smaaPassOrNull) {
          resolved.smaaPassOrNull.enabled = inputs.resolvedGraphics.smaaEnabled
          resolved.smaaPassOrNull.setSize(
            inputs.resolvedGraphics.smaaEnabled ? rw : 1,
            inputs.resolvedGraphics.smaaEnabled ? rh : 1,
          )
        }
        if (resolved.godRaysPassOrNull) {
          resolved.godRaysPassOrNull.setNumSamples(inputs.resolvedGraphics.godRaysSamples)
          resolved.godRaysPassOrNull.setSize(
            inputs.resolvedGraphics.godRaysEnabled ? rw : 1,
            inputs.resolvedGraphics.godRaysEnabled ? rh : 1,
          )
        }
      })
    }
  })

// ---------------------------------------------------------------------------
// Stage 10: renderStage — god-rays sun projection + composer.render (or fallback).
// ---------------------------------------------------------------------------

const renderStage = (
  deps: Pick<FrameHandlerDeps, 'renderer' | 'scene' | 'camera' | 'lights'>,
  services: Pick<FrameHandlerServices, 'perfHud'>,
  resolved: Pick<ResolvedDeps, 'godRaysPassOrNull' | 'composerOrNull'>,
  inputs: {
    readonly resolvedGraphics: ResolvedGraphics
    readonly sunWorldPos: THREE.Vector3
  },
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    if (resolved.godRaysPassOrNull) {
      if (inputs.resolvedGraphics.godRaysEnabled) {
        const lightPos = deps.lights.light.position
        inputs.sunWorldPos.copy(lightPos).normalize().multiplyScalar(100)
        inputs.sunWorldPos.project(deps.camera)
        const sunU = (inputs.sunWorldPos.x + 1) * 0.5
        const sunV = (inputs.sunWorldPos.y + 1) * 0.5
        const behindCamera = inputs.sunWorldPos.z > 1
        const offScreen = sunU < -0.2 || sunU > 1.2 || sunV < -0.2 || sunV > 1.2
        if (behindCamera || offScreen) {
          resolved.godRaysPassOrNull.enabled = false
        } else {
          resolved.godRaysPassOrNull.sunScreenPos.set(sunU, sunV)
          // FR-003: Adaptive god-rays sample count — reduce by 50% when
          // sun is in the outer 40% of the screen where quality loss is imperceptible.
          const distFromCenter = Math.hypot(sunU - 0.5, sunV - 0.5)
          const baseSamples = inputs.resolvedGraphics.godRaysSamples
          const adaptiveSamples = distFromCenter > 0.3 ? Math.max(5, Math.floor(baseSamples * 0.5)) : baseSamples
          resolved.godRaysPassOrNull.setNumSamples(adaptiveSamples)
          resolved.godRaysPassOrNull.enabled = true
        }
      } else {
        resolved.godRaysPassOrNull.enabled = false
      }
    }

    if (resolved.composerOrNull) {
      resolved.composerOrNull.render()
    } else {
      deps.renderer.render(deps.scene, deps.camera)
    }
  }).pipe(
    Effect.andThen(services.perfHud.setDrawCalls(deps.renderer.info.render.calls)),
  )

// ---------------------------------------------------------------------------
// Stage 11: hudStage — FPS tick + adaptive quality + DOM update + hotbar HUD pass.
// ---------------------------------------------------------------------------

const hudStage = (
  deps: Pick<FrameHandlerDeps, 'renderer'>,
  services: Pick<FrameHandlerServices, 'fpsCounter' | 'settingsService' | 'hotbarRenderer' | 'perfHud'>,
  refs: Pick<FrameStageRefs, 'frustumThrottleStrideRef' | 'adaptiveQualityCooldownRef' | 'lastFpsTextRef'>,
  inputs: {
    readonly deltaTime: DeltaTimeSecs
    readonly currentSettings: FrameSettingsView
    readonly fpsElementOrNull: HTMLElement | null
    readonly paused?: boolean
  },
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // Feed the per-frame delta into the perf-HUD ring buffer. No-op when
    // `?debug=perf` is absent (PerfHudService returns trivial impl).
    yield* services.perfHud.recordFrame(inputs.deltaTime)

    // Update FPS display — tick first, then update DOM only when displayed value changes
    const fps = yield* services.fpsCounter.tick(inputs.deltaTime).pipe(Effect.andThen(services.fpsCounter.getFPS()))
    const fpsText = fps.toFixed(1)
    yield* Ref.set(refs.frustumThrottleStrideRef, fps >= 100 ? 1 : fps >= 60 ? 2 : 4)
    const adaptiveCooldown = yield* Ref.get(refs.adaptiveQualityCooldownRef)
    // FR-1.4: suspend adaptive-quality evaluation while paused — pause-menu
    // overhead can briefly tank FPS without indicating a real perf problem.
    const adaptiveQualityDecision: AdaptiveQualityDecision = inputs.paused
      ? { nextCooldown: adaptiveCooldown, settingsPatch: null }
      : decideAdaptiveQuality({
          adaptivePerformanceMode: inputs.currentSettings.adaptivePerformanceMode,
          graphicsQuality: inputs.currentSettings.graphicsQuality,
          renderDistance: inputs.currentSettings.renderDistance,
          fps,
          cooldown: adaptiveCooldown,
        })
    if (adaptiveQualityDecision.nextCooldown !== adaptiveCooldown) {
      yield* Ref.set(refs.adaptiveQualityCooldownRef, adaptiveQualityDecision.nextCooldown)
    }
    if (adaptiveQualityDecision.settingsPatch !== null) {
      yield* services.settingsService.updateSettings(adaptiveQualityDecision.settingsPatch)
    }
    const fpsChanged = yield* Ref.modify(refs.lastFpsTextRef, (last): [boolean, string] =>
      last === fpsText ? [false, last] : [true, fpsText],
    )
    if (fpsChanged && inputs.fpsElementOrNull) {
      yield* Effect.sync(() => {
        inputs.fpsElementOrNull!.textContent = fpsText
      })
    }

    // Render HUD hotbar overlay (second pass; autoClear=false prevents erasing the main scene)
    yield* Effect.sync(() => {
      deps.renderer.autoClear = false
    }).pipe(
      Effect.andThen(services.hotbarRenderer.render(deps.renderer)),
      Effect.andThen(
        Effect.sync(() => {
          deps.renderer.autoClear = true
        }),
      ),
      Effect.catchAllCause((cause) => Effect.logError(`HUD render error: ${Cause.pretty(cause)}`)),
    )
  })

// ---------------------------------------------------------------------------
// Internal factory — wires refs, derived deps, and the per-frame orchestrator.
// ---------------------------------------------------------------------------

const createFrameLoopHandlersInternal = (
  deps: FrameHandlerDeps,
  services: FrameHandlerServices,
): Effect.Effect<FrameLoopHandlers> =>
  Effect.gen(function* () {
    // ---- Allocate refs that span across frames ----
    // Accumulated total time for water shader uTime uniform (seconds since game start)
    const totalTimeSecsRef = yield* Ref.make(0)
    const redstoneTickAccumulatorRef = yield* Ref.make(0)
    const fluidTickAccumulatorRef = yield* Ref.make(0)
    // Refraction pre-pass frame counter: only render every N frames based on quality preset
    const refractionFrameCounterRef = yield* Ref.make(0)
    // Track whether the refraction texture has been rendered at least once —
    // prevents water shader from sampling a black/stale refraction texture on startup.
    const refractionValidRef = yield* Ref.make(false)
    // FPS display throttle: skip DOM write when displayed value is unchanged
    const lastFpsTextRef = yield* Ref.make('')
    // Health display throttle: skip DOM write when health values are unchanged (FR-006)
    const lastHealthRef = MutableRef.make({ current: -1, max: -1 })
    const lastLoadedChunksRef = yield* Ref.make<Option.Option<ReadonlyArray<Chunk>>>(Option.none())
    // Skip chunk streaming work until the player changes chunk or render distance changes.
    const lastChunkStreamingRef = MutableRef.make({ cx: NaN, cz: NaN, renderDistance: NaN })
    // Keep retrying chunk mesh sync until the renderer reports the loaded set is fully synced.
    const chunkSyncPendingRef = MutableRef.make(false)
    // Track last renderDistance to avoid per-frame shadow camera updateProjectionMatrix
    const lastRenderDistanceRef = yield* Ref.make(0)
    const lastEntityStructureVersionRef = yield* Ref.make(-1)
    const shadowUpdateCounterRef = yield* Ref.make(0)
    const frustumThrottleStrideRef = yield* Ref.make(1)
    const frustumThrottleCounterRef = yield* Ref.make(0)
    const adaptiveQualityCooldownRef = yield* Ref.make(0)
    const lastAppliedPixelRatioRef = yield* Ref.make(Number.NaN)
    // Track last graphicsQuality + resolved preset to skip resolvePreset and pass enable sync when preset is unchanged
    const lastGraphicsQualityRef = yield* Ref.make<{ quality: string; resolved: ResolvedGraphics }>({
      quality: '',
      resolved: resolvePreset('high'),
    })
    // Dirty chunk accumulator: deduplicates block break/place remesh calls within a single frame
    const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, Chunk>())

    // Pre-allocated for god rays sun position projection — reused each frame to avoid GC
    const sunWorldPos = yield* Effect.sync(() => new THREE.Vector3())

    // FR-009: Cache last shadow target position — skip updateMatrixWorld when player hasn't moved significantly
    const lastShadowTargetRef = MutableRef.make({ x: NaN, z: NaN })
    // Cache last world-renderer scene version + camera pose for frustum/refraction skips.
    const lastFrustumCullRef = MutableRef.make<CameraPoseSnapshot>({
      version: -1,
      x: NaN,
      y: NaN,
      z: NaN,
      qx: NaN,
      qy: NaN,
      qz: NaN,
      qw: NaN,
    })
    const lastRefractionFrameRef = MutableRef.make<CameraPoseSnapshot>({
      version: -1,
      x: NaN,
      y: NaN,
      z: NaN,
      qx: NaN,
      qy: NaN,
      qz: NaN,
      qw: NaN,
    })
    // FR-005: Skip audio applySettings when volume/enabled haven't changed
    const lastAudioRef = MutableRef.make({ enabled: false, master: -1, sfx: -1, music: -1 })

    // Pre-computed lights variant with sky disabled — avoids per-frame object spread
    const lightsWithoutSky: DayNightLights = { ...deps.lights, sky: Option.none() }

    // FR-004: Pre-resolve Option deps that never change between frames.
    // Eliminates Option.match dispatch overhead on every frame for fixed references.
    const resolved: ResolvedDeps = {
      skyMeshOrNull: Option.getOrNull(deps.skyMesh),
      fpsElementOrNull: Option.getOrNull(deps.fpsElement),
      healthValueElementOrNull: Option.getOrNull(deps.healthValueElement),
      healthMaxElementOrNull: Option.getOrNull(deps.healthMaxElement),
      gtaoPassOrNull: Option.getOrNull(deps.gtaoPass),
      bloomPassOrNull: Option.getOrNull(deps.bloomPass),
      dofPassOrNull: Option.getOrNull(deps.dofPass),
      smaaPassOrNull: Option.getOrNull(deps.smaaPass),
      godRaysPassOrNull: Option.getOrNull(deps.godRaysPass),
      composerOrNull: Option.getOrNull(deps.composer),
    }

    const refs: FrameStageRefs = {
      totalTimeSecsRef,
      redstoneTickAccumulatorRef,
      fluidTickAccumulatorRef,
      refractionFrameCounterRef,
      refractionValidRef,
      lastFpsTextRef,
      lastHealthRef,
      lastRenderDistanceRef,
      lastEntityStructureVersionRef,
      shadowUpdateCounterRef,
      frustumThrottleStrideRef,
      frustumThrottleCounterRef,
      adaptiveQualityCooldownRef,
      lastAppliedPixelRatioRef,
      lastGraphicsQualityRef,
      dirtyChunksRef,
      lastShadowTargetRef,
      lastFrustumCullRef,
      lastRefractionFrameRef,
      lastAudioRef,
    }

    const applyPixelRatioCap = (pixelRatioCap: number): Effect.Effect<boolean, never> =>
      Ref.get(lastAppliedPixelRatioRef).pipe(
        Effect.flatMap((lastAppliedPixelRatio) => {
          const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1
          const nextPixelRatio = Math.min(devicePixelRatio, pixelRatioCap)
          if (Math.abs(lastAppliedPixelRatio - nextPixelRatio) < 0.01) {
            return Effect.succeed(false)
          }
          return Effect.sync(() => {
            const width = deps.renderer.domElement.clientWidth || 1
            const height = deps.renderer.domElement.clientHeight || 1
            deps.renderer.setPixelRatio(nextPixelRatio)
            resolved.composerOrNull?.setPixelRatio(nextPixelRatio)
            deps.renderer.setSize(width, height)
            resolved.composerOrNull?.setSize(width, height)
          }).pipe(Effect.andThen(Ref.set(lastAppliedPixelRatioRef, nextPixelRatio)), Effect.as(true))
        }),
      )

    const markShadowMapDirty = (): void => {
      if (deps.renderer.shadowMap) {
        deps.renderer.shadowMap.needsUpdate = true
      }
    }

    const maintenanceHandler = createMaintenanceHandler(deps, services, {
      lastLoadedChunksRef,
      lastChunkStreamingRef,
      chunkSyncPendingRef,
      dirtyChunksRef,
    })

    // ---- Per-frame orchestrator: sequences stages in order ----
    const frameHandler = (deltaTime: DeltaTimeSecs) =>
      Effect.gen(function* () {
        // Accumulate total elapsed time for water shader uniform
        const totalTimeSecs = yield* Ref.updateAndGet(totalTimeSecsRef, (t) => t + deltaTime)

        // Fetch settings once per frame for shadow/SSAO and day-length reactive changes
        const currentSettings = yield* services.settingsService.getSettings()

        // Derive effective lights: conditionally nullify sky port based on preset
        // Cache resolvePreset result — only recompute when graphicsQuality changes
        const [resolvedGraphics, graphicsChanged] = yield* Ref.modify(
          lastGraphicsQualityRef,
          (last): [[ResolvedGraphics, boolean], { quality: string; resolved: ResolvedGraphics }] => {
            if (last.quality === currentSettings.graphicsQuality) return [[last.resolved, false], last]
            const next = {
              quality: currentSettings.graphicsQuality,
              resolved: resolvePreset(currentSettings.graphicsQuality),
            }
            return [[next.resolved, true], next]
          },
        )
        const effectiveLights = resolvedGraphics.skyEnabled ? deps.lights : lightsWithoutSky
        const pixelRatioChanged = yield* applyPixelRatioCap(resolvedGraphics.pixelRatioCap)
        yield* Effect.sync(() => {
          if (resolved.skyMeshOrNull) resolved.skyMeshOrNull.visible = resolvedGraphics.skyEnabled
        })

        // Hoist player position — shared across stages to avoid redundant Effect calls
        const initialPlayerPos = yield* services.gameState
          .getPlayerPosition(DEFAULT_PLAYER_ID)
          .pipe(Effect.catchAllCause(() => Effect.succeed(FALLBACK_PLAYER_POS)))

        // Audio settings (FR-005: skip applySettings when values haven't changed)
        const lastAudio = MutableRef.get(lastAudioRef)
        const audioChanged =
          lastAudio.enabled !== currentSettings.audioEnabled ||
          lastAudio.master !== currentSettings.masterVolume ||
          lastAudio.sfx !== currentSettings.sfxVolume ||
          lastAudio.music !== currentSettings.musicVolume
        if (audioChanged) {
          MutableRef.set(lastAudioRef, {
            enabled: currentSettings.audioEnabled,
            master: currentSettings.masterVolume,
            sfx: currentSettings.sfxVolume,
            music: currentSettings.musicVolume,
          })
          yield* services.soundManager.applySettings({
            enabled: currentSettings.audioEnabled,
            masterVolume: currentSettings.masterVolume,
            sfxVolume: currentSettings.sfxVolume,
          })
          yield* services.musicManager.applySettings({
            enabled: currentSettings.audioEnabled,
            masterVolume: currentSettings.masterVolume,
            musicVolume: currentSettings.musicVolume,
          })
        }
        // Listener position updates every frame (player moves)
        yield* services.soundManager.setListenerPosition(initialPlayerPos)

        // FR-1.4 pause matrix: when sessionPausedRef is true (pause-menu open or
        // quit-to-title in progress), skip simulation/world stages but keep
        // input + render running so the menu draws on top of the paused scene.
        // See main/session-control.ts for the pause-flag owner.
        const sessionPaused = MutableRef.get(deps.sessionPausedRef)

        // === Stage execution ===
        if (!sessionPaused) {
          yield* chunkSyncStage(deps, services, refs)

          yield* lightingStage(deps, services, refs, {
            deltaTime,
            effectiveLights,
            playerPos: initialPlayerPos,
            markShadowMapDirty,
          })

          yield* entityUpdateStage(deps, services, refs, {
            deltaTime,
            playerPos: initialPlayerPos,
            totalTimeSecs,
          })
        }

        // Physics: paused → skip update, but still snapshot last-known position
        // so cameraStage receives a sensible playerPos to render the static scene.
        const { playerPos } = sessionPaused
          ? { playerPos: initialPlayerPos }
          : yield* physicsStage(deps, services, refs, {
              deltaTime,
              initialPlayerPos,
              healthValueElementOrNull: resolved.healthValueElementOrNull,
              healthMaxElementOrNull: resolved.healthMaxElementOrNull,
            })

        // inputStage: ALWAYS runs — needed to receive ESC to unpause + dismiss
        // overlays. Inside, the existing gamePausedRef gates per-overlay logic.
        yield* inputStage(deps, services, {
          mouseSensitivity: currentSettings.mouseSensitivity,
          dayLengthSeconds: currentSettings.dayLengthSeconds,
          playerPos,
        })

        if (!sessionPaused) {
          yield* cameraStage(deps, services, refs, {
            playerPos,
            renderDistance: currentSettings.renderDistance,
            markShadowMapDirty,
          })

          yield* interactionStage(deps, services, refs)

          yield* refractionPrepassStage(deps, services, refs, {
            resolvedGraphics,
            totalTimeSecs,
          })
        }

        // postProcessingSetupStage: ALWAYS runs — pass enable/setSize must
        // react to resize events that arrive while paused.
        yield* postProcessingSetupStage(deps, resolved, {
          resolvedGraphics,
          graphicsChanged,
          pixelRatioChanged,
          markShadowMapDirty,
        })

        // renderStage: ALWAYS runs — pause-menu draws over the static world.
        yield* renderStage(deps, services, resolved, {
          resolvedGraphics,
          sunWorldPos,
        })

        // hudStage: ALWAYS runs — FPS counter + adaptive perf still update.
        // Adaptive perf eval inside hudStage already guards on cooldown; we
        // additionally suppress its FPS-driven preset switches while paused so
        // a temporarily low FPS at pause doesn't downgrade graphics.
        yield* hudStage(deps, services, refs, {
          deltaTime,
          currentSettings,
          fpsElementOrNull: resolved.fpsElementOrNull,
          paused: sessionPaused,
        })
      })

    return { frameHandler, maintenanceHandler }
  })

/**
 * Creates coordinated frame + maintenance handlers that share chunk-sync state.
 */
export const createFrameHandlers = (
  deps: FrameHandlerDeps,
  services: FrameHandlerServices,
): Effect.Effect<FrameLoopHandlers> => createFrameLoopHandlersInternal(deps, services)

/**
 * Backward-compatible single frame handler factory used by tests.
 */
export const createFrameHandler = (
  deps: FrameHandlerDeps,
  services: FrameHandlerServices,
): Effect.Effect<(deltaTime: DeltaTimeSecs) => Effect.Effect<void, never>> =>
  createFrameLoopHandlersInternal(deps, services).pipe(
    Effect.map(({ frameHandler, maintenanceHandler }) => (deltaTime: DeltaTimeSecs) =>
      maintenanceHandler().pipe(Effect.andThen(frameHandler(deltaTime))),
    ),
  )
