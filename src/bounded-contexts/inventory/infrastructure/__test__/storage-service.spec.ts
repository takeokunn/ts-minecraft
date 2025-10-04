import { describe, expect, it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import * as FastCheck from 'effect/FastCheck'
import {
  BackupKeySchema,
  MillisecondsSchema,
  StorageConfigSchema,
  StorageKeySchema,
  defaultStorageConfig,
  makeBackupKey,
  makeStorageKey,
  toLoadFailed,
  toNotAvailable,
  toSaveFailed,
} from '../storage-service'
import { PlayerIdSchema } from '@mc/bc-inventory/domain/inventory-types'

describe('inventory/storage-service', () => {
  const decodePlayerId = Schema.decodeUnknownSync(PlayerIdSchema)
  const decodeMillis = Schema.decodeUnknownSync(MillisecondsSchema)
  const base36Chars = '0123456789abcdefghijklmnopqrstuvwxyz'.split('')

  it('defaultStorageConfig は Schema に準拠する', () => {
    expect(() => Schema.decodeUnknownSync(StorageConfigSchema)(defaultStorageConfig)).not.toThrow()
  })

  it.effect('makeStorageKey は brand 付きキーを生成する', () => {
    const playerId = decodePlayerId('550e8400-e29b-41d4-a716-446655440000')
    return makeStorageKey(playerId).pipe(
      Effect.tap((key) => Effect.sync(() => expect(Schema.is(StorageKeySchema)(key)).toBe(true)))
    )
  })

  it('makeBackupKey は property-based に brand 満たすキーを生成する', async () => {
    await FastCheck.assert(
      FastCheck.asyncProperty(
        FastCheck.uuid(),
        FastCheck.integer({ min: 1_000_000_000_000, max: 9_999_999_999_999 }),
        FastCheck.array(FastCheck.constantFrom(...base36Chars), { minLength: 9, maxLength: 9 }).map((chars) =>
          chars.join('')
        ),
        async (id, millisValue, nonce) => {
          const playerId = decodePlayerId(id)
          const millis = decodeMillis(Math.abs(millisValue) % 9_223_372_036_854_775_800)
          const backupKey = await Effect.runPromise(makeBackupKey(playerId, millis, nonce))
          expect(Schema.is(BackupKeySchema)(backupKey)).toBe(true)
        }
      ),
      { verbose: true }
    )
  })

  it('toNotAvailable は ADT バリアントを生成する', () => {
    const error = toNotAvailable('localStorage', 'disabled by browser')
    expect(error._tag).toBe('NotAvailable')
    expect(error.backend).toBe('localStorage')
  })

  it('toSaveFailed はコンテキスト情報を保持する', () => {
    const error = toSaveFailed('indexedDB', 'save', 'write failure')
    expect(error._tag).toBe('SaveFailed')
    expect(error.context).toBe('save')
    expect(error.message).toBe('write failure')
  })

  it('toLoadFailed は cause を Option.some で包む', () => {
    const cause = new Error('boom')
    const error = toLoadFailed('hybrid', 'load', 'failed', cause)
    expect(error._tag).toBe('LoadFailed')
    expect(error.cause._tag).toBe('Some')
    expect(error.cause.value).toBe(cause)
  })
})
