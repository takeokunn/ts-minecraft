import { describe, it, expect } from 'vitest'
import { test } from '@fast-check/vitest'
import * as fc from 'fast-check'
import { Either } from 'effect'
import { getUvForFace, isBlockTransparent, isBlockFluid, createPlacedBlock, isBlockType, blockTypeNames, blockDefinitions, FaceName } from '../block'

describe('block', () => {
  describe('getUvForFace', () => {
    // Test cases for blocks with specific top/bottom textures
    it('should return top texture for grass top', () => {
      expect(getUvForFace('grass', 'top')).toEqual(blockDefinitions.grass.textures.top)
    })

    it('should return bottom texture for grass bottom', () => {
      expect(getUvForFace('grass', 'bottom')).toEqual(blockDefinitions.grass.textures.bottom)
    })

    it('should return side texture for grass side', () => {
      expect(getUvForFace('grass', 'north')).toEqual(blockDefinitions.grass.textures.side)
    })

    // Test cases for blocks that fall back to side texture
    it('should return side texture for dirt top', () => {
      expect(getUvForFace('dirt', 'top')).toEqual(blockDefinitions.dirt.textures.side)
    })

    it('should return side texture for dirt bottom', () => {
      expect(getUvForFace('dirt', 'bottom')).toEqual(blockDefinitions.dirt.textures.side)
    })

    it('should return side texture for dirt side', () => {
      expect(getUvForFace('dirt', 'west')).toEqual(blockDefinitions.dirt.textures.side)
    })

    // Property-based test to cover all combinations
    test.prop([fc.constantFrom(...blockTypeNames), fc.constantFrom('top', 'bottom', 'north', 'south', 'east', 'west') as fc.Arbitrary<FaceName>])(
      'should always return a valid UV for any block and face',
      (blockType, faceName) => {
        const textures = blockDefinitions[blockType].textures
        let expectedUv
        if (faceName === 'top') {
          expectedUv = textures.top ?? textures.side
        } else if (faceName === 'bottom') {
          expectedUv = textures.bottom ?? textures.side
        } else {
          expectedUv = textures.side
        }
        expect(getUvForFace(blockType, faceName)).toEqual(expectedUv)
      },
    )
  })

  describe('isBlockTransparent', () => {
    for (const blockType of blockTypeNames) {
      it(`should return correct transparency for ${blockType}`, () => {
        const expected = blockDefinitions[blockType].isTransparent
        expect(isBlockTransparent(blockType)).toBe(expected)
      })
    }
  })

  describe('isBlockFluid', () => {
    for (const blockType of blockTypeNames) {
      it(`should return correct fluid status for ${blockType}`, () => {
        const expected = blockDefinitions[blockType].isFluid
        expect(isBlockFluid(blockType)).toBe(expected)
      })
    }
  })

  describe('createPlacedBlock', () => {
    it('should create a PlacedBlock object for valid input', () => {
      const position = { x: 1, y: 2, z: 3 }
      const blockType = 'grass'
      const placedBlockEither = createPlacedBlock(position, blockType)
      expect(Either.isRight(placedBlockEither)).toBe(true)
      if (Either.isRight(placedBlockEither)) {
        expect(placedBlockEither.right).toEqual({ position, blockType })
      }
    })

    it('should return a Left for invalid input', () => {
      const position = { x: 1.5, y: 2, z: 3 } // x is not an integer
      const blockType = 'grass'
      const placedBlockEither = createPlacedBlock(position, blockType)
      expect(Either.isLeft(placedBlockEither)).toBe(true)
    })
  })

  describe('isBlockType', () => {
    test.prop([fc.constantFrom(...blockTypeNames)])('should return true for valid block types', (blockType) => {
      expect(isBlockType(blockType)).toBe(true)
    })

    test.prop([fc.string().filter((s) => !isBlockType(s))])('should return false for invalid block types', (invalidBlockType) => {
      expect(isBlockType(invalidBlockType)).toBe(false)
    })

    it('should return false for non-string values', () => {
      expect(isBlockType(null)).toBe(false)
      expect(isBlockType(undefined)).toBe(false)
      expect(isBlockType(123)).toBe(false)
      expect(isBlockType({})).toBe(false)
    })
  })
})
