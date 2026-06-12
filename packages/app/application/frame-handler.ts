// Composition-root orchestrator for the game loop.
// Cross-layer imports are intentional — this file sequences all subsystems per frame.
// Per-stage decomposition (FR-017): each phase lives under frame/stages/; this module owns long-lived refs.
import { Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import * as THREE from 'three'
import { resolvePreset, type ResolvedGraphics } from '@ts-minecraft/game'
import { MAX_AIR_SECS } from '@ts-minecraft/entity'
import type { Chunk } from '@ts-minecraft/world'
import type { DirtyChunkEntry } from './frame/frame-maintenance'
import { type DayNightLights } from '@ts-minecraft/game'
import { type CameraPoseSnapshot } from '@ts-minecraft/app/frame/frame-runtime-logic'
import { createMaintenanceHandler } from '@ts-minecraft/app/frame/frame-maintenance'
import { runFrameStages } from '@ts-minecraft/app/frame/frame-stage-executor'
import { createAttackSwingState } from '@ts-minecraft/presentation/hud/attack-swing'
import type {
  FrameHandlerDeps,
  FrameHandlerServices,
  FrameLoopHandlers,
  FrameStageRefs,
  ResolvedDeps,
} from '@ts-minecraft/app/frame/types'

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
    // FPS display throttle: store quantized tenths so we skip both the DOM write
    // and the per-frame toFixed string allocation when the displayed value is unchanged
    const lastFpsTenthsRef = yield* Ref.make(-1)
    // Health display throttle: skip DOM write when health values are unchanged (FR-006)
    const lastHealthRef = MutableRef.make({ current: -1, max: -1 })
    const lastHungerRef = MutableRef.make({ foodLevel: -1, max: -1 })
    const lastXPRef = MutableRef.make({ level: -1, xpIntoLevel: -1, xpRequiredForNext: -1 })
    const lastArmorRef = MutableRef.make({ armorPoints: -1 })
    // Far in the past so the first attack of a session is fully charged.
    const lastPlayerAttackTimeRef = yield* Ref.make(-1000)
    const attackSwingStateRef = yield* Ref.make(createAttackSwingState())
    // Nether portal: accumulated seconds in a NETHER_PORTAL block (resets on exit).
    const portalSecsRef = yield* Ref.make(0)
    // FR-2 liquid hazards: lava-burn timer + air supply (starts full).
    const lavaDamageSecsRef = MutableRef.make(0)
    const airSecsRef = MutableRef.make(MAX_AIR_SECS)
    const breakProgressRef = MutableRef.make<{ blockKey: string; ticks: number; totalTicks: number } | null>(null)
    const bowChargeStartRef = MutableRef.make<number | null>(null)
    const isShieldBlockingRef = MutableRef.make(false)
    const drownDamageSecsRef = MutableRef.make(0)
    // -1 sentinel forces the first air-HUD write.
    const lastAirBubblesRef = MutableRef.make(-1)
    const lastLoadedChunksRef = yield* Ref.make<Option.Option<ReadonlyArray<Chunk>>>(Option.none())
    // Skip chunk streaming work until the player changes chunk or render distance changes.
    const lastChunkStreamingRef = MutableRef.make({ cx: NaN, cz: NaN, renderDistance: NaN })
    // Keep retrying chunk mesh sync until the renderer reports the loaded set is fully synced.
    const chunkSyncPendingRef = MutableRef.make(false)
    // Track last renderDistance to avoid per-frame shadow camera updateProjectionMatrix
    const lastRenderDistanceRef = yield* Ref.make(0)
    const lastEntityStructureVersionRef = yield* Ref.make(-1)
    const entityPhysicsChunkCacheRef = yield* Ref.make<Array<Chunk | null>>([
      null, null, null,
      null, null, null,
      null, null, null,
    ])
    const lastEntityPhysicsChunkCoordRef = yield* Ref.make({ cx: NaN, cz: NaN })
    const lastEntityPhysicsLoadedChunksRef = yield* Ref.make<Option.Option<ReadonlyArray<Chunk>>>(Option.none())
    const shadowUpdateCounterRef = yield* Ref.make(0)
    const frustumThrottleStrideRef = yield* Ref.make(1)
    const frustumThrottleCounterRef = yield* Ref.make(0)
    const adaptiveQualityCooldownRef = yield* Ref.make(0)
    const lastAppliedPixelRatioRef = yield* Ref.make(Number.NaN)
    // Track last graphicsQuality + resolved preset to skip resolvePreset and pass enable sync when preset is unchanged
    const lastGraphicsQualityRef = yield* Ref.make<{ quality: number; resolved: ResolvedGraphics }>({
      quality: -1,
      resolved: resolvePreset('high'),
    })
    // Dirty chunk accumulator: deduplicates block break/place remesh calls within a single frame
    const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, DirtyChunkEntry>())

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
      p0: NaN,
      p5: NaN,
      p10: NaN,
      p14: NaN,
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
      p0: NaN,
      p5: NaN,
      p10: NaN,
      p14: NaN,
    })
    // Pre-allocated scratch buffers for captureCameraPose output-parameter pattern (R89).
    // Written into each frame before comparison; never stored long-term.
    const currentFrustumPoseScratch: CameraPoseSnapshot = {
      version: -1, x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1, p0: 0, p5: 0, p10: 0, p14: 0,
    }
    const currentRefractionPoseScratch: CameraPoseSnapshot = {
      version: -1, x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1, p0: 0, p5: 0, p10: 0, p14: 0,
    }
    // FR-005: Skip audio applySettings when volume/enabled haven't changed
    const lastAudioRef = MutableRef.make({ enabled: false, master: -1, sfx: -1, music: -1 })
    const wasGroundedRef = MutableRef.make(true)
    // Hoisted final-position ref: reset to initialPlayerPos at the start of physicsStage
    // each frame, avoiding a per-frame Ref.make allocation on the hot path.
    const finalPosRef = yield* Ref.make<import('@ts-minecraft/core').Position>({ x: 0, y: 0, z: 0 })

    // Pre-computed lights variant with sky disabled — avoids per-frame object spread
    const lightsWithoutSky: DayNightLights = { ...deps.lights, sky: Option.none() }

    // FR-004: Pre-resolve Option deps that never change between frames.
    // Eliminates Option.match dispatch overhead on every frame for fixed references.
    const resolved: ResolvedDeps = {
      skyMeshOrNull: Option.getOrNull(deps.skyMesh),
      fpsElementOrNull: Option.getOrNull(deps.fpsElement),
      healthValueElementOrNull: Option.getOrNull(deps.healthValueElement),
      healthMaxElementOrNull: Option.getOrNull(deps.healthMaxElement),
      hungerValueElementOrNull: Option.getOrNull(deps.hungerValueElement),
      hungerMaxElementOrNull: Option.getOrNull(deps.hungerMaxElement),
      airElementOrNull: Option.getOrNull(deps.airElement),
      breakProgressElementOrNull: Option.getOrNull(deps.breakProgressElement),
      xpLevelElementOrNull: Option.getOrNull(deps.xpLevelElement),
      xpBarElementOrNull: Option.getOrNull(deps.xpBarElement),
      xpBarMaxElementOrNull: Option.getOrNull(deps.xpBarMaxElement),
      armorValueElementOrNull: Option.getOrNull(deps.armorValueElement),
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
      lastFpsTenthsRef,
      lastHealthRef,
      lastHungerRef,
      lastXPRef,
      lastArmorRef,
      lastPlayerAttackTimeRef,
      attackSwingStateRef,
      portalSecsRef,
      lavaDamageSecsRef,
      airSecsRef,
      drownDamageSecsRef,
      breakProgressRef,
      bowChargeStartRef,
      isShieldBlockingRef,
      lastAirBubblesRef,
      lastRenderDistanceRef,
      lastEntityStructureVersionRef,
      entityPhysicsChunkCacheRef,
      lastEntityPhysicsChunkCoordRef,
      lastEntityPhysicsLoadedChunksRef,
      shadowUpdateCounterRef,
      frustumThrottleStrideRef,
      frustumThrottleCounterRef,
      adaptiveQualityCooldownRef,
      lastAppliedPixelRatioRef,
      lastGraphicsQualityRef,
      dirtyChunksRef,
      lastLoadedChunksRef,
      chunkSyncPendingRef,
      lastShadowTargetRef,
      lastFrustumCullRef,
      lastRefractionFrameRef,
      currentFrustumPoseScratch,
      currentRefractionPoseScratch,
      lastAudioRef,
      wasGroundedRef,
      finalPosRef,
      deltaTimeRef: MutableRef.make(0 as import('@ts-minecraft/core').DeltaTimeSecs),
    }

    const applyPixelRatioCap = (pixelRatioCap: number): Effect.Effect<boolean, never> =>
      Effect.gen(function* () {
        const lastAppliedPixelRatio = yield* Ref.get(lastAppliedPixelRatioRef)
        /* c8 ignore next */
        const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1
        const nextPixelRatio = Math.min(devicePixelRatio, pixelRatioCap)
        if (Math.abs(lastAppliedPixelRatio - nextPixelRatio) < 0.01) {
          return false
        }
        yield* Effect.sync(() => {
          /* c8 ignore next 2 */
          const width = deps.renderer.domElement.clientWidth || 1
          const height = deps.renderer.domElement.clientHeight || 1
          deps.renderer.setPixelRatio(nextPixelRatio)
          resolved.composerOrNull?.setPixelRatio(nextPixelRatio)
          deps.renderer.setSize(width, height)
          resolved.composerOrNull?.setSize(width, height)
        })
        yield* Ref.set(lastAppliedPixelRatioRef, nextPixelRatio)
        return true
      })

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
      cropTickAccumulatorRef: MutableRef.make(0),
    })

    // P4.1: Pre-build the frame pipeline Effect ONCE so the per-frame
    // frameHandler only sets deltaTime and returns the reused Effect,
    // avoiding a new Effect.gen generator closure allocation every frame.
    const framePipeline = runFrameStages(deps, services, refs, {
      resolved,
      lightsWithoutSky,
      sunWorldPos,
      applyPixelRatioCap,
      markShadowMapDirty,
    })

    const frameHandler = (deltaTime: Parameters<FrameLoopHandlers['frameHandler']>[0]) => {
      MutableRef.set(refs.deltaTimeRef, deltaTime)
      return framePipeline
    }

    return { frameHandler, maintenanceHandler }
  })

// Coordinated frame + maintenance handlers that share chunk-sync state.
export const createFrameHandlers = (
  deps: FrameHandlerDeps,
  services: FrameHandlerServices,
): Effect.Effect<FrameLoopHandlers> => createFrameLoopHandlersInternal(deps, services)
