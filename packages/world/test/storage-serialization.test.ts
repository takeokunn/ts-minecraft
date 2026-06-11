import { describe, it, expect } from 'vitest'
import { Effect, Option } from 'effect'
import {
  encodeWorldMetadata,
  decodeWorldMetadata,
  decodeOptionalWorldMetadata,
  collectDecodedWorldMetadata,
} from '../infrastructure/storage-serialization'
import type { WorldMetadata } from '../domain/world-metadata-model'

const validMetadata: WorldMetadata = {
  seed: 42,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  lastPlayed: new Date('2024-06-01T00:00:00.000Z'),
  playerSpawn: { x: 0, y: 64, z: 0 },
  gameMode: 'survival',
  saveVersion: 1,
}

describe('encodeWorldMetadata', () => {
  it('encodes valid metadata without error', async () => {
    const encoded = await Effect.runPromise(encodeWorldMetadata(validMetadata))
    expect(typeof encoded.seed).toBe('number')
    expect(encoded.seed).toBe(42)
  })

  it('round-trips through encode→decode', async () => {
    const encoded = await Effect.runPromise(encodeWorldMetadata(validMetadata))
    const decoded = await Effect.runPromise(decodeWorldMetadata(encoded, 'test'))
    expect(decoded.seed).toBe(42)
    expect(decoded.gameMode).toBe('survival')
  })
})

describe('decodeWorldMetadata', () => {
  it('decodes a valid encoded object', async () => {
    const encoded = await Effect.runPromise(encodeWorldMetadata(validMetadata))
    const result = await Effect.runPromise(decodeWorldMetadata(encoded, 'test'))
    expect(result.seed).toBe(42)
    expect(result.playerSpawn).toEqual({ x: 0, y: 64, z: 0 })
  })

  it('fails with StorageError for invalid data', async () => {
    const result = await Effect.runPromise(
      decodeWorldMetadata({ invalid: true }, 'test-op').pipe(Effect.option),
    )
    expect(Option.isNone(result)).toBe(true)
  })

  it('preserves the operation name in the error', async () => {
    const result = await Effect.runPromise(
      decodeWorldMetadata({}, 'myOperation').pipe(Effect.flip).pipe(Effect.option),
    )
    const error = Option.getOrThrow(result)
    expect(error.operation).toBe('myOperation')
  })
})

describe('decodeOptionalWorldMetadata', () => {
  it('returns Option.none for undefined input', async () => {
    const result = await Effect.runPromise(decodeOptionalWorldMetadata(undefined))
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns Option.some with decoded metadata for valid encoded input', async () => {
    const encoded = await Effect.runPromise(encodeWorldMetadata(validMetadata))
    const result = await Effect.runPromise(decodeOptionalWorldMetadata(encoded))
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result).seed).toBe(42)
  })
})

describe('collectDecodedWorldMetadata', () => {
  it('returns empty arrays for empty input', async () => {
    const result = await Effect.runPromise(collectDecodedWorldMetadata([]))
    expect(result.valid).toHaveLength(0)
    expect(result.corrupt).toHaveLength(0)
  })

  it('separates valid and corrupt rows', async () => {
    const encoded = await Effect.runPromise(encodeWorldMetadata(validMetadata))
    const rows = [
      { key: 'world-1', value: encoded },
      { key: 'world-2', value: { garbage: true } },
    ]
    const result = await Effect.runPromise(collectDecodedWorldMetadata(rows))
    expect(result.valid).toHaveLength(1)
    expect(result.valid[0]!.worldId).toBe('world-1')
    expect(result.corrupt).toHaveLength(1)
    expect(result.corrupt[0]).toBe('world-2')
  })

  it('returns all valid when all rows decode successfully', async () => {
    const encoded = await Effect.runPromise(encodeWorldMetadata(validMetadata))
    const rows = [
      { key: 'world-1', value: encoded },
      { key: 'world-2', value: encoded },
    ]
    const result = await Effect.runPromise(collectDecodedWorldMetadata(rows))
    expect(result.valid).toHaveLength(2)
    expect(result.corrupt).toHaveLength(0)
  })
})
