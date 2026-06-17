import { describe, it, expect } from 'vitest'
import {
  BLOCK_BYTES,
  computeWorkerCount,
  computeWorkerCountFromHardwareConcurrency,
  formatWorkerErrorDetails,
} from '../infrastructure/terrain-worker-pool-helpers'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/core'

describe('BLOCK_BYTES', () => {
  it('equals CHUNK_SIZE × CHUNK_SIZE × CHUNK_HEIGHT', () => {
    expect(BLOCK_BYTES).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  })
})

describe('computeWorkerCount', () => {
  it('returns a number between 1 and 3 inclusive', () => {
    const count = computeWorkerCount()
    expect(count).toBeGreaterThanOrEqual(1)
    expect(count).toBeLessThanOrEqual(3)
  })

  it('returns an integer', () => {
    expect(Number.isInteger(computeWorkerCount())).toBe(true)
  })

  it.each([
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 2],
    [6, 3],
    [8, 3],
    [16, 3],
    [Number.NaN, 1],
  ])('returns %i worker(s) for %i hardware thread(s)', (hardwareConcurrency, expected) => {
    expect(computeWorkerCountFromHardwareConcurrency(hardwareConcurrency)).toBe(expected)
  })
})

describe('formatWorkerErrorDetails', () => {
  const makeEvent = (overrides: Partial<{
    message: string
    filename: string
    lineno: number
    colno: number
    error: unknown
  }> = {}): ErrorEvent => ({
    message: '',
    filename: '',
    lineno: 0,
    colno: 0,
    error: undefined,
    ...overrides,
  } as unknown as ErrorEvent)

  it('uses "unknown error" when message is empty', () => {
    const result = formatWorkerErrorDetails(makeEvent({ message: '' }))
    expect(result).toContain('message=unknown error')
  })

  it('includes the message when non-empty', () => {
    const result = formatWorkerErrorDetails(makeEvent({ message: 'syntax error' }))
    expect(result).toContain('message=syntax error')
  })

  it('omits filename when empty string', () => {
    const result = formatWorkerErrorDetails(makeEvent({ message: 'err', filename: '' }))
    expect(result).not.toContain('filename=')
  })

  it('includes filename when present', () => {
    const result = formatWorkerErrorDetails(makeEvent({ message: 'err', filename: 'worker.js' }))
    expect(result).toContain('filename=worker.js')
  })

  it('omits lineno when 0', () => {
    const result = formatWorkerErrorDetails(makeEvent({ lineno: 0 }))
    expect(result).not.toContain('lineno=')
  })

  it('includes lineno when non-zero', () => {
    const result = formatWorkerErrorDetails(makeEvent({ lineno: 42 }))
    expect(result).toContain('lineno=42')
  })

  it('omits colno when 0', () => {
    const result = formatWorkerErrorDetails(makeEvent({ colno: 0 }))
    expect(result).not.toContain('colno=')
  })

  it('includes colno when non-zero', () => {
    const result = formatWorkerErrorDetails(makeEvent({ colno: 15 }))
    expect(result).toContain('colno=15')
  })

  it('includes Error message when error is an Error', () => {
    const result = formatWorkerErrorDetails(makeEvent({ error: new Error('oops') }))
    expect(result).toContain('error=oops')
  })

  it('includes stringified non-Error error', () => {
    const result = formatWorkerErrorDetails(makeEvent({ error: 'raw string error' }))
    expect(result).toContain('error=raw string error')
  })

  it('omits error field when error is undefined', () => {
    const result = formatWorkerErrorDetails(makeEvent({ error: undefined }))
    expect(result).not.toContain('error=')
  })

  it('joins fields with ", "', () => {
    const result = formatWorkerErrorDetails(makeEvent({ message: 'm', filename: 'f.js', lineno: 1 }))
    expect(result).toBe('message=m, filename=f.js, lineno=1')
  })
})
