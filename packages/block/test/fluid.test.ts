import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import {
  FLUID_BYTE_LENGTH,
  createFluidBuffer,
  encodeFluidCell,
  decodeFluidByte,
} from '@ts-minecraft/block/domain/fluid'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import type { FluidCell } from '@ts-minecraft/block/domain/fluid'

// ─── helpers ─────────────────────────────────────────────────────────────────

const waterSource = (level = 8): FluidCell => ({ type: 'water', source: true, level })
const waterFlow = (level: number): FluidCell => ({ type: 'water', source: false, level })
const lavaSource = (level = 8): FluidCell => ({ type: 'lava', source: true, level })
const lavaFlow = (level: number): FluidCell => ({ type: 'lava', source: false, level })

// ─── FLUID_BYTE_LENGTH ────────────────────────────────────────────────────────
describe('FLUID_BYTE_LENGTH', () => {
  it('equals CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT', () => {
    expect(FLUID_BYTE_LENGTH).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  })
})

// ─── createFluidBuffer ────────────────────────────────────────────────────────
describe('createFluidBuffer', () => {
  it('returns a Uint8Array of FLUID_BYTE_LENGTH bytes', () => {
    const buf = createFluidBuffer()
    expect(buf).toBeInstanceOf(Uint8Array)
    expect(buf.length).toBe(FLUID_BYTE_LENGTH)
  })

  it('all bytes are initialized to 0 (no fluid)', () => {
    const buf = createFluidBuffer()
    for (const byte of buf) {
      expect(byte).toBe(0)
    }
  })
})

// ─── encodeFluidCell ──────────────────────────────────────────────────────────
describe('encodeFluidCell', () => {
  it('sets the present bit (0x80) for any fluid cell', () => {
    const encoded = encodeFluidCell(waterSource())
    expect(encoded & 0x80).toBe(0x80)
  })

  it('sets the source bit (0x08) for a source block', () => {
    const encoded = encodeFluidCell(waterSource())
    expect(encoded & 0x08).toBe(0x08)
  })

  it('clears the source bit for a non-source block', () => {
    const encoded = encodeFluidCell(waterFlow(3))
    expect(encoded & 0x08).toBe(0)
  })

  it('sets the type bit (0x10) for lava', () => {
    const encoded = encodeFluidCell(lavaSource())
    expect(encoded & 0x10).toBe(0x10)
  })

  it('clears the type bit for water', () => {
    const encoded = encodeFluidCell(waterSource())
    expect(encoded & 0x10).toBe(0)
  })

  it('stores the level in the lowest 3 bits (0x07)', () => {
    for (let level = 0; level <= 7; level++) {
      const encoded = encodeFluidCell(waterFlow(level))
      expect(encoded & 0x07).toBe(level)
    }
  })

  it('masks level to 3 bits (value 8 wraps to 0 in the level field)', () => {
    // level=8 → 8 & 0x07 = 0
    const encoded = encodeFluidCell(waterSource(8))
    expect(encoded & 0x07).toBe(0)
  })
})

// ─── decodeFluidByte ──────────────────────────────────────────────────────────
describe('decodeFluidByte', () => {
  it('returns None for byte 0 (empty slot)', () => {
    expect(Option.isNone(decodeFluidByte(0))).toBe(true)
  })

  it('returns None for any byte without the present bit', () => {
    expect(Option.isNone(decodeFluidByte(0x07))).toBe(true)
    expect(Option.isNone(decodeFluidByte(0x10))).toBe(true)
  })

  it('returns Some when the present bit is set', () => {
    expect(Option.isSome(decodeFluidByte(0x80))).toBe(true)
  })

  it('decodes type=water when the type bit (0x10) is clear', () => {
    const result = decodeFluidByte(0x80)
    if (Option.isSome(result)) expect(result.value.type).toBe('water')
  })

  it('decodes type=lava when the type bit (0x10) is set', () => {
    const result = decodeFluidByte(0x80 | 0x10)
    if (Option.isSome(result)) expect(result.value.type).toBe('lava')
  })

  it('decodes source=true when the source bit (0x08) is set', () => {
    const result = decodeFluidByte(0x80 | 0x08)
    if (Option.isSome(result)) expect(result.value.source).toBe(true)
  })

  it('decodes source=false when the source bit (0x08) is clear', () => {
    const result = decodeFluidByte(0x80)
    if (Option.isSome(result)) expect(result.value.source).toBe(false)
  })

  it('decodes the level from the lowest 3 bits', () => {
    for (let level = 0; level <= 7; level++) {
      const result = decodeFluidByte(0x80 | level)
      if (Option.isSome(result)) expect(result.value.level).toBe(level)
    }
  })
})

// ─── round-trip encode/decode ─────────────────────────────────────────────────
describe('encode/decode round-trip', () => {
  const cells: FluidCell[] = [
    waterSource(0),
    waterSource(7),
    waterFlow(0),
    waterFlow(5),
    lavaSource(0),
    lavaFlow(3),
  ]

  for (const cell of cells) {
    it(`round-trips ${cell.type} source=${cell.source} level=${cell.level}`, () => {
      const encoded = encodeFluidCell(cell)
      const decoded = decodeFluidByte(encoded)
      expect(Option.isSome(decoded)).toBe(true)
      if (Option.isSome(decoded)) {
        expect(decoded.value.type).toBe(cell.type)
        expect(decoded.value.source).toBe(cell.source)
        expect(decoded.value.level).toBe(cell.level & 0x07)
      }
    })
  }
})
