import { describe, expect, it } from 'vitest'
import type { Settings } from './settings.schema'
import { applySettingsEnvironmentPolicy } from './settings-service-environment'

describe('application/settings/settings-service-environment', () => {
  const baseSettings: Settings = {
    renderDistance: 3,
    mouseSensitivity: 0.5,
    dayLengthSeconds: 400,
    difficulty: 'normal',
    graphicsQuality: 'low',
    adaptivePerformanceMode: true,
    audioEnabled: true,
    masterVolume: 0.8,
    sfxVolume: 1.0,
    musicVolume: 0.55,
  } as const

  it('forces audio off on localhost', () => {
    expect(applySettingsEnvironmentPolicy(baseSettings, true)).toEqual({
      ...baseSettings,
      audioEnabled: false,
    })
  })

  it('keeps settings unchanged on non-localhost environments', () => {
    expect(applySettingsEnvironmentPolicy(baseSettings, false)).toBe(baseSettings)
  })
})
