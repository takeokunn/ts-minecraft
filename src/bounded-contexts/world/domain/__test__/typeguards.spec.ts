import { describe, it, expect } from '@effect/vitest'
import { WorldDomainTypeGuards } from '../typeguards'
import { defaultWorldDomainConfig } from '../config'

describe('domain/world/typeguards', () => {
  it('recognises valid config', () => {
    expect(WorldDomainTypeGuards.isWorldDomainConfig(defaultWorldDomainConfig)).toBe(true)
  })

  it('rejects invalid config', () => {
    expect(WorldDomainTypeGuards.isWorldDomainConfig({})).toBe(false)
  })

  it('validates world data shape', () => {
    expect(
      WorldDomainTypeGuards.isValidWorldData({ seed: 1, generator: {}, biomeSystem: {} })
    ).toBe(true)
    expect(WorldDomainTypeGuards.isValidWorldData({})).toBe(false)
  })
})
