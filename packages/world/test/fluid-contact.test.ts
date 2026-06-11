import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import { resolveContact } from '../domain/fluid-contact'
import type { FluidCell } from '@ts-minecraft/block'

const waterSource: FluidCell = { type: 'water', source: true, level: 0 }
const waterFlow: FluidCell = { type: 'water', source: false, level: 3 }
const lavaSource: FluidCell = { type: 'lava', source: true, level: 0 }
const lavaFlow: FluidCell = { type: 'lava', source: false, level: 2 }

describe('resolveContact', () => {
  it('lava source + water → OBSIDIAN', () => {
    const result = resolveContact(lavaSource, waterSource)
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result)).toBe('OBSIDIAN')
  })

  it('lava flowing + water → COBBLESTONE', () => {
    const result = resolveContact(lavaFlow, waterSource)
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result)).toBe('COBBLESTONE')
  })

  it('lava source + flowing water → OBSIDIAN (water source state irrelevant)', () => {
    const result = resolveContact(lavaSource, waterFlow)
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result)).toBe('OBSIDIAN')
  })

  it('lava flowing + flowing water → COBBLESTONE', () => {
    const result = resolveContact(lavaFlow, waterFlow)
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result)).toBe('COBBLESTONE')
  })

  it('water + lava (wrong order) → none (lavaCell must be first)', () => {
    const result = resolveContact(waterSource, lavaSource)
    expect(Option.isNone(result)).toBe(true)
  })

  it('water + water → none', () => {
    const result = resolveContact(waterSource, waterFlow)
    expect(Option.isNone(result)).toBe(true)
  })

  it('lava + lava → none', () => {
    const result = resolveContact(lavaSource, lavaFlow)
    expect(Option.isNone(result)).toBe(true)
  })
})
