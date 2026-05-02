import { describe, expect, it } from '@effect/vitest'
import { Option } from 'effect'
import { decodeFluidByte, encodeFluidCell, hydrateLegacyFluidBufferFromBlocks } from './fluid'

describe('domain/fluid — encoding', () => {
  it('round-trips a water source cell', () => {
    const byte = encodeFluidCell({ level: 0, source: true, type: 'water' })
    const decoded = Option.getOrThrow(decodeFluidByte(byte))
    expect(decoded).toEqual({ level: 0, source: true, type: 'water' })
  })

  it('round-trips a lava source cell', () => {
    const byte = encodeFluidCell({ level: 0, source: true, type: 'lava' })
    const decoded = Option.getOrThrow(decodeFluidByte(byte))
    expect(decoded).toEqual({ level: 0, source: true, type: 'lava' })
  })

  it('round-trips a flowing lava cell at max level', () => {
    const byte = encodeFluidCell({ level: 3, source: false, type: 'lava' })
    const decoded = Option.getOrThrow(decodeFluidByte(byte))
    expect(decoded).toEqual({ level: 3, source: false, type: 'lava' })
  })

  it('is backward-compatible: legacy byte with bit-4 unset decodes to water', () => {
    // Legacy encoding: PRESENT(0x80) | SOURCE(0x08) | level=0 → 0x88
    const legacyByte = 0x88
    const decoded = Option.getOrThrow(decodeFluidByte(legacyByte))
    expect(decoded.type).toBe('water')
    expect(decoded.source).toBe(true)
    expect(decoded.level).toBe(0)
  })

  it('returns Option.none() for empty bytes', () => {
    expect(decodeFluidByte(0)).toEqual(Option.none())
  })

  it('hydrateLegacyFluidBufferFromBlocks marks water and lava indices as sources', () => {
    const blocks = new Uint8Array(4)
    blocks[0] = 6 // WATER
    blocks[1] = 17 // LAVA
    blocks[2] = 2 // STONE
    blocks[3] = 0 // AIR

    const fluid = hydrateLegacyFluidBufferFromBlocks(blocks, 6, 17)
    expect(Option.getOrThrow(decodeFluidByte(fluid[0]!))).toEqual({ level: 0, source: true, type: 'water' })
    expect(Option.getOrThrow(decodeFluidByte(fluid[1]!))).toEqual({ level: 0, source: true, type: 'lava' })
    expect(fluid[2]).toBe(0)
    expect(fluid[3]).toBe(0)
  })

  it('hydrateLegacyFluidBufferFromBlocks without lavaIndex ignores lava blocks', () => {
    const blocks = new Uint8Array(2)
    blocks[0] = 6 // WATER
    blocks[1] = 17 // LAVA
    const fluid = hydrateLegacyFluidBufferFromBlocks(blocks, 6)
    expect(Option.isSome(decodeFluidByte(fluid[0]!))).toBe(true)
    expect(fluid[1]).toBe(0)
  })
})
