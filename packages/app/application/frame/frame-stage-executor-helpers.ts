import { Effect, Option } from 'effect'
import { markEffect } from '@ts-minecraft/rendering'
import { VEHICLE_SURFACE_SAMPLE_OFFSET } from '@ts-minecraft/game/application/game-state-update-orchestration'
import type * as THREE from 'three'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import type { DeltaTimeSecs, Position } from '@ts-minecraft/core'
import { FALLBACK_PLAYER_POS } from '@ts-minecraft/app/frame-handler.config'
import type { DebugFeatureFlags } from '@ts-minecraft/app/application/debug-feature-flags.config'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import type { ResolvedDeps } from '@ts-minecraft/app/application/frame/types/runtime'
import type {
  LocalEntitySnapshot,
  RemotePlayerSnapshot,
} from '@ts-minecraft/app/application/multiplayer/multiplayer-service'
import { chunkSyncStage } from '@ts-minecraft/app/frame/stages/chunk-sync-stage'
import { cameraStage } from '@ts-minecraft/app/frame/stages/camera-stage'
import { entityUpdateStage } from '@ts-minecraft/app/frame/stages/entity-update-stage'
import { achievementStage } from '@ts-minecraft/app/frame/stages/achievement-stage'
import { hudStage } from '@ts-minecraft/app/frame/stages/hud-stage'
import { inputStage } from '@ts-minecraft/app/frame/stages/input-stage'
import { interactionStage } from '@ts-minecraft/app/frame/stages/interaction-stage'
import { lightingStage } from '@ts-minecraft/app/frame/stages/lighting-stage'
import {
  multiplayerStage,
  applyInboundBlockEdits,
  applyInboundContainerUpdates,
  applyInboundDroppedItems,
  broadcastChestOnClose,
  syncDroppedItems,
  applyInboundEntitySnapshots,
  applyInboundEntityDamages,
} from '@ts-minecraft/app/frame/stages/multiplayer-stage'
import { postProcessingSetupStage, refractionPrepassStage } from '@ts-minecraft/app/frame/stages/post-processing-stage'
import { physicsStage } from '@ts-minecraft/app/frame/stages/physics-stage'
import { renderStage } from '@ts-minecraft/app/frame/stages/render-stage'
import { syncRemotePlayersForFrame } from '@ts-minecraft/app/application/frame/frame-remote-player-sync'
import { applyAudioSettings, resolveGraphicsForFrame } from '@ts-minecraft/app/application/frame/frame-settings-apply'
import { type DayNightLights, type ResolvedGraphics } from '@ts-minecraft/game'
import type { Settings } from '@ts-minecraft/game'
import { setMultiplayerEditDimension } from '@ts-minecraft/app/application/multiplayer/multiplayer-service'

export type FrameStageExecutorContext = {
  readonly resolved: ResolvedDeps
  readonly lightsWithoutSky: DayNightLights
  readonly sunWorldPos: THREE.Vector3
  readonly applyPixelRatioCap: (pixelRatioCap: number) => Effect.Effect<boolean, never>
  readonly markShadowMapDirty: () => void
}

// Daylight burn is an overworld phenomenon: the roofed nether and the end
// have no sun, but the shared day/night clock keeps ticking there — without
// the dimension gate every nether/end hostile (including fortress Blazes)
// would burn to death during the overworld's daytime.
export const isDaylightBurnProtected = (
  weather: 'clear' | 'rain' | 'thunder',
  dimension: 'overworld' | 'nether' | 'end',
): boolean => weather !== 'clear' || dimension !== 'overworld'

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
        entitySnapshots: [] as ReadonlyArray<LocalEntitySnapshot>,
      }
    }

    yield* markEffect('frame:chunkSync', chunkSyncStage(deps, services, refs))
    const lightingResult = yield* markEffect('frame:lighting', lightingStage(deps, services, refs, {
      deltaTime: inputs.deltaTime,
      effectiveLights: inputs.effectiveLights,
      playerPos: inputs.initialPlayerPos,
      markShadowMapDirty: inputs.markShadowMapDirty,
    }))
    const isNight = yield* services.timeService.isNight()
    const weather = yield* services.weatherService.getWeather()
    const dimension = yield* services.netherService.getDimension()
    // Keep outbound multiplayer block edits stamped with the live dimension
    // (and inbound edits filtered by it) — module scratch, refreshed per frame.
    setMultiplayerEditDimension(dimension)
    // Co-op: feed peers' positions into mob AI so hostiles chase the nearest
    // player instead of only the entity host's.
    const multiplayerOrNull = Option.getOrNull(services.multiplayer)
    const remotePlayerPositions: Position[] = []
    if (multiplayerOrNull !== null) {
      const remotePlayers = yield* multiplayerOrNull.getRemotePlayers().pipe(
        Effect.catchAll(() => Effect.succeed(new Map<string, RemotePlayerSnapshot>())),
      )
      for (const remotePlayer of remotePlayers.values()) {
        remotePlayerPositions.push({ x: remotePlayer.x, y: remotePlayer.y, z: remotePlayer.z } as Position)
      }
    }
    const entitySnapshots = yield* markEffect('frame:entityUpdate', entityUpdateStage(deps, services, refs, {
      deltaTime: inputs.deltaTime,
      debugFlags: inputs.debugFlags,
      playerPos: inputs.initialPlayerPos,
      totalTimeSecs: inputs.totalTimeSecs,
      isNight,
      daylightBurnProtected: isDaylightBurnProtected(weather, dimension),
      remotePlayerPositions,
    }))

    const playerPos = yield* markEffect('frame:physics', physicsStage(deps, services, refs, {
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
      effectsElementOrNull: inputs.resolved.effectsElementOrNull,
      airElementOrNull: inputs.resolved.airElementOrNull,
      debugFlags: inputs.debugFlags,
      difficulty: inputs.currentSettings.difficulty,
    }))

    return {
      playerPos,
      sunIntensity: lightingResult.sunIntensity,
      entitySnapshots,
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
    readonly entitySnapshots: ReadonlyArray<LocalEntitySnapshot>
    readonly resolved: ResolvedDeps
    readonly sunWorldPos: THREE.Vector3
    readonly markShadowMapDirty: () => void
  },
) =>
  Effect.gen(function* () {
    yield* markEffect('frame:input', inputStage(deps, services, refs, {
      mouseSensitivity: inputs.currentSettings.mouseSensitivity,
      dayLengthSeconds: inputs.currentSettings.dayLengthSeconds,
      playerPos: inputs.playerPos,
    }))

    const mp = Option.getOrNull(services.multiplayer)
    if (mp !== null) {
      yield* services.playerCameraState
        .getRotation()
        .pipe(
          Effect.flatMap((rotation) =>
            multiplayerStage(mp, services, refs, inputs.playerPos, rotation.yaw, rotation.pitch, inputs.entitySnapshots),
          ),
          Effect.flatMap(() => applyInboundBlockEdits(mp, services, refs.dirtyChunksRef)),
          Effect.flatMap(() => broadcastChestOnClose(mp, services)),
          Effect.flatMap(() => applyInboundContainerUpdates(mp, services)),
          Effect.flatMap(() => syncDroppedItems(mp, services)),
          Effect.flatMap(() => applyInboundDroppedItems(mp, services)),
          Effect.flatMap(() => applyInboundEntitySnapshots(mp, services)),
          Effect.flatMap(() => applyInboundEntityDamages(mp, services)),
          Effect.flatMap(() => syncRemotePlayersForFrame(mp, services, refs, inputs.totalTimeSecs)),
        )
        .pipe(Effect.catchAll(() => Effect.void))
    }

    if (!inputs.sessionPaused) {
      yield* markEffect('frame:camera', cameraStage(deps, services, refs, {
        playerPos: inputs.playerPos,
        renderDistance: inputs.currentSettings.renderDistance,
        markShadowMapDirty: inputs.markShadowMapDirty,
      }))
      yield* markEffect('frame:interaction', interactionStage(deps, services, refs, { debugFlags: inputs.debugFlags }))
      // Vehicle body under the rider (boat hull / minecart tub) — synced after
      // the camera so third-person and look-down first-person both see it at
      // the final player position for this frame.
      const boating = yield* services.gameState.isBoating()
      const minecarting = yield* services.gameState.isMinecarting()
      const vehicleKind = boating ? 'boat' as const : minecarting ? 'minecart' as const : null
      const vehicleYaw = vehicleKind !== null ? (yield* services.playerCameraState.getRotation()).yaw : 0
      services.vehicleVisual.update(vehicleKind, inputs.playerPos, vehicleYaw)
      if (minecarting) {
        // vanilla powered rails: the boost fires only while the rail cell is
        // redstone-powered; unpowered powered rails brake (see orchestration)
        const railCell = {
          x: Math.floor(inputs.playerPos.x),
          y: Math.floor(inputs.playerPos.y - VEHICLE_SURFACE_SAMPLE_OFFSET),
          z: Math.floor(inputs.playerPos.z),
        } as Position
        const railPower = yield* services.redstoneService.getPowerAt(railCell)
        yield* services.gameState.setPoweredRailBoost(railPower > 0)
      }
      yield* markEffect('frame:refraction', refractionPrepassStage(deps, services, refs, {
        resolvedGraphics: inputs.resolvedGraphics,
        totalTimeSecs: inputs.totalTimeSecs,
        sunIntensity: inputs.sunIntensity,
      }))
    }

    yield* markEffect('frame:postSetup', postProcessingSetupStage(deps, inputs.resolved, {
      resolvedGraphics: inputs.resolvedGraphics,
      graphicsChanged: inputs.graphicsChanged,
      pixelRatioChanged: inputs.pixelRatioChanged,
      markShadowMapDirty: inputs.markShadowMapDirty,
    }))
    yield* markEffect('frame:render', renderStage(deps, services, refs, inputs.resolved, {
      resolvedGraphics: inputs.resolvedGraphics,
      sunWorldPos: inputs.sunWorldPos,
      debugFlags: inputs.debugFlags,
      reducedMotion: inputs.currentSettings.reducedMotion,
    }))
    yield* markEffect('frame:hud', hudStage(deps, services, refs, {
      deltaTime: inputs.deltaTime,
      debugFlags: inputs.debugFlags,
      currentSettings: inputs.currentSettings,
      fpsElementOrNull: inputs.resolved.fpsElementOrNull,
      paused: inputs.sessionPaused,
    }))
    yield* markEffect('frame:achievements', achievementStage(services, refs.achievementCheckAccumulatorRef, inputs.deltaTime))
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
