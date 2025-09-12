import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Effect from 'effect/Effect'

describe('monitoring utilities (simplified)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should import monitoring module without errors', async () => {
    const monitoring = await import('@shared/utils/monitoring')
    expect(monitoring).toBeDefined()
    expect(monitoring.PerformanceMonitor).toBeDefined()
    expect(monitoring.HealthMonitor).toBeDefined()
  })

  it('should have basic monitoring functions', async () => {
    const { PerformanceMonitor, HealthMonitor } = await import('@shared/utils/monitoring')
    
    expect(typeof PerformanceMonitor.configure).toBe('function')
    expect(typeof PerformanceMonitor.getConfig).toBe('function')
    expect(typeof PerformanceMonitor.updateMetrics).toBe('function')
    expect(typeof PerformanceMonitor.getMetrics).toBe('function')
    
    expect(typeof HealthMonitor.registerCheck).toBe('function')
    expect(typeof HealthMonitor.runHealthCheck).toBe('function')
    expect(typeof HealthMonitor.getSystemStatus).toBe('function')
  })
})