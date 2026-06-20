import { Effect, MutableRef, Option } from 'effect'
import type * as THREE from 'three'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import { FALLBACK_PLAYER_POS } from '@ts-minecraft/app/frame-handler.config'
import type { DebugFeatureFlags } from '@ts-minecraft/app/application/debug-feature-flags.config'
import type { FrameAudioServices } from '@ts-minecraft/app/frame/frame-service-types/audio'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import type { ResolvedDeps } from '@ts-minecraft/app/application/frame/types/runtime'
import { chunkSyncStage } from '@ts-minecraft/app/frame/stages/chunk-sync-stage'
import { cameraStage } from '@ts-minecraft/app/frame/stages/camera-stage'
import { entityUpdateStage } from '@ts-minecraft/app/frame/stages/entity-update-stage'
import { hudStage } from '@ts-minecraft/app/frame/stages/hud-stage'
import { inputStage } from '@ts-minecraft/app/frame/stages/input-stage'
import { interactionStage } from '@ts-minecraft/app/frame/stages/interaction-stage'
import { lightingStage } from '@ts-minecraft/app/frame/stages/lighting-stage'
import { multiplayerStage, applyInboundBlockEdits } from '@ts-minecraft/app/frame/stages/multiplayer-stage'
import { postProcessingSetupStage, refractionPrepassStage } from '@ts-minecraft/app/frame/stages/post-processing-stage'
import { physicsStage } from '@ts-minecraft/app/frame/stages/physics-stage'
import { renderStage } from '@ts-minecraft/app/frame/stages/render-stage'
import { type DayNightLights, type ResolvedGraphics } from '@ts-minecraft/game'
import { resolvePreset } from '@ts-minecraft/game/application/settings-service.config'
import type { Settings } from '@ts-minecraft/game'

export type FrameStageExecutorContext = {
  readonly resolved: ResolvedDeps
  readonly lightsWithoutSky: DayNightLights
  readonly sunWorldPos: THREE.Vector3
  readonly applyPixelRatioCap: (pixelRatioCap: number) => Effect.Effect<boolean, never>
  readonly markShadowMapDirty: () => void
}

type FrameAudioSettings = Pick<Settings, 'audioEnabled' | 'masterVolume' | 'sfxVolume' | 'musicVolume'>

// Bit-packed numeric key for the graphics-resolve cache. Building a number
// instead of a joined string avoids a per-frame array + string allocation in
// the hot path; the cache changes only when a graphics setting is toggled.
const GRAPHICS_QUALITY_INDEX: Record<Parameters<typeof resolvePreset>[0], number> = {
  low: 0,
  medium: 1,
  high: 2,
  ultra: 3,
}

export const resolveGraphicsForFrame = (
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

export const applyAudioSettings = (
  services: FrameAudioServices,
  refs: Pick<FrameStageRefs, 'lastAudioRef'>,
  settings: FrameAudioSettings,
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

  return services.soundManager
    .applySettings({
      enabled: settings.audioEnabled,
      masterVolume: settings.masterVolume,
      sfxVolume: settings.sfxVolume,
    })
    .pipe(
      Effect.flatMap(() =>
        services.musicManager.applySettings({
          enabled: settings.audioEnabled,
          masterVolume: settings.masterVolume,
          musicVolume: settings.musicVolume,
        }),
      ),
    )
}

export const runActiveFrameStages = (
  deps: FrameHandlerDeps,
  services: FrameHandlerServices,
  refs: FrameStageRefs,
  inputs: {
    readonly deltaTime: DeltaTimeSecs
    readonly totalTimeSecs: number
    readonly currentSettings: Settings
    readonly debugFlags: DebugFeatureFlags
    readonly resolvedGraphics: ResolvedGraphics
    readonly effectiveLights: DayNightLights
    readonly initialPlayerPos: {
      readonly x: number
      readonly y: number
      readonly z: number
    }
    readonly resolved: ResolvedDeps
    readonly sessionPaused: boolean
    readonly markShadowMapDirty: () => void
  },
) =>
  Effect.gen(function* () {
    if (inputs.sessionPaused) {
      return {
        playerPos: inputs.initialPlayerPos,
        sunIntensity: 0,
      }
    }

    yield* chunkSyncStage(deps, services, refs)
    const lightingResult = yield* lightingStage(deps, services, refs, {
      deltaTime: inputs.deltaTime,
      effectiveLights: inputs.effectiveLights,
      playerPos: inputs.initialPlayerPos,
      markShadowMapDirty: inputs.markShadowMapDirty,
    })
    const isNight = yield* services.timeService.isNight()
    const weather = yield* services.weatherService.getWeather()
    yield* entityUpdateStage(deps, services, refs, {
      deltaTime: inputs.deltaTime,
      debugFlags: inputs.debugFlags,
      playerPos: inputs.initialPlayerPos,
      totalTimeSecs: inputs.totalTimeSecs,
      isNight,
      daylightBurnProtected: weather !== 'clear',
    })

    const playerPos = yield* physicsStage(deps, services, refs, {
      deltaTime: inputs.deltaTime,
      initialPlayerPos: inputs.initialPlayerPos,
      healthValueElementOrNull: inputs.resolved.healthValueElementOrNull,
      healthMaxElementOrNull: inputs.resolved.healthMaxElementOrNull,
      hungerValueElementOrNull: inputs.resolved.hungerValueElementOrNull,
      hungerMaxElementOrNull: inputs.resolved.hungerMaxElementOrNull,
      xpLevelElementOrNull: inputs.resolved.xpLevelElementOrNull,
      xpBarElementOrNull: inputs.resolved.xpBarElementOrNull,
      xpBarMaxElementOrNull: inputs.resolved.xpBarMaxElementOrNull,
      armorValueElementOrNull: inputs.resolved.armorValueElementOrNull,
      airElementOrNull: inputs.resolved.airElementOrNull,
      debugFlags: inputs.debugFlags,
      difficulty: inputs.currentSettings.difficulty,
    })

    return {
      playerPos,
      sunIntensity: lightingResult.sunIntensity,
    }
  })

export const runPresentationFrameStages = (
  deps: FrameHandlerDeps,
  services: FrameHandlerServices,
  refs: FrameStageRefs,
  inputs: {
    readonly deltaTime: DeltaTimeSecs
    readonly totalTimeSecs: number
    readonly currentSettings: Settings
    readonly debugFlags: DebugFeatureFlags
    readonly resolvedGraphics: ResolvedGraphics
    readonly graphicsChanged: boolean
    readonly pixelRatioChanged: boolean
    readonly sessionPaused: boolean
    readonly playerPos: {
      readonly x: number
      readonly y: number
      readonly z: number
    }
    readonly sunIntensity: number
    readonly resolved: ResolvedDeps
    readonly sunWorldPos: THREE.Vector3
    readonly markShadowMapDirty: () => void
  },
) =>
  Effect.gen(function* () {
    yield* inputStage(deps, services, refs, {
      mouseSensitivity: inputs.currentSettings.mouseSensitivity,
      dayLengthSeconds: inputs.currentSettings.dayLengthSeconds,
      playerPos: inputs.playerPos,
    })

    const mp = Option.getOrNull(services.multiplayer)
    if (mp !== null) {
      yield* services.playerCameraState
        .getRotation()
        .pipe(
          Effect.flatMap((rotation) => multiplayerStage(mp, inputs.playerPos, rotation.yaw, rotation.pitch)),
          Effect.flatMap(() => applyInboundBlockEdits(mp, services, refs.dirtyChunksRef)),
        )
        .pipe(Effect.catchAll(() => Effect.void))
    }

    if (!inputs.sessionPaused) {
      yield* cameraStage(deps, services, refs, {
        playerPos: inputs.playerPos,
        renderDistance: inputs.currentSettings.renderDistance,
        markShadowMapDirty: inputs.markShadowMapDirty,
      })
      yield* interactionStage(deps, services, refs, { debugFlags: inputs.debugFlags })
      yield* refractionPrepassStage(deps, services, refs, {
        resolvedGraphics: inputs.resolvedGraphics,
        totalTimeSecs: inputs.totalTimeSecs,
        sunIntensity: inputs.sunIntensity,
      })
    }

    yield* postProcessingSetupStage(deps, inputs.resolved, {
      resolvedGraphics: inputs.resolvedGraphics,
      graphicsChanged: inputs.graphicsChanged,
      pixelRatioChanged: inputs.pixelRatioChanged,
      markShadowMapDirty: inputs.markShadowMapDirty,
    })
    yield* renderStage(deps, services, refs, inputs.resolved, {
      resolvedGraphics: inputs.resolvedGraphics,
      sunWorldPos: inputs.sunWorldPos,
      debugFlags: inputs.debugFlags,
    })
    yield* hudStage(deps, services, refs, {
      deltaTime: inputs.deltaTime,
      debugFlags: inputs.debugFlags,
      currentSettings: inputs.currentSettings,
      fpsElementOrNull: inputs.resolved.fpsElementOrNull,
      paused: inputs.sessionPaused,
    })
  })

export const primeFrameEnvironment = (
  deps: FrameHandlerDeps,
  services: FrameHandlerServices,
  refs: FrameStageRefs,
  context: FrameStageExecutorContext,
  currentSettings: Settings,
  debugFlags: DebugFeatureFlags,
) =>
  Effect.gen(function* () {
    const [resolvedGraphics, graphicsChanged] = resolveGraphicsForFrame(
      refs,
      currentSettings.graphicsQuality,
      debugFlags['rendering.shadows'],
      debugFlags['rendering.sky'],
    )
    const effectiveLights = resolvedGraphics.skyEnabled ? deps.lights : context.lightsWithoutSky
    const pixelRatioChanged = yield* context.applyPixelRatioCap(resolvedGraphics.pixelRatioCap)
    /* c8 ignore next */
    if (context.resolved.skyMeshOrNull) context.resolved.skyMeshOrNull.visible = resolvedGraphics.skyEnabled

    const initialPlayerPos = yield* services.gameState
      .getPlayerPosition(DEFAULT_PLAYER_ID)
      .pipe(Effect.catchAllCause(() => Effect.succeed(FALLBACK_PLAYER_POS)))
    yield* applyAudioSettings(services, refs, currentSettings)
    yield* services.soundManager.setListenerPosition(initialPlayerPos)

    return {
      resolvedGraphics,
      graphicsChanged,
      effectiveLights,
      pixelRatioChanged,
      initialPlayerPos,
    }
  })
