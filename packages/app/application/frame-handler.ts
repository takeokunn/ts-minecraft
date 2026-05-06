// Composition-root orchestrator for the game loop.
// Cross-layer imports are intentional — this file sequences all subsystems per frame.
// Per-stage decomposition (FR-017): each phase lives under frame/stages/; this module owns long-lived refs.
import { Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import * as THREE from 'three'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/kernel'
import { resolvePreset, type ResolvedGraphics } from '@ts-minecraft/game'
import type { Chunk } from '@ts-minecraft/terrain'
import { type DayNightLights } from '@ts-minecraft/game'
import type { DeltaTimeSecs } from '@ts-minecraft/kernel'
import { FALLBACK_PLAYER_POS } from './frame-handler.config'
import { type CameraPoseSnapshot } from '@ts-minecraft/app/frame/frame-runtime-logic'
import { createMaintenanceHandler } from '@ts-minecraft/app/frame/frame-maintenance'
import type {
  FrameHandlerDeps,
  FrameHandlerServices,
  FrameLoopHandlers,
  FrameStageRefs,
  ResolvedDeps,
} from '@ts-minecraft/app/frame/types'
import { lightingStage } from '@ts-minecraft/app/frame/stages/lighting-stage'
import { entityUpdateStage } from '@ts-minecraft/app/frame/stages/entity-update-stage'
import { chunkSyncStage } from '@ts-minecraft/app/frame/stages/chunk-sync-stage'
import { physicsStage } from '@ts-minecraft/app/frame/stages/physics-stage'
import { inputStage } from '@ts-minecraft/app/frame/stages/input-stage'
import { cameraStage } from '@ts-minecraft/app/frame/stages/camera-stage'
import { interactionStage } from '@ts-minecraft/app/frame/stages/interaction-stage'
import { refractionPrepassStage, postProcessingSetupStage } from '@ts-minecraft/app/frame/stages/post-processing-stage'
import { renderStage } from '@ts-minecraft/app/frame/stages/render-stage'
import { hudStage } from '@ts-minecraft/app/frame/stages/hud-stage'

// Re-export shared types so callers (tests, layers, presentation) keep importing
// from `@/frame-handler` without needing to reach into `@/frame/types`.
export type {
  FrameHandlerDeps,
  FrameHandlerServices,
  FrameLoopHandlers,
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
    const entityPhysicsChunkCacheRef = yield* Ref.make<ReadonlyArray<Chunk | null>>([
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
      lastAudioRef,
    }

    const applyPixelRatioCap = (pixelRatioCap: number): Effect.Effect<boolean, never> =>
      Ref.get(lastAppliedPixelRatioRef).pipe(
        Effect.flatMap((lastAppliedPixelRatio) => {
          /* c8 ignore next */
          const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1
          const nextPixelRatio = Math.min(devicePixelRatio, pixelRatioCap)
          if (Math.abs(lastAppliedPixelRatio - nextPixelRatio) < 0.01) {
            return Effect.succeed(false)
          }
          return Effect.sync(() => {
            /* c8 ignore next 2 */
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
          /* c8 ignore next */
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

// Coordinated frame + maintenance handlers that share chunk-sync state.
export const createFrameHandlers = (
  deps: FrameHandlerDeps,
  services: FrameHandlerServices,
): Effect.Effect<FrameLoopHandlers> => createFrameLoopHandlersInternal(deps, services)
