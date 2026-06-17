import { Effect, MutableRef, Option } from 'effect'
import type * as THREE from 'three'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import { resolvePreset, type DayNightLights, type ResolvedGraphics } from '@ts-minecraft/game'
import { FALLBACK_PLAYER_POS } from '@ts-minecraft/app/frame-handler.config'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs, ResolvedDeps } from '@ts-minecraft/app/frame/types'
import type { FrameAudioServices } from '@ts-minecraft/app/frame/frame-service-types'
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
import { multiplayerStage, applyInboundBlockEdits } from '@ts-minecraft/app/frame/stages/multiplayer-stage'

export type FrameStageExecutorContext = {
  readonly resolved: ResolvedDeps
  readonly lightsWithoutSky: DayNightLights
  readonly sunWorldPos: THREE.Vector3
  readonly applyPixelRatioCap: (pixelRatioCap: number) => Effect.Effect<boolean, never>
  readonly markShadowMapDirty: () => void
}

// Bit-packed numeric key for the graphics-resolve cache. Building a number
// instead of a joined string avoids a per-frame array + string allocation in
// the hot path; the cache changes only when a graphics setting is toggled.
const GRAPHICS_QUALITY_INDEX: Record<Parameters<typeof resolvePreset>[0], number> = {
  low: 0,
  medium: 1,
  high: 2,
  ultra: 3,
}

const resolveGraphicsForFrame = (
  refs: Pick<FrameStageRefs, 'lastGraphicsQualityRef'>,
  graphicsQuality: Parameters<typeof resolvePreset>[0],
  shadowsEnabled: boolean,
  skyEnabled: boolean,
): readonly [ResolvedGraphics, boolean] => {
  const graphicsCacheKey = GRAPHICS_QUALITY_INDEX[graphicsQuality] * 4 + (shadowsEnabled ? 2 : 0) + (skyEnabled ? 1 : 0)
  const last = MutableRef.get(refs.lastGraphicsQualityRef)
  if (last.quality === graphicsCacheKey) return [last.resolved, false]

  const preset = resolvePreset(graphicsQuality)
  const resolvedWithDebugFlags = shadowsEnabled && skyEnabled
    ? preset
    : {
        ...preset,
        shadowsEnabled: preset.shadowsEnabled && shadowsEnabled,
        skyEnabled: preset.skyEnabled && skyEnabled,
      }
  const next = { quality: graphicsCacheKey, resolved: resolvedWithDebugFlags }
  MutableRef.set(refs.lastGraphicsQualityRef, next)
  return [next.resolved, true]
}

const applyAudioSettings = (
  services: FrameAudioServices,
  refs: Pick<FrameStageRefs, 'lastAudioRef'>,
  settings: {
    readonly audioEnabled: boolean
    readonly masterVolume: number
    readonly sfxVolume: number
    readonly musicVolume: number
  },
) => {
  const lastAudio = MutableRef.get(refs.lastAudioRef)
  const audioChanged =
    lastAudio.enabled !== settings.audioEnabled ||
    lastAudio.master !== settings.masterVolume ||
    lastAudio.sfx !== settings.sfxVolume ||
    lastAudio.music !== settings.musicVolume
  if (!audioChanged) return Effect.void
  MutableRef.set(refs.lastAudioRef, {
    enabled: settings.audioEnabled,
    master: settings.masterVolume,
    sfx: settings.sfxVolume,
    music: settings.musicVolume,
  })
  return services.soundManager.applySettings({
    enabled: settings.audioEnabled,
    masterVolume: settings.masterVolume,
    sfxVolume: settings.sfxVolume,
  }).pipe(
    Effect.flatMap(() => services.musicManager.applySettings({
      enabled: settings.audioEnabled,
      masterVolume: settings.masterVolume,
      musicVolume: settings.musicVolume,
    })),
  )
}

export const runFrameStages = (
  deps: FrameHandlerDeps,
  services: FrameHandlerServices,
  refs: FrameStageRefs,
  context: FrameStageExecutorContext,
) =>
  Effect.gen(function* () {
    const deltaTime = MutableRef.get(refs.deltaTimeRef)
    const totalTimeSecs = MutableRef.get(refs.totalTimeSecsRef) + deltaTime
    MutableRef.set(refs.totalTimeSecsRef, totalTimeSecs)
    const currentSettings = yield* services.settingsService.getSettings()
    const debugFlags = yield* services.debugFeatureFlags.getFlags()
    const [resolvedGraphics, graphicsChanged] = resolveGraphicsForFrame(
      refs,
      currentSettings.graphicsQuality,
      debugFlags['rendering.shadows'],
      debugFlags['rendering.sky'],
    )
    const effectiveLights = resolvedGraphics.skyEnabled ? deps.lights : context.lightsWithoutSky
    const pixelRatioChanged = yield* context.applyPixelRatioCap(resolvedGraphics.pixelRatioCap)
    yield* Effect.sync(() => {
      /* c8 ignore next */
      if (context.resolved.skyMeshOrNull) context.resolved.skyMeshOrNull.visible = resolvedGraphics.skyEnabled
    })

    const initialPlayerPos = yield* services.gameState
      .getPlayerPosition(DEFAULT_PLAYER_ID)
      .pipe(Effect.catchAllCause(() => Effect.succeed(FALLBACK_PLAYER_POS)))
    yield* applyAudioSettings(services, refs, currentSettings)
    yield* services.soundManager.setListenerPosition(initialPlayerPos)

    const sessionPaused = MutableRef.get(deps.sessionPausedRef)
    let sunIntensity = 0
    if (!sessionPaused) {
      yield* chunkSyncStage(deps, services, refs)
      const lightingResult = yield* lightingStage(deps, services, refs, {
        deltaTime,
        effectiveLights,
        playerPos: initialPlayerPos,
        markShadowMapDirty: context.markShadowMapDirty,
      })
      sunIntensity = lightingResult.sunIntensity

      const isNight = yield* services.timeService.isNight()
      yield* entityUpdateStage(deps, services, refs, {
        deltaTime,
        debugFlags,
        playerPos: initialPlayerPos,
        totalTimeSecs,
        isNight,
      })
    }

    let playerPos = initialPlayerPos
    if (!sessionPaused) {
      playerPos = yield* physicsStage(deps, services, refs, {
        deltaTime,
        initialPlayerPos,
        healthValueElementOrNull: context.resolved.healthValueElementOrNull,
        healthMaxElementOrNull: context.resolved.healthMaxElementOrNull,
        hungerValueElementOrNull: context.resolved.hungerValueElementOrNull,
        hungerMaxElementOrNull: context.resolved.hungerMaxElementOrNull,
        xpLevelElementOrNull: context.resolved.xpLevelElementOrNull,
        xpBarElementOrNull: context.resolved.xpBarElementOrNull,
        xpBarMaxElementOrNull: context.resolved.xpBarMaxElementOrNull,
        armorValueElementOrNull: context.resolved.armorValueElementOrNull,
        airElementOrNull: context.resolved.airElementOrNull,
        debugFlags,
        difficulty: currentSettings.difficulty,
      })
    }

    yield* inputStage(deps, services, refs, {
      mouseSensitivity: currentSettings.mouseSensitivity,
      dayLengthSeconds: currentSettings.dayLengthSeconds,
      playerPos,
    })

    // Multiplayer position sync + inbound block-edit application (if service is wired)
    const mp = Option.getOrNull(services.multiplayer)
    if (mp !== null) {
      yield* services.playerCameraState.getRotation().pipe(
        Effect.flatMap((rotation) => multiplayerStage(mp, playerPos, rotation.yaw, rotation.pitch)),
        Effect.flatMap(() => applyInboundBlockEdits(mp, services, refs.dirtyChunksRef)),
      ).pipe(Effect.catchAll(() => Effect.void))
    }

    if (!sessionPaused) {
      yield* cameraStage(deps, services, refs, {
        playerPos,
        renderDistance: currentSettings.renderDistance,
        markShadowMapDirty: context.markShadowMapDirty,
      })
      yield* interactionStage(deps, services, refs, { debugFlags })
      yield* refractionPrepassStage(deps, services, refs, { resolvedGraphics, totalTimeSecs, sunIntensity })
    }

    yield* postProcessingSetupStage(deps, context.resolved, {
      resolvedGraphics,
      graphicsChanged,
      pixelRatioChanged,
      markShadowMapDirty: context.markShadowMapDirty,
    })
    yield* renderStage(deps, services, refs, context.resolved, { resolvedGraphics, sunWorldPos: context.sunWorldPos, debugFlags })
    yield* hudStage(deps, services, refs, {
      deltaTime,
      debugFlags,
      currentSettings,
      fpsElementOrNull: context.resolved.fpsElementOrNull,
      paused: sessionPaused,
    })
  })
