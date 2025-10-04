import { describe, it, expect } from '@effect/vitest'
import { WorldDomain } from '../domain'

describe('domain/world/domain object', () => {
  it('exposes major namespaces', () => {
    expect(WorldDomain.Types).toBeDefined()
    expect(WorldDomain.ValueObjects).toBeDefined()
    expect(WorldDomain.Services).toBeDefined()
    expect(WorldDomain.Config.default.performanceMode).toBe('balanced')
  })

  it('provides distinct configs', () => {
    expect(WorldDomain.Config.performance.performanceMode).toBe('performance')
    expect(WorldDomain.Config.quality.performanceMode).toBe('quality')
  })
})
