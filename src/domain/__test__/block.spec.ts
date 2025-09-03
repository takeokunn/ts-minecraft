import { describe, it, expect } from '@effect/vitest'
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
import { testReversibility } from '@test/test-utils'
import * as fc from 'effect/FastCheck'
import * as Arbitrary from 'effect/Arbitrary'
import * as S from 'effect/Schema'
import { blockTypeNames } from '../block-types'
import { Effect } from 'effect'
import { assert } from 'vitest'

describe('Block', () => {
  describe('Schema Reversibility', () => {
    testReversibility('PlacedBlockSchema', PlacedBlockSchema)
    testReversibility('FaceNameSchema', FaceNameSchema)
  })

  describe('Constants', () => {
    it.effect('hotbarSlots should match snapshot', () =>
      Effect.sync(() => {
        expect(hotbarSlots).toMatchSnapshot()
      }))
    it.effect('ATLAS_SIZE_IN_TILES should match snapshot', () =>
      Effect.sync(() => {
        expect(ATLAS_SIZE_IN_TILES).toMatchSnapshot()
      }))
    it.effect('TILE_SIZE should be 1 / ATLAS_SIZE_IN_TILES', () =>
      Effect.sync(() => {
        expect(TILE_SIZE).toBe(1 / ATLAS_SIZE_IN_TILES)
      }))
  })

  describe('createPlacedBlock', () => {
    it.effect('should create a valid PlacedBlock object', () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(Arbitrary.make(PlacedBlockSchema), async (placedBlock) => {
            const { position, blockType } = placedBlock
            assert.deepStrictEqual(createPlacedBlock(position, blockType), placedBlock)
          }),
        ),
      ),
    )
  })

  const blockTypeArbitrary = Arbitrary.make(S.Literal(...blockTypeNames))

  describe('getUvForFace', () => {
    it.effect('should return the correct UV for a given block type and face', () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(
            Arbitrary.make(FaceNameSchema),
            blockTypeArbitrary,
            async (faceName, blockType) => {
              const definition = blockDefinitions[blockType]!
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
            },
          ),
        ),
      ),
    )

    it.effect('should throw an error for an undefined block type', () =>
      Effect.sync(() => {
        // @ts-expect-error - Testing invalid input
        expect(() => getUvForFace('invalidBlockType', 'top')).toThrow()
      }))
  })

  describe('isBlockTransparent', () => {
    it.effect('should return the correct transparency for a given block type', () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(blockTypeArbitrary, async (blockType) => {
            const isTransparent = isBlockTransparent(blockType)
            assert.strictEqual(isTransparent, blockDefinitions[blockType]!.isTransparent)
          }),
        ),
      ),
    )

    it.effect('should throw an error for an undefined block type', () =>
      Effect.sync(() => {
        // @ts-expect-error - Testing invalid input
        expect(() => isBlockTransparent('invalidBlockType')).toThrow()
      }))
  })

  describe('isBlockFluid', () => {
    it.effect('should return the correct fluid status for a given block type', () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(blockTypeArbitrary, async (blockType) => {
            const isFluid = isBlockFluid(blockType)
            assert.strictEqual(isFluid, blockDefinitions[blockType]!.isFluid)
          }),
        ),
      ),
    )

    it.effect('should throw an error for an undefined block type', () =>
      Effect.sync(() => {
        // @ts-expect-error - Testing invalid input
        expect(() => isBlockFluid('invalidBlockType')).toThrow()
      }))
  })
})