import { describe, it } from 'vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import { StorageError } from '@ts-minecraft/block/domain/errors'
import {
  isQuotaExceeded,
  tryCatchStorage,
  tryCatchStorageWithRetry,
} from '../infrastructure/storage-error-mapping'

// ---------------------------------------------------------------------------
// isQuotaExceeded
// ---------------------------------------------------------------------------

describe('isQuotaExceeded', () => {
  it('returns true for DOMException with QuotaExceededError name', () => {
    const err = new DOMException('quota full', 'QuotaExceededError')
    expect(isQuotaExceeded(err)).toBe(true)
  })

  it('returns false for DOMException with different name', () => {
    const err = new DOMException('aborted', 'AbortError')
    expect(isQuotaExceeded(err)).toBe(false)
  })

  it('returns false for a plain Error', () => {
    expect(isQuotaExceeded(new Error('nope'))).toBe(false)
  })

  it('returns false for a string', () => {
    expect(isQuotaExceeded('QuotaExceededError')).toBe(false)
  })

  it('returns false for null', () => {
    expect(isQuotaExceeded(null)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// tryCatchStorage
// ---------------------------------------------------------------------------

describe('tryCatchStorage', () => {
  it('passes through the success value unchanged', async () => {
    const result = await Effect.runPromise(
      tryCatchStorage('save', Effect.succeed(42))
    )
    expect(result).toBe(42)
  })

  it('maps a QuotaExceededError to StorageError preserving the DOMException as cause', async () => {
    const quota = new DOMException('full', 'QuotaExceededError')
    const err = await Effect.runPromise(
      tryCatchStorage('save', Effect.fail(quota)).pipe(Effect.flip)
    )
    expect(err).toBeInstanceOf(StorageError)
    expect(err.operation).toBe('save')
    expect(err.cause).toBe(quota)
  })

  it('maps a generic Error to StorageError preserving cause', async () => {
    const original = new Error('network fail')
    const err = await Effect.runPromise(
      tryCatchStorage('load', Effect.fail(original)).pipe(Effect.flip)
    )
    expect(err).toBeInstanceOf(StorageError)
    expect(err.operation).toBe('load')
    expect(err.cause).toBe(original)
  })
})

// ---------------------------------------------------------------------------
// tryCatchStorageWithRetry
// ---------------------------------------------------------------------------

describe('tryCatchStorageWithRetry', () => {
  it('passes through the success value', async () => {
    const result = await Effect.runPromise(
      tryCatchStorageWithRetry('save', Effect.succeed('ok'))
    )
    expect(result).toBe('ok')
  })

  it('succeeds when a transient failure is followed by success', async () => {
    let attempts = 0
    const effect = Effect.suspend(() => {
      attempts++
      if (attempts < 2) return Effect.fail(new Error('transient'))
      return Effect.succeed('recovered')
    })

    const result = await Effect.runPromise(tryCatchStorageWithRetry('save', effect))
    expect(result).toBe('recovered')
    expect(attempts).toBe(2)
  })

  it('does not retry on QuotaExceededError (while predicate returns false)', async () => {
    let attempts = 0
    const quota = new DOMException('full', 'QuotaExceededError')
    const effect = Effect.suspend(() => {
      attempts++
      return Effect.fail(quota)
    })

    const err = await Effect.runPromise(
      tryCatchStorageWithRetry('save', effect).pipe(Effect.flip)
    )
    expect(err).toBeInstanceOf(StorageError)
    expect(attempts).toBe(1)
  })

  it('exhausts all retries and fails after 4 total attempts for non-quota error', async () => {
    let attempts = 0
    const effect = Effect.suspend(() => {
      attempts++
      return Effect.fail(new Error('always fails'))
    })

    await Effect.runPromise(
      tryCatchStorageWithRetry('save', effect).pipe(Effect.flip)
    )
    expect(attempts).toBe(4) // 1 initial + 3 retries
  }, 10_000)
})
