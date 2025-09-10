import { describe, it, expect } from '@effect/vitest'
import * as Domain from '../index'
import * as Components from '@/core/components'

describe('Domain Index', () => {
  it('should export core domain modules', () => {
    // Test that key exports are available
    expect(Domain.createArchetype).toBeDefined()
    expect(Domain.EntityIdSchema).toBeDefined()
    expect(Domain.Float).toBeDefined()
    expect(Domain.clampPitch).toBeDefined()
    expect(Domain.CHUNK_HEIGHT).toBeDefined()
  })

  it('should have component exports in new location', () => {
    expect(Components.ComponentSchemas).toBeDefined()
    expect(typeof Components.ComponentSchemas).toBe('object')
    expect(Components.componentNames.length).toBeGreaterThan(0)
    expect(Components.PositionComponent).toBeDefined()
  })

  it('should export utility functions', () => {
    expect(typeof Domain.clampPitch).toBe('function')
    expect(typeof Domain.updateCamera).toBeDefined()
    expect(typeof Domain.getCameraLookAt).toBe('function')
  })
})