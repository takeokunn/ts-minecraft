import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import { encodeFluidCell, decodeFluidByte } from '../domain/fluid'

describe('encodeFluidCell', () => {
  it('encodes a source water cell', () => {
    const byte = encodeFluidCell({ type: 'water', level: 0, source: true })
    // FLUID_PRESENT(0x80) | SOURCE(0x08) | LEVEL(0) = 0x88
    expect(byte & 0x80).toBe(0x80)
    expect(byte & 0x08).toBe(0x08)
    expect(byte & 0x10).toBe(0)
    expect(byte & 0x07).toBe(0)
  })

  it('encodes a flowing water cell with level 7', () => {
    const byte = encodeFluidCell({ type: 'water', level: 7, source: false })
    expect(byte & 0x80).toBe(0x80)
    expect(byte & 0x08).toBe(0)
    expect(byte & 0x10).toBe(0)
    expect(byte & 0x07).toBe(7)
  })

  it('encodes a source lava cell', () => {
    const byte = encodeFluidCell({ type: 'lava', level: 0, source: true })
    expect(byte & 0x80).toBe(0x80)
    expect(byte & 0x10).toBe(0x10)
    expect(byte & 0x08).toBe(0x08)
  })

  it('encodes a flowing lava cell with level 3', () => {
    const byte = encodeFluidCell({ type: 'lava', level: 3, source: false })
    expect(byte & 0x10).toBe(0x10)
    expect(byte & 0x08).toBe(0)
    expect(byte & 0x07).toBe(3)
  })
})

describe('decodeFluidByte', () => {
  it('returns none for byte 0 (no fluid)', () => {
    expect(Option.isNone(decodeFluidByte(0))).toBe(true)
  })

  it('returns none when FLUID_PRESENT bit is not set', () => {
    expect(Option.isNone(decodeFluidByte(0x07))).toBe(true)
  })

  it('decodes source water correctly', () => {
    const cell = Option.getOrThrow(decodeFluidByte(0x88)) // 0x80|0x08
    expect(cell.type).toBe('water')
    expect(cell.source).toBe(true)
    expect(cell.level).toBe(0)
  })

  it('decodes flowing water with level 5', () => {
    const byte = 0x80 | 5 // present + level 5
    const cell = Option.getOrThrow(decodeFluidByte(byte))
    expect(cell.type).toBe('water')
    expect(cell.source).toBe(false)
    expect(cell.level).toBe(5)
  })

  it('decodes source lava correctly', () => {
    const byte = 0x80 | 0x10 | 0x08 // present + lava + source
    const cell = Option.getOrThrow(decodeFluidByte(byte))
    expect(cell.type).toBe('lava')
    expect(cell.source).toBe(true)
    expect(cell.level).toBe(0)
  })
})

describe('encode → decode round-trip', () => {
  const cases = [
    { type: 'water' as const, level: 0, source: true },
    { type: 'water' as const, level: 7, source: false },
    { type: 'lava' as const, level: 0, source: true },
    { type: 'lava' as const, level: 3, source: false },
    { type: 'water' as const, level: 3, source: false },
  ]

  for (const cell of cases) {
    it(`round-trips ${cell.type} level=${cell.level} source=${cell.source}`, () => {
      const encoded = encodeFluidCell(cell)
      const decoded = Option.getOrThrow(decodeFluidByte(encoded))
      expect(decoded.type).toBe(cell.type)
      expect(decoded.level).toBe(cell.level)
      expect(decoded.source).toBe(cell.source)
    })
  }
})
