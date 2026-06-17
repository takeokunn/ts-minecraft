import { describe, it, expect } from 'vitest'
import { MutableRef } from 'effect'
import {
  isRecord,
  extractResponseId,
  rejectAllPendingRequests,
  toNullableMeshed,
  type PendingMesh,
} from '../infrastructure/meshing/meshing-worker-pool-protocol'

describe('isRecord', () => {
  it('returns true for plain objects', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord({ id: 1 })).toBe(true)
  })

  it('returns false for null', () => {
    expect(isRecord(null)).toBe(false)
  })

  it('returns false for primitives', () => {
    expect(isRecord(42)).toBe(false)
    expect(isRecord('hello')).toBe(false)
    expect(isRecord(true)).toBe(false)
    expect(isRecord(undefined)).toBe(false)
  })

  it('returns true for arrays (arrays are objects)', () => {
    expect(isRecord([])).toBe(true)
  })
})

describe('extractResponseId', () => {
  it('extracts integer id >= 0', () => {
    expect(extractResponseId({ id: 0 })).toBe(0)
    expect(extractResponseId({ id: 42 })).toBe(42)
    expect(extractResponseId({ id: 9999 })).toBe(9999)
  })

  it('returns null for non-record values', () => {
    expect(extractResponseId(null)).toBeNull()
    expect(extractResponseId(undefined)).toBeNull()
    expect(extractResponseId('string')).toBeNull()
    expect(extractResponseId(42)).toBeNull()
  })

  it('returns null when id is missing', () => {
    expect(extractResponseId({})).toBeNull()
    expect(extractResponseId({ other: 1 })).toBeNull()
  })

  it('returns null for negative id', () => {
    expect(extractResponseId({ id: -1 })).toBeNull()
  })

  it('returns null for non-integer id', () => {
    expect(extractResponseId({ id: 1.5 })).toBeNull()
    expect(extractResponseId({ id: 'abc' })).toBeNull()
    expect(extractResponseId({ id: null })).toBeNull()
  })
})

describe('toNullableMeshed', () => {
  const makeBuffers = () => {
    const n = 12
    return {
      positions: new Float32Array(n * 3),
      normals: new Int8Array(n * 3),
      colors: new Uint8Array(n * 3),
      uvs: new Float32Array(n * 2),
      tileIndexes: new Float32Array(n),
      indices: new Uint32Array(n),
    }
  }

  it('returns null when all arguments are null', () => {
    const result = toNullableMeshed(null, null, null, null, null, null, 'opaque')
    expect(result).toBeNull()
  })

  it('returns a MeshedChunk when all buffers are provided', () => {
    const b = makeBuffers()
    const result = toNullableMeshed(b.positions, b.normals, b.colors, b.uvs, b.tileIndexes, b.indices, 'opaque')
    expect(result).not.toBeNull()
    expect(result!.positions).toBe(b.positions)
    expect(result!.normals).toBe(b.normals)
    expect(result!.colors).toBe(b.colors)
    expect(result!.uvs).toBe(b.uvs)
    expect(result!.tileIndexes).toBe(b.tileIndexes)
    expect(result!.indices).toBe(b.indices)
  })

  it('throws for a partial payload (some null, some non-null)', () => {
    const b = makeBuffers()
    expect(() => toNullableMeshed(b.positions, null, null, null, null, null, 'opaque')).toThrow()
    expect(() => toNullableMeshed(b.positions, b.normals, b.colors, null, null, null, 'opaque')).toThrow()
  })
})

describe('rejectAllPendingRequests', () => {
  it('rejects every pending request and clears the map', () => {
    const error = new Error('worker failed')
    const rejected: unknown[] = []
    const pending = new Map<number, PendingMesh>([
      [1, {
        resolve: () => {},
        reject: (e) => rejected.push(e),
      }],
      [2, {
        resolve: () => {},
        reject: (e) => rejected.push(e),
      }],
    ])

    rejectAllPendingRequests(MutableRef.make(pending), error)

    expect(rejected).toEqual([error, error])
    expect(pending.size).toBe(0)
  })
})
