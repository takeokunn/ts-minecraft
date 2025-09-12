import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Effect from 'effect/Effect'

describe('logging utilities (simplified)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('should import logging module without errors', async () => {
    const logging = await import('@shared/utils/logging')
    expect(logging).toBeDefined()
    expect(logging.Logger).toBeDefined()
  })

  it('should have basic logging functions', async () => {
    const { Logger } = await import('@shared/utils/logging')
    
    expect(typeof Logger.configure).toBe('function')
    expect(typeof Logger.getConfig).toBe('function')
    expect(typeof Logger.debug).toBe('function')
    expect(typeof Logger.info).toBe('function')
    expect(typeof Logger.warn).toBe('function')
    expect(typeof Logger.error).toBe('function')
    expect(typeof Logger.critical).toBe('function')
  })
})