import { describe, expect, it } from '@effect/vitest'
import { defaultWorldDomainConfig } from '../config'
import { WorldDomainTypeGuards } from '../typeguards'

describe('domain/world/typeguards', () => {
  it('recognises valid config', () => {
    expect(WorldDomainTypeGuards.isWorldDomainConfig(defaultWorldDomainConfig)).toBe(true)
  })

  it('rejects invalid config', () => {
    expect(WorldDomainTypeGuards.isWorldDomainConfig({})).toBe(false)
  })

  it('validates world data shape', () => {
    expect(WorldDomainTypeGuards.isValidWorldData({ seed: 1, generator: {}, biomeSystem: {} })).toBe(true)
    expect(WorldDomainTypeGuards.isValidWorldData({})).toBe(false)
  })
})
