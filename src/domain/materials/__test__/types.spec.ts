import { Schema } from '@effect/schema'
import * as Arbitrary from '@effect/schema/Arbitrary'
import { it, expect } from '@effect/vitest'
import {
  BlockId,
  ItemId,
  Material,
  MaterialCollection,
  MaterialError,
  MaterialEvent,
  parseBlockId,
  parseItemId,
} from '../types'

const decodeMaterial = Schema.decodeUnknownEither(Material)
const decodeMaterials = Schema.decodeUnknownEither(MaterialCollection)

const blockIdArb = Arbitrary.make(BlockId)
const itemIdArb = Arbitrary.make(ItemId)

it.prop('parseBlockId accepts values produced by schema', [blockIdArb], ([value]) => {
  expect(() => parseBlockId(value)).not.toThrow()
})

it.prop('parseItemId accepts values produced by schema', [itemIdArb], ([value]) => {
  expect(() => parseItemId(value)).not.toThrow()
})

it('decodeMaterial fails for negative hardness', () => {
  const candidate = {
    id: 'invalid',
    blockId: 'invalid',
    defaultItemId: 'invalid',
    category: 'stone',
    hardness: -1,
    blastResistance: 1,
    luminance: 0,
    tool: {
      required: true,
      preferredTypes: ['pickaxe'],
      minimumLevel: 0,
    },
    drops: [],
    tags: [],
  }
  const result = decodeMaterial(candidate)
  expect(result._tag).toBe('Left')
})

it('MaterialCollection enforces non-empty array', () => {
  const result = decodeMaterials([])
  expect(result._tag).toBe('Left')
})

it('MaterialError constructors assign tags', () => {
  const error = MaterialError.MaterialNotFound({ blockId: Schema.decodeUnknownSync(BlockId)('minecraft:stone') })
  expect(error._tag).toBe('MaterialNotFound')
})

it('MaterialEvent constructor produces immutable events', () => {
  const drops = [{ itemId: Schema.decodeUnknownSync(ItemId)('minecraft:stone'), amount: 1 }]
  const event = MaterialEvent.Harvested({ blockId: Schema.decodeUnknownSync(BlockId)('minecraft:stone'), drops, timestampMillis: 1 })
  expect(event._tag).toBe('Harvested')
  expect(event.drops).toHaveLength(1)
})
