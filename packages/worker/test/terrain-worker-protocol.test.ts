import { describe, it, expect } from 'vitest'
import { Effect, Option } from 'effect'
import {
  decodeRequest,
  decodeResponse,
  decodeRequestSync,
  DimensionSchema,
} from '../domain/terrain-worker-protocol'
import { Schema } from 'effect'

const validRequest = {
  id: 1,
  chunk: { x: 0, z: 0 },
  seaLevel: 62,
  lakeLevel: 60,
  seed: 42,
}

const validSuccess = {
  id: 1,
  kind: 'success' as const,
  blocks: new Uint8Array(32768),
  skyLight: new Uint8Array(32768),
  blockLight: new Uint8Array(32768),
}

const validFailure = {
  id: 2,
  kind: 'failure' as const,
  error: 'terrain generation failed',
}

describe('DimensionSchema', () => {
  it('accepts overworld', () => {
    const decode = Schema.decodeUnknownSync(DimensionSchema)
    expect(decode('overworld')).toBe('overworld')
  })

  it('accepts nether', () => {
    const decode = Schema.decodeUnknownSync(DimensionSchema)
    expect(decode('nether')).toBe('nether')
  })

  it('accepts end', () => {
    const decode = Schema.decodeUnknownSync(DimensionSchema)
    expect(decode('end')).toBe('end')
  })

  it('rejects invalid dimensions', () => {
    const decode = Schema.decodeUnknownSync(DimensionSchema)
    expect(() => decode('sky')).toThrow()
  })
})

describe('decodeRequestSync', () => {
  it('decodes a valid request', () => {
    const result = decodeRequestSync(validRequest)
    expect(result.id).toBe(1)
    expect(result.chunk.x).toBe(0)
    expect(result.seaLevel).toBe(62)
  })

  it('defaults dimension to overworld when omitted', () => {
    const result = decodeRequestSync(validRequest)
    expect(result.dimension).toBe('overworld')
  })

  it('decodes explicit dimension values', () => {
    const result = decodeRequestSync({ ...validRequest, dimension: 'nether' })
    expect(result.dimension).toBe('nether')
  })

  it('throws on missing required fields', () => {
    expect(() => decodeRequestSync({ id: 1 })).toThrow()
  })

  it('throws on negative id', () => {
    expect(() => decodeRequestSync({ ...validRequest, id: -1 })).toThrow()
  })
})

describe('decodeRequest (async Effect)', () => {
  it('succeeds for a valid request', async () => {
    const result = await Effect.runPromise(decodeRequest(validRequest))
    expect(result.id).toBe(1)
  })

  it('fails for invalid input', async () => {
    const result = await Effect.runPromise(
      decodeRequest({ invalid: true }).pipe(Effect.option),
    )
    expect(Option.isNone(result)).toBe(true)
  })
})

describe('decodeResponse (async Effect)', () => {
  it('decodes a success response', async () => {
    const result = await Effect.runPromise(decodeResponse(validSuccess))
    expect(result.kind).toBe('success')
    expect(result.id).toBe(1)
  })

  it('decodes a failure response', async () => {
    const result = await Effect.runPromise(decodeResponse(validFailure))
    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.error).toBe('terrain generation failed')
    }
  })

  it('fails for invalid input', async () => {
    const result = await Effect.runPromise(
      decodeResponse({ kind: 'unknown', id: 0 }).pipe(Effect.option),
    )
    expect(Option.isNone(result)).toBe(true)
  })
})
