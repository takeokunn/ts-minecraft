import { match } from 'ts-pattern';

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
export type BlockType = (typeof blockTypeNames)[number];

export const hotbarSlots: BlockType[] = [
  'grass',
  'dirt',
  'stone',
  'cobblestone',
  'oakLog',
  'plank',
  'glass',
  'brick',
  'sand',
];

const ATLAS_SIZE_IN_TILES = 16;
export const TILE_SIZE = 1 / ATLAS_SIZE_IN_TILES;

type BlockDefinition = {
  textures: {
    top?: [number, number];
    bottom?: [number, number];
    side: [number, number];
  };
  isTransparent: boolean;
  isFluid: boolean;
};

export const blockDefinitions: Record<BlockType, BlockDefinition> = {
  grass: {
    textures: { top: [0, 0], bottom: [2, 0], side: [1, 0] },
    isTransparent: false,
    isFluid: false,
  },
  dirt: {
    textures: { side: [2, 0] },
    isTransparent: false,
    isFluid: false,
  },
  stone: {
    textures: { side: [3, 0] },
    isTransparent: false,
    isFluid: false,
  },
  cobblestone: {
    textures: { side: [4, 0] },
    isTransparent: false,
    isFluid: false,
  },
  oakLog: {
    textures: { top: [6, 0], bottom: [6, 0], side: [5, 0] },
    isTransparent: false,
    isFluid: false,
  },
  oakLeaves: {
    textures: { side: [7, 0] },
    isTransparent: true,
    isFluid: false,
  },
  sand: {
    textures: { side: [8, 0] },
    isTransparent: false,
    isFluid: false,
  },
  water: {
    textures: { side: [9, 0] },
    isTransparent: true,
    isFluid: true,
  },
  glass: {
    textures: { side: [10, 0] },
    isTransparent: true,
    isFluid: false,
  },
  brick: {
    textures: { side: [11, 0] },
    isTransparent: false,
    isFluid: false,
  },
  plank: {
    textures: { side: [12, 0] },
    isTransparent: false,
    isFluid: false,
  },
};

export type FaceName = 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west';

export function getUvForFace(blockType: BlockType, faceName: FaceName): [number, number] {
  const definition = blockDefinitions[blockType].textures;

  return match(faceName)
    .with('top', () => definition.top ?? definition.side)
    .with('bottom', () => definition.bottom ?? definition.side)
    .with('north', 'south', 'east', 'west', () => definition.side)
    .exhaustive();
}

export function isBlockTransparent(blockType: BlockType): boolean {
  return blockDefinitions[blockType].isTransparent;
}

export function isBlockFluid(blockType: BlockType): boolean {
  return blockDefinitions[blockType].isFluid;
}

export const getBlockUv = (block: BlockType, face: FaceName) => {
  const [u, v] = getUvForFace(block, face);
  return {
    u: u * TILE_SIZE,
    v: v * TILE_SIZE,
  };
};
