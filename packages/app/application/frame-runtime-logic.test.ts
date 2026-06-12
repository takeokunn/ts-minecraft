import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import * as THREE from 'three'
import { Option } from 'effect'
import {
  advanceFixedStep,
  captureCameraPose,
  decideAdaptiveQuality,
  hasCameraPoseChanged,
} from '@ts-minecraft/app/frame/frame-runtime-logic'

describe('frame-runtime-logic', () => {
  it('returns ticks and remainder for fixed-step accumulation', () => {
    const [ticks1, rem1] = advanceFixedStep(0.02, 0.04, 0.05)
    expect(ticks1).toBe(1)
    expect(rem1).toBeCloseTo(0.01)

    const [ticks2, rem2] = advanceFixedStep(0.01, 0.01, 0.05)
    expect(ticks2).toBe(0)
    expect(rem2).toBeCloseTo(0.02)

    const [ticks3, rem3] = advanceFixedStep(0.01, 0.16, 0.05)
    expect(ticks3).toBe(3)
    expect(rem3).toBeCloseTo(0.02)
  })

  it('detects whether a camera pose changed', () => {
    const camera = new THREE.PerspectiveCamera()
    const makeScratch = () => ({ version: 0, x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1, p0: 0, p5: 0, p10: 0, p14: 0 })
    const previous = makeScratch()
    const current = makeScratch()
    captureCameraPose(camera, 1, previous)
    captureCameraPose(camera, 1, current)
    expect(hasCameraPoseChanged(previous, current)).toBe(false)

    camera.position.set(1, 2, 3)
    captureCameraPose(camera, 1, current)
    expect(hasCameraPoseChanged(previous, current)).toBe(true)

    camera.position.set(0, 0, 0)
    captureCameraPose(camera, 2, current)
    expect(hasCameraPoseChanged(previous, current)).toBe(true)

    camera.quaternion.set(0, 0.5, 0, 1)
    captureCameraPose(camera, 1, current)
    expect(hasCameraPoseChanged(previous, current)).toBe(true)

    camera.quaternion.set(0, 0, 0, 1)
    camera.far = 512
    camera.updateProjectionMatrix()
    captureCameraPose(camera, 1, current)
    expect(hasCameraPoseChanged(previous, current)).toBe(true)
  })

  it('decides adaptive quality changes in the expected order', () => {
    expect(decideAdaptiveQuality({
      adaptivePerformanceMode: false,
      graphicsQuality: 'high',
      renderDistance: 8,
      fps: 40,
      cooldown: 0,
    })).toEqual({ nextCooldown: 0, settingsPatch: Option.none() })

    expect(decideAdaptiveQuality({
      adaptivePerformanceMode: true,
      graphicsQuality: 'ultra',
      renderDistance: 8,
      fps: 40,
      cooldown: 0,
    })).toEqual({ nextCooldown: 20, settingsPatch: Option.some({ graphicsQuality: 'high' }) })

    expect(decideAdaptiveQuality({
      adaptivePerformanceMode: true,
      graphicsQuality: 'low',
      renderDistance: 8,
      fps: 40,
      cooldown: 0,
    })).toEqual({ nextCooldown: 20, settingsPatch: Option.some({ renderDistance: 7 }) })

    expect(decideAdaptiveQuality({
      adaptivePerformanceMode: true,
      graphicsQuality: 'high',
      renderDistance: 8,
      fps: 40,
      cooldown: 3,
    })).toEqual({ nextCooldown: 2, settingsPatch: Option.none() })

    expect(decideAdaptiveQuality({
      adaptivePerformanceMode: true,
      graphicsQuality: 'high',
      renderDistance: 8,
      fps: 120,
      cooldown: 0,
    })).toEqual({ nextCooldown: 0, settingsPatch: Option.none() })

    expect(decideAdaptiveQuality({
      adaptivePerformanceMode: true,
      graphicsQuality: 'medium',
      renderDistance: 8,
      fps: 40,
      cooldown: 0,
    })).toEqual({ nextCooldown: 20, settingsPatch: Option.some({ graphicsQuality: 'low' }) })

    expect(decideAdaptiveQuality({
      adaptivePerformanceMode: true,
      graphicsQuality: 'low',
      renderDistance: 4,
      fps: 40,
      cooldown: 0,
    })).toEqual({ nextCooldown: 0, settingsPatch: Option.none() })

    expect(decideAdaptiveQuality({
      adaptivePerformanceMode: true,
      graphicsQuality: 'low',
      renderDistance: 8,
      fps: 40,
      cooldown: 0,
      chunkSyncPending: true,
    })).toEqual({ nextCooldown: 20, settingsPatch: Option.some({ renderDistance: 7 }) })
  })
})
