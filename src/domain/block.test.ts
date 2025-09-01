import { describe, it, expect } from 'vitest';
import { test } from '@fast-check/vitest';
import * as fc from 'fast-check';
import { match } from 'ts-pattern';
import {
  getUvForFace,
  blockTypeNames,
  isBlockTransparent,
  isBlockFluid,
  blockDefinitions,
  BlockType,
  FaceName,
} from './block';

const blockTypeArb = fc.constantFrom(...blockTypeNames) as fc.Arbitrary<BlockType>;
const faceNameArb = fc.constantFrom('top', 'bottom', 'north', 'south', 'east', 'west') as fc.Arbitrary<FaceName>;

describe('domain/block', () => {
  describe('Data Integrity', () => {
    it('should have texture coordinates defined for all block types', () => {
      for (const blockType of blockTypeNames) {
        expect(blockDefinitions[blockType].textures).toBeDefined();
      }
    });

    it('should have transparency defined for all block types', () => {
      for (const blockType of blockTypeNames) {
        expect(blockDefinitions[blockType].isTransparent).toBeDefined();
      }
    });

    it('should have fluid property defined for all block types', () => {
      for (const blockType of blockTypeNames) {
        expect(blockDefinitions[blockType].isFluid).toBeDefined();
      }
    });
  });

  describe('getUvForFace()', () => {
    test.prop([blockTypeArb, faceNameArb])(
      'should return the correct UV coordinates for any given block type and face',
      (blockType, faceName) => {
        const definition = blockDefinitions[blockType].textures;
        const expectedUv = match(faceName)
          .with('top', () => definition.top ?? definition.side)
          .with('bottom', () => definition.bottom ?? definition.side)
          .otherwise(() => definition.side);

        const actualUv = getUvForFace(blockType, faceName);

        expect(actualUv).toEqual(expectedUv);
      },
    );
  });

  describe('isBlockTransparent()', () => {
    test.prop([blockTypeArb])(
      'should return the transparency property defined for any given block type',
      blockType => {
        const expected = blockDefinitions[blockType].isTransparent;
        const actual = isBlockTransparent(blockType);
        expect(actual).toBe(expected);
      },
    );
  });

  describe('isBlockFluid()', () => {
    test.prop([blockTypeArb])('should return the fluid property defined for any given block type', blockType => {
      const expected = blockDefinitions[blockType].isFluid;
      const actual = isBlockFluid(blockType);
      expect(actual).toBe(expected);
    });
  });
});
