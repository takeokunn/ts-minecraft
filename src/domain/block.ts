import { Schema } from 'effect';

export const blockTypeNames = [
  'grass',
  'dirt',
  'stone',
  'cobblestone',
  'oakLog',
  'oakLeaves',
  'sand',
  'water',
  'glass',
  'brick',
  'plank',
] as const;

export const BlockTypeSchema = Schema.Union(
  ...blockTypeNames.map((k) => Schema.Literal(k)),
);
export type BlockType = Schema.Schema.Type<typeof BlockTypeSchema>;

// --- Texture Atlas Definitions ---

// The atlas is assumed to be composed of 16x16 tiles.
const ATLAS_SIZE_IN_TILES = 16;

// Defines the texture coordinates [x, y] in the atlas for each block type.
// [0, 0] is the top-left tile.
const blockTextureCoordinates: Record<
  BlockType,
  { top?: [number, number]; bottom?: [number, number]; side: [number, number] }
> = {
  grass: { top: [0, 0], bottom: [2, 0], side: [1, 0] },
  dirt: { side: [2, 0] },
  stone: { side: [3, 0] },
  cobblestone: { side: [4, 0] },
  oakLog: { top: [6, 0], bottom: [6, 0], side: [5, 0] },
  oakLeaves: { side: [7, 0] },
  sand: { side: [8, 0] },
  water: { side: [9, 0] },
  glass: { side: [10, 0] },
  brick: { side: [11, 0] },
  plank: { side: [12, 0] },
};

type FaceName = 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west';

// Helper function to get the UV coordinates for a specific block face.
export function getUvForFace(
  blockType: BlockType,
  faceName: FaceName,
): [number, number] {
  const definition = blockTextureCoordinates[blockType];
  let coords: [number, number];

  if ((faceName === 'top' || faceName === 'bottom') && definition[faceName]) {
    coords = definition[faceName]!;
  } else {
    coords = definition.side;
  }

  return coords;
}

export const TILE_SIZE = 1 / ATLAS_SIZE_IN_TILES;
