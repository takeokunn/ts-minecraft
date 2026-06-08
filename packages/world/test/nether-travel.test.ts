import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import { resolveNetherTravel, PORTAL_SEARCH_RADIUS } from '@ts-minecraft/world'

describe('resolveNetherTravel', () => {
  it('PORTAL_SEARCH_RADIUS is the vanilla 128', () => {
    expect(PORTAL_SEARCH_RADIUS).toBe(128)
  })

  it('overworld→nether reuses an existing portal near the scaled destination', () => {
    // (80,64,160) overworld → (10,64,20) nether; a portal sits 2 blocks away.
    const existing = { x: 12, y: 64, z: 20 }
    const plan = resolveNetherTravel('overworld', { x: 80, y: 64, z: 160 }, [existing])

    expect(plan.toDimension).toBe('nether')
    expect(plan.destination).toEqual(existing)
    expect(Option.isNone(plan.portalToCreate)).toBe(true)
  })

  it('overworld→nether plans a new 2x3 portal at the scaled destination when none exists', () => {
    const plan = resolveNetherTravel('overworld', { x: 800, y: 64, z: 160 }, [])

    expect(plan.toDimension).toBe('nether')
    expect(plan.destination).toEqual({ x: 100, y: 64, z: 20 })
    expect(Option.isSome(plan.portalToCreate)).toBe(true)
    expect(Option.getOrThrow(plan.portalToCreate).interior).toHaveLength(6)
  })

  it('nether→overworld scales by 8 and plans a portal when none exists', () => {
    const plan = resolveNetherTravel('nether', { x: 10, y: 64, z: 20 }, [])

    expect(plan.toDimension).toBe('overworld')
    expect(plan.destination).toEqual({ x: 80, y: 64, z: 160 })
    expect(Option.isSome(plan.portalToCreate)).toBe(true)
  })

  it('nether→overworld reuses a nearby existing portal', () => {
    const existing = { x: 80, y: 64, z: 165 }
    const plan = resolveNetherTravel('nether', { x: 10, y: 64, z: 20 }, [existing])

    expect(plan.toDimension).toBe('overworld')
    expect(plan.destination).toEqual(existing)
    expect(Option.isNone(plan.portalToCreate)).toBe(true)
  })

  it('honors a custom search radius: a portal beyond it is not reused', () => {
    // Scaled dest (10,64,20); portal 30 blocks away — inside default 128 but outside 10.
    const existing = { x: 40, y: 64, z: 20 }
    const plan = resolveNetherTravel('overworld', { x: 80, y: 64, z: 160 }, [existing], 10)

    expect(Option.isSome(plan.portalToCreate)).toBe(true)
    expect(plan.destination).toEqual({ x: 10, y: 64, z: 20 })
  })
})
