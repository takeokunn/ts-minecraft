import * as S from 'effect/Schema'
import { describe, it, assert, expect } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect, Gen } from 'effect'
import {
  PlacedBlockSchema,
  FaceNameSchema,
  createPlacedBlock,
  getUvForFace,
  isBlockFluid,
  isBlockTransparent,
  hotbarSlots,
  ATLAS_SIZE_IN_TILES,
  TILE_SIZE,
} from '../block'
import { blockDefinitions } from '../block-definitions'

describe('Block', () => {
  const testReversibility = (name: string, schema: S.Schema<any, any>) => {
    it.effect(`${name} should be reversible after encoding and decoding`, () =>
      Gen.flatMap(fc.gen(schema), (value) =>
        Effect.sync(() => {
          const encode = S.encodeSync(schema)
          const decode = S.decodeSync(schema)
          const decodedValue = decode(encode(value))
          assert.deepStrictEqual(decodedValue, value)
        }),
      ))
  }

  describe('Schema Reversibility', () => {
    testReversibility('PlacedBlockSchema', PlacedBlockSchema)
    testReversibility('FaceNameSchema', FaceNameSchema)
  })

  describe('Constants', () => {
    it('hotbarSlots should match snapshot', () => {
      expect(hotbarSlots).toMatchSnapshot()
    })
    it('ATLAS_SIZE_IN_TILES should match snapshot', () => {
      expect(ATLAS_SIZE_IN_TILES).toMatchSnapshot()
    })
    it('TILE_SIZE should be 1 / ATLAS_SIZE_IN_TILES', () => {
      expect(TILE_SIZE).toBe(1 / ATLAS_SIZE_IN_TILES)
    })
  })

  describe('createPlacedBlock', () => {
    it.effect('should create a valid PlacedBlock object', () =>
      Gen.flatMap(fc.gen(PlacedBlockSchema), (placedBlock) =>
        Effect.sync(() => {
          const { position, blockType } = placedBlock
          assert.deepStrictEqual(createPlacedBlock(position, blockType), placedBlock)
        }),
      ))
  })

  describe('getUvForFace', () => {
    it.effect('should return the correct UV for a given block type and face', () =>
      Gen.flatMap(fc.gen(FaceNameSchema), (faceName) =>
        Gen.flatMap(fc.gen(S.keyof(S.Struct(blockDefinitions))), (blockType) =>
          Effect.sync(() => {
            const definition = blockDefinitions[blockType]
            const uv = getUvForFace(blockType, faceName)
            let expectedUv
            if (faceName === 'top') {
              expectedUv = definition.textures.top ?? definition.textures.side
            } else if (faceName === 'bottom') {
              expectedUv = definition.textures.bottom ?? definition.textures.side
            } else {
              expectedUv = definition.textures.side
            }
            assert.deepStrictEqual(uv, expectedUv)
          }),
        ),
      ))
  })

  describe('isBlockTransparent', () => {
    it.effect('should return the correct transparency for a given block type', () =>
      Gen.flatMap(fc.gen(S.keyof(S.Struct(blockDefinitions))), (blockType) =>
        Effect.sync(() => {
          const isTransparent = isBlockTransparent(blockType)
          assert.strictEqual(isTransparent, blockDefinitions[blockType].isTransparent)
        }),
      ))
  })

  describe('isBlockFluid', () => {
    it.effect('should return the correct fluid status for a given block type', () =>
      Gen.flatMap(fc.gen(S.keyof(S.Struct(blockDefinitions))), (blockType) =>
        Effect.sync(() => {
          const isFluid = isBlockFluid(blockType)
          assert.strictEqual(isFluid, blockDefinitions[blockType].isFluid)
        }),
      ))
  })
})