import { describe, expect, it } from 'vitest'
import { length } from '@ts-minecraft/core'
import {
  computeCirclingVelocity,
  computeLandingVelocity,
  computeStrafingVelocity,
  computeTakeoffVelocity,
} from '../../domain/mob/ender-dragon/dragon-flight'

describe('dragon flight paths', () => {
  it('computes a scaled tangent for circling flight', () => {
    const velocity = computeCirclingVelocity({ x: 0, y: 64, z: 0 }, 20, 84, 0, 0.8)
    expect(length(velocity)).toBeCloseTo(0.8)
    expect(velocity.x).toBeCloseTo(0)
    expect(velocity.z).toBeGreaterThan(0)
    expect(velocity.y).toBeGreaterThan(0)
  })

  it('strafes toward the player at the requested speed', () => {
    const velocity = computeStrafingVelocity({ x: 0, y: 70, z: 0 }, { x: 3, y: 70, z: 4 }, 0.8)
    expect(length(velocity)).toBeCloseTo(0.8)
    expect(velocity.x).toBeCloseTo(0.48)
    expect(velocity.z).toBeCloseTo(0.64)
  })

  it('lands by descending toward the portal platform', () => {
    const velocity = computeLandingVelocity({ x: 0, y: 84, z: 0 }, { x: 0, y: 64, z: 0 }, 0.8)
    expect(length(velocity)).toBeCloseTo(0.8)
    expect(velocity.y).toBeCloseTo(-0.8)
  })

  it('takes off as a vertical ascent', () => {
    const velocity = computeTakeoffVelocity({ x: 0, y: 64, z: 0 }, 0.8)
    expect(velocity).toEqual({ x: 0, y: 0.8, z: 0 })
  })
})
