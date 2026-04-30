import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  advanceFixedStep,
  captureCameraPose,
  decideAdaptiveQuality,
  hasCameraPoseChanged,
} from './frame-runtime-logic'

describe('frame-runtime-logic', () => {
  it('returns ticks and remainder for fixed-step accumulation', () => {
    const singleTick = advanceFixedStep(0.02, 0.04, 0.05)
    expect(singleTick.ticks).toBe(1)
    expect(singleTick.remainder).toBeCloseTo(0.01)

    const belowThreshold = advanceFixedStep(0.01, 0.01, 0.05)
    expect(belowThreshold.ticks).toBe(0)
    expect(belowThreshold.remainder).toBeCloseTo(0.02)

    const multiTick = advanceFixedStep(0.01, 0.16, 0.05)
    expect(multiTick.ticks).toBe(3)
    expect(multiTick.remainder).toBeCloseTo(0.02)
  })

  it('detects whether a camera pose changed', () => {
    const camera = new THREE.PerspectiveCamera()
    const previous = captureCameraPose(camera, 1)
    const same = captureCameraPose(camera, 1)
    expect(hasCameraPoseChanged(previous, same)).toBe(false)

    camera.position.set(1, 2, 3)
    const moved = captureCameraPose(camera, 1)
    expect(hasCameraPoseChanged(previous, moved)).toBe(true)

    camera.position.set(0, 0, 0)
    const samePoseNewVersion = captureCameraPose(camera, 2)
    expect(hasCameraPoseChanged(previous, samePoseNewVersion)).toBe(true)

    camera.quaternion.set(0, 0.5, 0, 1)
    const rotated = captureCameraPose(camera, 1)
    expect(hasCameraPoseChanged(previous, rotated)).toBe(true)
  })

  it('decides adaptive quality changes in the expected order', () => {
    expect(decideAdaptiveQuality({
      adaptivePerformanceMode: false,
      graphicsQuality: 'high',
      renderDistance: 8,
      fps: 40,
      cooldown: 0,
    })).toEqual({ nextCooldown: 0, settingsPatch: null })

    expect(decideAdaptiveQuality({
      adaptivePerformanceMode: true,
      graphicsQuality: 'ultra',
      renderDistance: 8,
      fps: 40,
      cooldown: 0,
    })).toEqual({ nextCooldown: 20, settingsPatch: { graphicsQuality: 'high' } })

    expect(decideAdaptiveQuality({
      adaptivePerformanceMode: true,
      graphicsQuality: 'low',
      renderDistance: 8,
      fps: 40,
      cooldown: 0,
    })).toEqual({ nextCooldown: 20, settingsPatch: { renderDistance: 7 } })

    expect(decideAdaptiveQuality({
      adaptivePerformanceMode: true,
      graphicsQuality: 'high',
      renderDistance: 8,
      fps: 40,
      cooldown: 3,
    })).toEqual({ nextCooldown: 2, settingsPatch: null })

    expect(decideAdaptiveQuality({
      adaptivePerformanceMode: true,
      graphicsQuality: 'high',
      renderDistance: 8,
      fps: 120,
      cooldown: 0,
    })).toEqual({ nextCooldown: 0, settingsPatch: null })
  })
})
