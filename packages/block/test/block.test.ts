import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Schema } from 'effect'
import { BlockId } from '@ts-minecraft/core'
import { Block, BlockPropertiesSchema, BlockFaceSchema } from '@ts-minecraft/block/domain/block'

// ---------------------------------------------------------------------------
// BlockPropertiesSchema
// ---------------------------------------------------------------------------

describe('BlockPropertiesSchema', () => {
  const decode = Schema.decodeUnknownSync(BlockPropertiesSchema)

  it('accepts valid properties with all fields', () => {
    const result = decode({
      hardness: 50,
      transparency: false,
      solid: true,
      emissive: false,
      friction: 0.6,
    })
    expect(result.hardness).toBe(50)
    expect(result.transparency).toBe(false)
    expect(result.solid).toBe(true)
    expect(result.emissive).toBe(false)
    expect(result.friction).toBe(0.6)
  })

  it('rejects hardness below -1', () => {
    expect(() =>
      decode({ hardness: -2, transparency: false, solid: true, emissive: false, friction: 0.5 })
    ).toThrow()
  })

  it('allows hardness -1 for unbreakable blocks and fractional vanilla hardness', () => {
    expect(() =>
      decode({ hardness: -1, transparency: true, solid: false, emissive: true, friction: 0.0 })
    ).not.toThrow()
    expect(decode({ hardness: 0.4, transparency: true, solid: false, emissive: false, friction: 0.6 }).hardness).toBe(0.4)
  })

  it('allows hardness above 100 (unbreakable blocks like End Portal Frame)', () => {
    expect(() =>
      decode({ hardness: 9000, transparency: false, solid: true, emissive: true, friction: 0.6 })
    ).not.toThrow()
  })

  it('rejects friction below 0', () => {
    expect(() =>
      decode({ hardness: 50, transparency: false, solid: true, emissive: false, friction: -0.1 })
    ).toThrow()
  })

  it('rejects friction above 1', () => {
    expect(() =>
      decode({ hardness: 50, transparency: false, solid: true, emissive: false, friction: 1.1 })
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// BlockFaceSchema
// ---------------------------------------------------------------------------

describe('BlockFaceSchema', () => {
  const decode = Schema.decodeUnknownSync(BlockFaceSchema)

  it('accepts a valid face object with all 6 boolean fields', () => {
    const result = decode({
      top: true,
      bottom: false,
      north: true,
      south: false,
      east: true,
      west: false,
    })
    expect(result.top).toBe(true)
    expect(result.bottom).toBe(false)
    expect(result.north).toBe(true)
    expect(result.south).toBe(false)
    expect(result.east).toBe(true)
    expect(result.west).toBe(false)
  })

  it('rejects object missing a required field', () => {
    expect(() =>
      decode({ top: true, bottom: true, north: true, south: true, east: true })
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Block schema class
// ---------------------------------------------------------------------------

describe('Block', () => {
  const validProps = {
    id: BlockId.make('block:stone'),
    type: 'STONE' as const,
    properties: {
      hardness: 100,
      transparency: false,
      solid: true,
      emissive: false,
      friction: 0.8,
    },
    faces: {
      top: true,
      bottom: true,
      north: true,
      south: true,
      east: true,
      west: true,
    },
  }

  it('constructs a valid Block with new Block({...})', () => {
    const block = new Block(validProps)
    expect(block).toBeInstanceOf(Block)
  })

  it('has the correct id, type, properties, and faces fields', () => {
    const block = new Block(validProps)
    expect(block.id).toBe(validProps.id)
    expect(block.type).toBe('STONE')
    expect(block.properties.hardness).toBe(100)
    expect(block.properties.solid).toBe(true)
    expect(block.faces.top).toBe(true)
    expect(block.faces.west).toBe(true)
  })

  it('two Blocks with the same type have equal type fields', () => {
    const blockA = new Block(validProps)
    const blockB = new Block({ ...validProps, id: BlockId.make('block:stone-2') })
    expect(blockA.type).toBe(blockB.type)
  })
})
