import { describe, it, assert } from '@effect/vitest'

describe('main', () => {
  it('should export main function', async () => {
    // Dynamically import to avoid module-level Effect execution
    const mainModule = await import('../main')
    assert.isFunction(mainModule.main)
  })

  it('should export gameSystems array', async () => {
    const mainModule = await import('../main')
    assert.isArray(mainModule.gameSystems)
    assert.isAbove(mainModule.gameSystems.length, 0)
  })
})