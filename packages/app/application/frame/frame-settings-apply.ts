import { Effect, MutableRef } from 'effect'
import { type ResolvedGraphics } from '@ts-minecraft/game'
import { resolvePreset } from '@ts-minecraft/game/application/settings-service.config'
import type { Settings } from '@ts-minecraft/game'
import type { FrameAudioServices } from '@ts-minecraft/app/frame/frame-service-types/audio'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'

// Per-frame application of graphics + audio settings, both change-gated so the
// expensive work (preset resolution / sound-manager reconfigure) runs only when
// a setting actually changed. Split out of frame-stage-executor-helpers.ts.

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
