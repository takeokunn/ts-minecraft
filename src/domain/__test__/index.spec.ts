import { describe, it, expect } from '@effect/vitest'
import * as Domain from '../index'

describe('Domain Index', () => {
  it('should export core domain modules', () => {
    // Test that key exports are available
    expect(Domain.createArchetype).toBeDefined()
    expect(Domain.Position).toBeDefined()
    expect(Domain.EntityIdSchema).toBeDefined()
    expect(Domain.Float).toBeDefined()
    expect(Domain.ComponentSchemas).toBeDefined()
    expect(Domain.clampPitch).toBeDefined()
    expect(Domain.CHUNK_HEIGHT).toBeDefined()
  })

  it('should have consistent exports from components', () => {
    expect(typeof Domain.ComponentSchemas).toBe('object')
    expect(Domain.componentNames.length).toBeGreaterThan(0)
  })

  it('should export utility functions', () => {
    expect(typeof Domain.clampPitch).toBe('function')
    expect(typeof Domain.updateCamera).toBeDefined()
    expect(typeof Domain.getCameraLookAt).toBe('function')
  })
})