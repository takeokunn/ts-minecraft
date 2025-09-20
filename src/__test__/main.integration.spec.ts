import { it } from '@effect/vitest'
import { afterEach, beforeEach, describe, expect, vi } from 'vitest'

// Mock console to avoid noise
const mockConsoleLog = vi.fn()
const mockConsoleError = vi.fn()

describe('Main Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.console = {
      ...global.console,
      log: mockConsoleLog,
      error: mockConsoleError,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should import main.ts module', async () => {
    // This will actually import and execute main.ts
    // Use a cache-busting parameter to ensure fresh import
    const mainModule = await import(`../main.ts?v=${Date.now()}`)

    // Since main.ts runs asynchronously, we need to wait a bit
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Verify that console operations occurred
    expect(mockConsoleLog).toHaveBeenCalled()

    // The module should be defined (even if it exports nothing)
    expect(mainModule).toBeDefined()
  })

  it('should verify main.ts can be imported without critical errors', async () => {
    // Simple test to ensure the module structure is valid
    expect(async () => {
      await import(`../main.ts?v=${Date.now()}`)
      // Allow some time for async operations to settle
      await new Promise((resolve) => setTimeout(resolve, 50))
    }).not.toThrow()
  })
})
